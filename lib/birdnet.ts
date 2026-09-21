// BirdNET-v2.4 (https://huggingface.co/tphakala/BirdNET-v2.4, int8_arm build) run entirely in the
// browser with onnxruntime-web. No audio ever leaves the device.
//
// Deliberately free of React and DOM APIs so the worker and the main-thread fallback can share it
// verbatim — the only browser globals used here are fetch and caches, both available in workers.

// The "/wasm" subpath, not the package root: ORT's default entry is the WebGPU bundle, which loads
// ort-wasm-simd-threaded.jsep.mjs (28MB) and fails outright if only the plain binary is hosted. We
// only ever use the wasm execution provider, so this entry is both the right one and the smaller one.
import type { InferenceSession } from "onnxruntime-web";

// The _dfttrunc build truncates the in-graph mel DFT to the bins the filterbank actually reads.
// The publisher states it is bit-exact with the plain build and ~1.4-2x faster, and recommends it
// ("the non-dfttrunc files are kept for existing installs") — 38.7MB instead of 46.9MB for identical
// output. The int8 quantization, which is a separate axis, is applied only to the 1024x6522
// classification head and is documented at ~98% top-1 agreement with FP32.
const MODEL_URL = "https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/BirdNET_v2.4_int8_arm_dfttrunc.onnx";
const LABELS_PATH = "/birdnet/labels.txt";
const MODEL_CACHE = "birdnet-model-v2";
const STALE_MODEL_CACHES = ["birdnet-model-v1"]; // the 46.9MB non-dfttrunc build, now superseded

export const SAMPLE_RATE = 48000;
export const WINDOW_SAMPLES = SAMPLE_RATE * 3; // BirdNET analyzes fixed 3s clips
export const MODEL_BYTES_APPROX = 39 * 1024 * 1024; // for the consent dialog and as a progress fallback

export type Prediction = { scientificName: string; commonName: string; score: number };
export type LoadPhase = "labels" | "download" | "init";
export type LoadProgress = { phase: LoadPhase; received?: number; total?: number };

// Labels are "Scientific name_Common name".
export function parseLabel(label: string): { scientificName: string; commonName: string } {
    const sep = label.indexOf("_");
    return sep === -1
        ? { scientificName: label, commonName: label }
        : { scientificName: label.slice(0, sep), commonName: label.slice(sep + 1) };
}

// The 11 non-event classes, enumerated in BirdNET's FAQ rather than guessed at. The previous
// heuristic ("a real binomial has a space in it") quietly let four of these through as birds:
// Human vocal, Human non-vocal, Human whistle and Power tools all contain a space.
// Per Cornell, Noise_Noise and Environmental_Environmental are training-only auxiliaries the model
// never actually predicts; the other nine do get predicted, constantly, on live mic input.
export const NON_EVENT_CLASSES = new Set([
    "Dog_Dog",
    "Engine_Engine",
    "Environmental_Environmental",
    "Fireworks_Fireworks",
    "Gun_Gun",
    "Human non-vocal_Human non-vocal",
    "Human vocal_Human vocal",
    "Human whistle_Human whistle",
    "Noise_Noise",
    "Power tools_Power tools",
    "Siren_Siren",
]);

export function isNonEventLabel(label: string): boolean {
    return NON_EVENT_CLASSES.has(label);
}

/** One entry of the dex's species list, as the mask builder needs it. */
export type SpeciesEntry = { scientificName: string; nameEn?: string | null };

/**
 * Builds the per-class allow mask the classifier scores against, aligned index-for-index with
 * `labels`. `species` is the dex's own list — the set of birds we are willing to hear.
 *
 * Restricting the class list is not optional polish: BirdNET's reference tooling always applies a
 * species list (by lat/lon/week, or from a file) before scoring, and running all 6522 global classes
 * unrestricted is exactly why species that don't occur here get reported.
 *
 * Matching is by scientific name, then by English common name. The fallback is not redundant: our
 * list and BirdNET's follow different taxonomies, so Larus audouinii is Ichthyaetus audouinii here,
 * Tachymarptis melba is Apus melba, and so on. Measured against the live dex, the common-name pass
 * recovers 21 species that the scientific name alone leaves permanently undetectable — among them
 * Audouin's, Mediterranean and Laughing Gull and Alpine Swift, none of them obscure.
 *
 * Returns the mask plus the entries that matched nothing, so a species we simply cannot hear is
 * visible rather than silently missing.
 */
