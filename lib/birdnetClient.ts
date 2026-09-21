import { pageOrigin } from "@/lib/birdnet";
import type { ClassifyResult, LoadProgress, SpeciesEntry } from "@/lib/birdnet";

// Wire protocol, shared with lib/birdnet.worker.ts. Imported there with `import type`, so nothing
// from this module ends up inside the worker bundle.
export type WorkerRequest =
    // the origin is read on the main thread: a worker has no page base to resolve app-relative URLs
    // against, and both the label fetch and ORT's wasm path fail outright without it.
    // `species` is the dex's scientific names; the worker turns them into an index mask, because the
    // mask has to be applied before the top-N slice and that slice happens worker-side.
    | { type: "load"; origin: string; species: SpeciesEntry[] }
    | { type: "classify"; id: number; samples: ArrayBufferLike };
export type WorkerResponse =
    | ({ type: "progress" } & LoadProgress)
    | { type: "ready"; allowed: number; unmatched: number }
    | { type: "result"; id: number; result: ClassifyResult }
    | { type: "error"; message: string; id?: number };

/** How many of BirdNET's 6522 classes survived the species mask, and how many of our names it couldn't find. */
export type MaskStats = { allowed: number; unmatched: number };

export type BirdnetClient = {
    /** Fetches labels + model, builds the session and the species mask. Safe to call more than once. */
    load: (species: SpeciesEntry[], onProgress: (progress: LoadProgress) => void) => Promise<MaskStats>;
    /** Classifies one 3s window. `samples` is transferred, so the caller must not reuse it. */
    classify: (samples48k: Float32Array) => Promise<ClassifyResult>;
    dispose: () => void;
    /** Which path actually ran — surfaced in the UI during development. */
    readonly mode: "worker" | "main";
};

function workerClient(worker: Worker): BirdnetClient {
    let nextId = 1;
    const pending = new Map<number, { resolve: (result: ClassifyResult) => void; reject: (err: Error) => void }>();
    let onLoad: { resolve: (stats: MaskStats) => void; reject: (err: Error) => void; progress: (p: LoadProgress) => void } | null = null;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        switch (message.type) {
            case "progress":
                onLoad?.progress({ phase: message.phase, received: message.received, total: message.total });
                return;
            case "ready":
                onLoad?.resolve({ allowed: message.allowed, unmatched: message.unmatched });
                onLoad = null;
                return;
            case "result": {
                pending.get(message.id)?.resolve(message.result);
                pending.delete(message.id);
                return;
            }
            case "error": {
                const error = new Error(message.message);
                if (message.id === undefined) {
                    onLoad?.reject(error);
                    onLoad = null;
                } else {
                    pending.get(message.id)?.reject(error);
                    pending.delete(message.id);
                }
            }
        }
    };

    // A worker that dies (out of memory during session creation is the realistic case) would
    // otherwise leave every caller hanging forever.
    worker.onerror = event => {
        const error = new Error(event.message || "BirdNET worker crashed");
        onLoad?.reject(error);
        onLoad = null;
        pending.forEach(entry => entry.reject(error));
        pending.clear();
    };

    return {
        mode: "worker",
        load: (species, onProgress) =>
            new Promise<MaskStats>((resolve, reject) => {
                onLoad = { resolve, reject, progress: onProgress };
                worker.postMessage({ type: "load", origin: pageOrigin(), species } satisfies WorkerRequest);
            }),
        classify: samples =>
            new Promise<ClassifyResult>((resolve, reject) => {
                const id = nextId++;
                pending.set(id, { resolve, reject });
                worker.postMessage({ type: "classify", id, samples: samples.buffer } satisfies WorkerRequest, [samples.buffer]);
            }),
        dispose: () => {
            pending.clear();
            onLoad = null;
            worker.terminate();
        },
    };
}

// Last resort: same pipeline, same module, just on the main thread — the page still works, it only
// stutters while each window is classified.
function inlineClient(): BirdnetClient {
    type Loaded = { session: import("onnxruntime-web").InferenceSession; labels: string[]; mask: Uint8Array };
    let ready: Promise<Loaded> | null = null;

    return {
        mode: "main",
        load: async (species, onProgress) => {
            let stats: MaskStats = { allowed: 0, unmatched: 0 };
            ready ??= (async () => {
                const birdnet = await import("@/lib/birdnet");
                const origin = birdnet.pageOrigin();
                onProgress({ phase: "labels" });
                const labels = await birdnet.loadLabels(origin);
                const built = birdnet.buildSpeciesMask(labels, species);
                stats = { allowed: built.allowed, unmatched: built.unmatched.length };
                onProgress({ phase: "download", received: 0, total: 1 });
                const model = await birdnet.fetchModel((received, total) => onProgress({ phase: "download", received, total }));
                onProgress({ phase: "init" });
                return { session: await birdnet.createSession(model, origin), labels, mask: built.mask };
            })().catch(err => {
                ready = null; // retry cleanly next time rather than reusing the rejection
                throw err;
            });
            await ready;
            return stats;
        },
        classify: async samples => {
            if (!ready) throw new Error("Model not loaded");
            const [{ session, labels, mask }, birdnet] = await Promise.all([ready, import("@/lib/birdnet")]);
            return birdnet.classify(session, labels, samples, mask);
        },
        dispose: () => {
            ready = null;
        },
    };
}

export function createBirdnetClient(): BirdnetClient {
    try {
        // the new URL(...) argument has to be a literal for the bundler to see the worker entry point
        const worker = new Worker(new URL("./birdnet.worker.ts", import.meta.url), { type: "module" });
        return workerClient(worker);
    } catch (err) {
        console.warn("BirdNET worker unavailable, running on the main thread:", err);
        return inlineClient();
    }
}
