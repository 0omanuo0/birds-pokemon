"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioRing } from "@/lib/audioRing";
import { MODEL_BYTES_APPROX, SAMPLE_RATE, WINDOW_SAMPLES, isModelCached, isNonEventLabel, resampleInto } from "@/lib/birdnet";
import type { LoadProgress, Prediction, SpeciesEntry } from "@/lib/birdnet";
import { ActivityGate, highPassInPlace, peakFrameDbfs } from "@/lib/audioGate";
import { createBirdnetClient, type BirdnetClient, type MaskStats } from "@/lib/birdnetClient";
import { startMicCapture, type MicCapture } from "@/lib/micCapture";
import { regionAt } from "@/lib/regions";
import type { SpeciesListResponse } from "@/app/api/birds/species/route";

export type ListenerStatus = "idle" | "confirm" | "loading" | "listening" | "error";
export type ErrorKind = "mic" | "model" | "inference";
export type DetectedBird = {
    scientificName: string;
    commonName: string; // BirdNET's; the row prefers the dex name when the species is in our list
    bestScore: number;
    count: number;
    lastSeen: number;
};

// BirdNET-Go — the live-audio consumer of this exact ONNX file — ships threshold 0.7. The Analyzer's
// lower 0.25 default assumes a species list plus a human reading the selection table afterwards,
// which is not this.
const CONFIDENCE_THRESHOLD = 0.7;
// How often a new 3s window is classified: 1.5s hop = 1.5s overlap, matching BirdNET-Go's shipped
// value, so a call straddling a boundary still lands whole inside one window.
const BASE_HOP_MS = 1500;
// One window's worth of audio is classified twice, so counting every confident hit would inflate the
// tally. Re-hearing a species inside this gap refreshes it instead of re-counting it.
const MERGE_MS = 3000;
// A species is not listed on its first confident window. The second hit has to be at least one whole
// window later, so the two come from genuinely disjoint audio rather than the same call seen through
// two overlapping windows — that is what a single lucky window can't fake.
const CONFIRM_GAP_MS = 3000;
// ...unless it is this confident, in which case waiting is just making the user wonder if it works.
// BirdWeather auto-publishes BirdNET detections at 0.9, so a single window at that level is already
// treated as reportable by people running this model at scale.
const INSTANT_THRESHOLD = 0.9;
// A half-heard species that never finds a partner shouldn't wait forever holding its first hit.
const PENDING_TTL_MS = 60000;

export type BirdListener = {
    status: ListenerStatus;
    error: ErrorKind | null;
    progress: LoadProgress | null;
    predictions: Prediction[];
    detected: DetectedBird[];
    ring: AudioRing | null;
    sampleRate: number;
    /** "worker" | "main" once a model has been loaded — which path the inference actually took. */
    mode: string | null;
    /** True while the mic is open but too quiet to be worth classifying. */
    tooQuiet: boolean;
    /** Set when the model's own best guess is a non-event class (an engine, a voice, a dog). */
    backgroundNoise: boolean;
    /** Mask stats + live input level, for calibrating the gate on a real device. */
    diagnostics: { allowed: number; unmatched: number; levelDb: number; floorDb: number } | null;
    /** Starts listening; asks for confirmation first if the model still has to be downloaded. */
    request: () => Promise<void>;
    /** Proceeds past the download confirmation. */
    confirm: () => Promise<void>;
    stop: () => void;
    clear: () => void;
    dismissError: () => void;
};

/**
 * The dex's scientific names, which become the model's allowed-class list.
 *
 * Narrowed by region only when the browser already has a position to hand — `maximumAge: Infinity`
 * plus a short timeout means this reads a cached fix or gives up, so pressing REC never turns into a
 * location prompt. Without one the full list is used, which is still a 12x cut from 6522 classes.
 */
async function loadSpeciesList(): Promise<SpeciesEntry[]> {
    let region: string | null = null;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
        region = await new Promise<string | null>(resolve => {
            navigator.geolocation.getCurrentPosition(
                pos => resolve(regionAt(pos.coords.latitude, pos.coords.longitude)),
                () => resolve(null),
                { maximumAge: Infinity, timeout: 1500, enableHighAccuracy: false },
            );
        });
    }

    const response = await fetch(`/api/birds/species${region ? `?region=${region}` : ""}`);
    if (!response.ok) throw new Error(`Species list failed (${response.status})`);
    const data: SpeciesListResponse = await response.json();
    if (!data.species?.length) throw new Error("Species list is empty");
    return data.species;
}