export function buildSpeciesMask(labels: string[], species: Iterable<SpeciesEntry>):
    { mask: Uint8Array; allowed: number; unmatched: string[] } {
    const bySci = new Map<string, SpeciesEntry>();
    const byCommon = new Map<string, SpeciesEntry>();
    const matched = new Set<SpeciesEntry>();
    const all: SpeciesEntry[] = [];

    for (const entry of species) {
        all.push(entry);
        const sci = entry.scientificName?.trim().toLowerCase();
        if (sci) bySci.set(sci, entry);
        const en = entry.nameEn?.trim().toLowerCase();
        if (en) byCommon.set(en, entry);
    }

    const mask = new Uint8Array(labels.length);
    let allowed = 0;
    for (let i = 0; i < labels.length; i++) {
        if (isNonEventLabel(labels[i])) continue;
        const { scientificName, commonName } = parseLabel(labels[i]);
        const entry = bySci.get(scientificName.toLowerCase()) ?? byCommon.get(commonName.toLowerCase());
        if (!entry) continue;
        matched.add(entry);
        mask[i] = 1;
        allowed++;
    }

    const unmatched = all.filter(entry => !matched.has(entry)).map(entry => entry.scientificName);
    return { mask, allowed, unmatched };
}

function sigmoid(x: number) {
    return 1 / (1 + Math.exp(-x));
}

/**
 * Linear-interpolation resample to SAMPLE_RATE, written into a caller-owned buffer.
 *
 * The buffer is reused across windows because most windows are rejected by the gate before they are
 * ever classified, and allocating 576KB for each of those would be pure GC churn. The copy that goes
 * to the model is taken only once a window is accepted — it has to be a fresh, offset-0 array there,
 * since it is handed to ort.Tensor and transferred to the worker, and a subarray view survives
 * neither cleanly.
 *
 * Note this path is usually a straight copy: AudioContext is opened at 48kHz and, per spec, the
 * mic's hardware rate is converted to the context rate by createMediaStreamSource using the
 * browser's own resampler. This only does real work where that request isn't honoured (Safari).
 */
export function resampleInto(input: Float32Array, inputRate: number, out: Float32Array) {
    if (inputRate === SAMPLE_RATE) {
        out.set(input.subarray(0, Math.min(input.length, out.length)));
        return;
    }
    const ratio = inputRate / SAMPLE_RATE;
    for (let i = 0; i < out.length; i++) {
        const srcPos = i * ratio;
        const i0 = Math.floor(srcPos);
        const i1 = Math.min(i0 + 1, input.length - 1);
        const frac = srcPos - i0;
        out[i] = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac;
    }
}

/**
 * The page's origin, read on the main thread and handed to the worker.
 *
 * A worker can't resolve root-relative URLs itself: depending on how the bundler created it,
 * `self.location` is a blob: URL with no usable base, and both fetch("/birdnet/labels.txt") and
 * ORT's wasmPaths = "/onnx/" fail outright ("not a valid URL"). Everything that loads an app asset
 * therefore takes this explicitly rather than assuming a base exists.
 */
export function pageOrigin(): string {
    return location.origin;
}

export async function loadLabels(origin: string): Promise<string[]> {
    const response = await fetch(`${origin}${LABELS_PATH}`);
    if (!response.ok) throw new Error(`Labels download failed (${response.status})`);
    const text = await response.text();
    return text.split("\n").map(line => line.trim()).filter(Boolean);
}

/** True when the model is already in the browser's cache, i.e. no download is about to happen. */
export async function isModelCached(): Promise<boolean> {
    if (typeof caches === "undefined") return false;
    try {
        const cache = await caches.open(MODEL_CACHE);
        return (await cache.match(MODEL_URL)) !== undefined;
    } catch {
        return false;
    }
}

