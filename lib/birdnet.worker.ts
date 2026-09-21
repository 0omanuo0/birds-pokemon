/// <reference lib="webworker" />

// Runs BirdNET off the main thread. Without COOP/COEP the page isn't crossOriginIsolated, so ORT
// falls back to single-threaded wasm and one 3s window takes ~150-300ms on a desktop and up to ~900ms
// on a phone. At a 1.5s inference hop that would block the main thread most of the time and the
// spectrogram would visibly hitch — hence this file.
//
// It also owns the species mask, because the mask has to be applied before the top-N slice and that
// slice happens here (posting all 6522 scored labels back per window would cost more than inference).
//
// Keep it a leaf module: only lib/birdnet.ts and onnxruntime-web, no JSX and nothing from next/*.

import type { InferenceSession } from "onnxruntime-web";
import { buildSpeciesMask, classify, createSession, fetchModel, loadLabels } from "@/lib/birdnet";
import type { SpeciesEntry } from "@/lib/birdnet";
import type { WorkerRequest, WorkerResponse } from "@/lib/birdnetClient";

const scope = self as unknown as DedicatedWorkerGlobalScope;

let session: InferenceSession | null = null;
let labels: string[] = [];
let mask: Uint8Array | null = null;
let loading: Promise<{ allowed: number; unmatched: number }> | null = null;

const post = (message: WorkerResponse) => scope.postMessage(message);

async function load(origin: string, species: SpeciesEntry[]) {
    post({ type: "progress", phase: "labels" });
    labels = await loadLabels(origin);

    const built = buildSpeciesMask(labels, species);
    mask = built.mask;
    if (built.unmatched.length) {
        // Taxonomy drift between our list and BirdNET's (Oceanodroma -> Hydrobates and friends).
        // These species can never be detected, so say so rather than letting them vanish quietly.
        console.warn(`BirdNET: ${built.unmatched.length} dex species have no matching label, e.g.`, built.unmatched.slice(0, 5));
    }

    post({ type: "progress", phase: "download", received: 0, total: 1 });
    const model = await fetchModel((received, total) => post({ type: "progress", phase: "download", received, total }));

    post({ type: "progress", phase: "init" });
    session = await createSession(model, origin);

    return { allowed: built.allowed, unmatched: built.unmatched.length };
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const message = event.data;

    if (message.type === "load") {
        try {
            loading ??= load(message.origin, message.species);
            const stats = await loading;
            post({ type: "ready", ...stats });
        } catch (err) {
            loading = null; // let the next attempt retry instead of reusing the failure
            post({ type: "error", message: err instanceof Error ? err.message : String(err) });
        }
        return;
    }

    if (message.type === "classify") {
        if (!session) {
            post({ type: "error", message: "Model not loaded", id: message.id });
            return;
        }
        try {
            const result = await classify(session, labels, new Float32Array(message.samples), mask);
            post({ type: "result", id: message.id, result });
        } catch (err) {
            post({ type: "error", message: err instanceof Error ? err.message : String(err), id: message.id });
        }
    }
};