export function useBirdListener(): BirdListener {
    const [status, setStatus] = useState<ListenerStatus>("idle");
    const [error, setError] = useState<ErrorKind | null>(null);
    const [progress, setProgress] = useState<LoadProgress | null>(null);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [detected, setDetected] = useState<Record<string, DetectedBird>>({});
    const [ring, setRing] = useState<AudioRing | null>(null);
    const [sampleRate, setSampleRate] = useState(SAMPLE_RATE);
    const [mode, setMode] = useState<string | null>(null);
    const [tooQuiet, setTooQuiet] = useState(false);
    const [backgroundNoise, setBackgroundNoise] = useState(false);
    const [diagnostics, setDiagnostics] = useState<BirdListener["diagnostics"]>(null);

    const clientRef = useRef<BirdnetClient | null>(null);
    const captureRef = useRef<MicCapture | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const busyRef = useRef(false);
    const gateRef = useRef(new ActivityGate());
    // Mirrors `detected`, so the merge logic can read the current list without doing its work inside
    // a setState updater — see the comment in mergeDetections for why that mattered.
    const detectedRef = useRef<Record<string, DetectedBird>>({});
    // species heard once above threshold, waiting for a second hit from disjoint audio
    const pendingRef = useRef(new Map<string, { firstAt: number; commonName: string; best: number }>());
    const maskStatsRef = useRef<MaskStats>({ allowed: 0, unmatched: 0 });
    // bumped by every stop/unmount, so an inference that resolves afterwards is discarded instead of
    // writing into state that no longer belongs to a live session
    const genRef = useRef(0);

    // Refs only: safe to call from an effect cleanup, unlike stop() which also touches state.
    const releaseAudio = useCallback(() => {
        genRef.current++;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        busyRef.current = false;
        captureRef.current?.stop();
        captureRef.current = null;
        gateRef.current.reset();
        pendingRef.current.clear();
    }, []);

    useEffect(() => {
        return () => {
            releaseAudio();
            clientRef.current?.dispose();
            clientRef.current = null;
        };
    }, [releaseAudio]);

    const mergeDetections = useCallback((top: Prediction[]) => {
        const now = Date.now();
        const pending = pendingRef.current;

        // a first hit that never found its partner is stale, not evidence
        for (const [name, entry] of pending) if (now - entry.firstAt > PENDING_TTL_MS) pending.delete(name);

        // The species mask already removed non-event classes and anything outside the dex, so
        // everything arriving here is a plausible local bird; all that's left is confidence.
        const confident = top.filter(p => p.score >= CONFIDENCE_THRESHOLD);
        if (confident.length === 0) return;

        // All bookkeeping happens here, never inside the setDetected updater. React may invoke an
        // updater more than once for a single update — StrictMode does it on every render in dev —
        // and it keeps only the last result. An earlier version promoted species from inside the
        // updater while mutating `pending`: the first invocation deleted the pending entry and
        // returned state containing the bird, then the second saw no pending entry, re-added one
        // with a fresh timestamp and returned the unchanged state. The promotion was discarded and
        // the confirmation timer reset every time it was about to fire, so a bird could sing at 85%
        // forever without ever being listed. Updaters must be pure; the refs are updated out here.
        const detected = detectedRef.current;
        let changed = false;
        const next = { ...detected };

        for (const { scientificName, commonName, score } of confident) {
            const existing = detected[scientificName];

            if (existing) {
                next[scientificName] = {
                    ...existing,
                    bestScore: Math.max(existing.bestScore, score),
                    count: now - existing.lastSeen < MERGE_MS ? existing.count : existing.count + 1,
                    lastSeen: now,
                };
                changed = true;
                continue;
            }

            // Not listed yet: needs a second confident window, one whole window later, before it
            // earns a place. A single bad window can otherwise add a species permanently, which
            // matters here because the list accumulates for the whole session.
            const first = pending.get(scientificName);
            if (score < INSTANT_THRESHOLD) {
                if (!first) {
                    pending.set(scientificName, { firstAt: now, commonName, best: score });
                    continue;
                }
                if (now - first.firstAt < CONFIRM_GAP_MS) {
                    first.best = Math.max(first.best, score);
                    continue;
                }
            }

            pending.delete(scientificName);
            next[scientificName] = {
                scientificName,
                commonName,
                bestScore: Math.max(first?.best ?? 0, score),
                count: 1,
                lastSeen: now,
            };
            changed = true;
        }

        if (!changed) return;
        detectedRef.current = next;
        setDetected(next);
    }, []);

    // Self-rescheduling rather than setInterval: the delay adapts to how long inference actually
    // takes, so a slow phone paces itself instead of queueing work it can never catch up on.
    const scheduleInference = useCallback(
        (capture: MicCapture, generation: number, delay: number, raw: Float32Array, conditioned: Float32Array) => {
            timerRef.current = setTimeout(async () => {
                if (genRef.current !== generation) return;

                const client = clientRef.current;
                let elapsed = 0;

                // busy can't happen with this scheduling, but a window that isn't full yet can:
                // the first ~3s after Start, we just wait for more audio.
                if (client && !busyRef.current && capture.ring.read(raw, capture.ring.totalWritten)) {
                    // Condition first, then measure, so the gate judges exactly the signal the model
                    // will see rather than one with rumble still in it. The spectrogram reads the ring
                    // directly and is unaffected — the display should show what's really out there.
                    resampleInto(raw, capture.sampleRate, conditioned);
                    highPassInPlace(conditioned, SAMPLE_RATE);

                    const levelDb = peakFrameDbfs(conditioned, SAMPLE_RATE);
                    const gate = gateRef.current;
                    const loud = gate.accept(levelDb);

                    setDiagnostics({ ...maskStatsRef.current, levelDb, floorDb: gate.floorDb });
                    setTooQuiet(!loud);

                    // The model min-max normalizes its input internally, so handing it silence means
                    // handing it mic hiss amplified to full scale — which it confidently calls an
                    // engine. Skipping the window is the only correct answer, and it's free CPU.
                    if (!loud) {
                        setPredictions([]);
                        setBackgroundNoise(false);
                    } else {
                        busyRef.current = true;
                        const startedAt = performance.now();
                        try {
                            // fresh copy only now: it gets transferred to the worker, which would
                            // detach the buffer we reuse every window
                            const { top, rawTop } = await client.classify(new Float32Array(conditioned));
                            if (genRef.current !== generation) return;
                            setPredictions(top);
                            // the model's own best guess is a voice/engine/dog: say so rather than
                            // quietly promoting whatever bird came second
                            setBackgroundNoise(isNonEventLabel(rawTop.label) && rawTop.score >= CONFIDENCE_THRESHOLD);
                            mergeDetections(top);
                        } catch (err) {
                            console.error("BirdNET inference failed:", err);
                        } finally {
                            busyRef.current = false;
                            elapsed = performance.now() - startedAt;
                        }
                    }
                }

                if (genRef.current !== generation) return;
                // leave the device some headroom: never spend more than ~two thirds of the time
                // classifying, however slow it turns out to be
                scheduleInference(capture, generation, Math.max(BASE_HOP_MS, elapsed * 1.5), raw, conditioned);
            }, delay);
        },
        [mergeDetections],
    );

    const begin = useCallback(async () => {
        setStatus("loading");
        setError(null);
        setProgress({ phase: "labels" });

        try {
            const species = await loadSpeciesList();
            clientRef.current ??= createBirdnetClient();
            setMode(clientRef.current.mode);
            maskStatsRef.current = await clientRef.current.load(species, setProgress);
            setDiagnostics({ ...maskStatsRef.current, levelDb: -Infinity, floorDb: Number.NaN });
        } catch (err) {
            console.error("BirdNET model load failed:", err);
            setError("model");
            setStatus("error");
            return;
        }

        try {
            const capture = await startMicCapture();
            captureRef.current = capture;
            const generation = ++genRef.current;
            setRing(capture.ring);
            setSampleRate(capture.sampleRate);
            setStatus("listening");
            setProgress(null);
            // allocated once per session rather than per tick: at 48kHz these are 576KB each, and
            // churning them every window for the whole time the page listens is pointless GC pressure
            const raw = new Float32Array(Math.ceil(WINDOW_SAMPLES * (capture.sampleRate / SAMPLE_RATE)));
            const conditioned = new Float32Array(WINDOW_SAMPLES);
            // first run once the ring can hold a full window
            scheduleInference(capture, generation, 3000, raw, conditioned);
        } catch (err) {
            console.error("Microphone unavailable:", err);
            setError("mic");
            setStatus("error");
        }
    }, [scheduleInference]);

    const request = useCallback(async () => {
        // Only ask about the ~39MB download the first time; once it's cached, Start just starts.
        if (await isModelCached()) {
            await begin();
            return;
        }
        setStatus("confirm");
    }, [begin]);

    const stop = useCallback(() => {
        releaseAudio();
        setRing(null);
        setPredictions([]);
        setProgress(null);
        setTooQuiet(false);
        setBackgroundNoise(false);
        setStatus("idle");
    }, [releaseAudio]);

    return {
        status,
        error,
        progress,
        predictions,
        detected: Object.values(detected).sort((a, b) => b.lastSeen - a.lastSeen),
        ring,
        sampleRate,
        mode,
        tooQuiet,
        backgroundNoise,
        diagnostics,
        request,
        confirm: begin,
        stop,
        clear: useCallback(() => {
            detectedRef.current = {};
            pendingRef.current.clear();
            setDetected({});
        }, []),
        dismissError: useCallback(() => {
            setError(null);
            setStatus("idle");
        }, []),
    };
}

export { CONFIDENCE_THRESHOLD, MODEL_BYTES_APPROX };