/**
 * Fetches the ~39MB model, keeping it in the Cache API so it is downloaded once per browser rather
 * than once per visit. Read through a stream reader so the UI can show real progress on what is by
 * far the longest step.
 */
export async function fetchModel(onProgress?: (received: number, total: number) => void): Promise<Uint8Array> {
    const cache = typeof caches !== "undefined" ? await caches.open(MODEL_CACHE).catch(() => null) : null;

    const cached = await cache?.match(MODEL_URL);
    if (cached) return new Uint8Array(await cached.arrayBuffer());

    // Nothing cached under the current key, so anyone arriving here on an older build is still
    // holding its model. Drop it now rather than leaving ~47MB of dead weight in browser storage.
    if (typeof caches !== "undefined") {
        await Promise.all(STALE_MODEL_CACHES.map(name => caches.delete(name).catch(() => false)));
    }

    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Model download failed (${response.status})`);

    // Content-Length is missing on some CDN paths; fall back to the known size so the bar still moves.
    const total = Number(response.headers.get("content-length")) || MODEL_BYTES_APPROX;
    const reader = response.body?.getReader();

    let bytes: Uint8Array;
    if (!reader) {
        bytes = new Uint8Array(await response.arrayBuffer());
    } else {
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            onProgress?.(received, total);
        }
        bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
    }

    // a full copy, because cache.put consumes the buffer it is handed
    await cache?.put(MODEL_URL, new Response(bytes.slice().buffer)).catch(() => {});
    return bytes;
}

export async function createSession(model: Uint8Array, origin: string): Promise<InferenceSession> {
    const ort = await import("onnxruntime-web/wasm");
    // Served from public/onnx (copied from node_modules by the postinstall script) rather than a CDN:
    // the binaries can never drift from the installed package version, and it works offline.
    // Absolute, for the same reason loadLabels takes an origin.
    ort.env.wasm.wasmPaths = `${origin}/onnx/`;
    return ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
}

export type ClassifyResult = {
    /** Best allowed classes, descending. Empty when nothing in the species list scored at all. */
    top: Prediction[];
    /** The single best class overall, ignoring the mask — non-event classes included. */
    rawTop: { label: string; score: number };
};

/**
 * One 3s clip → the best allowed classes, sorted descending and sliced to `topN`.
 *
 * Slicing inside this function matters when it runs in a worker: posting all 6522 scored labels back
 * every window would cost more than the inference. But that is exactly why `mask` has to be applied
 * BEFORE the sort — filtering a top-15 afterwards would throw away a local bird that ranked 16th
 * behind fifteen species that don't occur here, which is the failure this mask exists to fix.
 *
 * `rawTop` is reported separately so the UI can say "background noise" honestly when the model's
 * actual best guess is an engine or a voice, instead of silently promoting the runner-up bird.
 */
export async function classify(
    session: InferenceSession,
    labels: string[],
    samples48k: Float32Array,
    mask: Uint8Array | null,
    topN = 15,
): Promise<ClassifyResult> {
    const ort = await import("onnxruntime-web/wasm");
    const tensor = new ort.Tensor("float32", samples48k, [1, WINDOW_SAMPLES]);
    // by name rather than hard-coded "input"/"output": removes a whole class of "the model loaded
    // but outputs.output is undefined"
    const outputs = await session.run({ [session.inputNames[0]]: tensor });
    const logits = outputs[session.outputNames[0]].data as Float32Array;

    const scored: Prediction[] = [];
    let bestIndex = 0;
    for (let i = 0; i < logits.length; i++) {
        if (logits[i] > logits[bestIndex]) bestIndex = i;
        if (mask && !mask[i]) continue;
        const { scientificName, commonName } = parseLabel(labels[i] ?? `#${i}`);
        scored.push({ scientificName, commonName, score: sigmoid(logits[i]) });
    }
    scored.sort((a, b) => b.score - a.score);

    return {
        top: scored.slice(0, topN),
        rawTop: { label: labels[bestIndex] ?? `#${bestIndex}`, score: sigmoid(logits[bestIndex]) },
    };
}
