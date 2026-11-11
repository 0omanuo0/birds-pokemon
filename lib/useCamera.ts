"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGetUserMedia } from "@/app/identify/getUserMedia";
import { applyZoomValue, zoomCapsOf } from "@/lib/camera";

// Everything about the camera for the identify page, in one hook: opening it, choosing between cameras, zoom, releasing it.
//
// How the camera is opened is deliberately the same as it always was, because Firefox on Android is picky about it:
// a plain { video: true } first (permission, so labels exist), then enumerate, then the chosen camera by exact deviceId.
//
// Zoom is kept in the camera's own units, like a phone camera app: 1 = the main lens, 0.5 = ultra-wide, 5 = a 5x tele.
// With hardware zoom (Chrome on Android) it goes to the camera, and on a phone with several lenses zooming in is what
// switches to the telephoto. Without it (Firefox) the preview is zoomed with CSS and the photo cropped to match.

export type Zoom = {
    value: number;                         // current zoom, camera units
    hardware: boolean;                     // true: the camera zooms; false: the page crops (CSS)
    min: number; max: number;              // what the wheel and the buttons can reach
    steps: number[];                       // the buttons
    set: (value: number) => void;
};

export type CameraOption = { id: string; label: string };

// zoom buttons worth showing, in camera units, filtered to what the camera can do
const PRESETS = [0.5, 1, 2, 3, 5, 10];
// without hardware zoom the crop gets soft quickly, so stop at 5x
const CSS_STEPS = [1, 2, 3, 5];

export function useCamera(active: boolean) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [options, setOptions] = useState<CameraOption[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [ready, setReady] = useState(false);
    const [denied, setDenied] = useState(false);

    const [savedId] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        try { return localStorage.getItem("selected_camera_id") || ""; } catch { return ""; }
    });

    // ── zoom ──
    const [range, setRange] = useState<{ min: number; max: number } | null>(null);
    const [value, setValue] = useState(1);
    const capsRef = useRef<ReturnType<typeof zoomCapsOf>>(null);
    const valueRef = useRef(1);
    const busyRef = useRef(false);

    async function syncZoom() {
        if (busyRef.current) return;
        busyRef.current = true;
        try {
            let applied: number;
            do {
                applied = valueRef.current;
                await applyZoomValue(streamRef.current?.getVideoTracks()[0], capsRef.current, applied);
            } while (applied !== valueRef.current);
        } catch { /* zoom is optional */ } finally {
            busyRef.current = false;
        }
    }

    const set = useCallback((v: number) => {
        const lo = capsRef.current ? capsRef.current.min : 1;
        const hi = capsRef.current ? Math.min(capsRef.current.max, 10) : 5;
        const next = Math.min(hi, Math.max(lo, v));
        valueRef.current = next;
        setValue(next);
        void syncZoom();
    }, []);

    // ── permission, then the camera list ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!window.isSecureContext) { console.error("Camera API only works in secure contexts (HTTPS or localhost)."); return; }
            const getUserMedia = getGetUserMedia();
            if (!getUserMedia) { console.error("No getUserMedia implementation found."); return; }

            try {
                const pre = await getUserMedia({ video: true });
                if (cancelled) { pre.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = pre;
            } catch (err) {
                console.warn("Camera denied or failed on first access", err);
                if (!cancelled) setDenied(true);
            }

            let inputs: MediaDeviceInfo[] = [];
            try {
                if (typeof navigator.mediaDevices?.enumerateDevices === "function") {
                    inputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
                }
            } catch (err) {
                console.warn("enumerateDevices() failed", err);
            }
            if (cancelled || !inputs.length || !inputs[0].deviceId) return;

            const opts = inputs.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
            setOptions(opts);
            // saved choice, else the second one (the rear camera on phones), else the only one
            setSelectedId(savedId && opts.some(o => o.id === savedId) ? savedId : (opts[1] ?? opts[0]).id);
        })();
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── start / stop the stream ──
    // Stopping the tracks is what turns the sensor off: track.enabled = false or pausing the <video> keeps the camera
    // pipeline running (and the phone warm) on Android.
    useEffect(() => {
        if (!active) {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            setReady(false);
            return;
        }
        let isActive = true;

        async function start() {
            if (!selectedId || !isActive) return;
            const getUserMedia = getGetUserMedia();
            if (!getUserMedia) return;
            streamRef.current?.getTracks().forEach(t => t.stop());
            setReady(false);

            try {
                const stream = await getUserMedia({
                    video: { deviceId: { exact: selectedId }, width: { ideal: 1920, max: 3840 }, height: { ideal: 1080, max: 2160 } },
                });
                if (!isActive) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setReady(true);
                setDenied(false);
            } catch (err) {
                console.error("Error starting camera:", err);
                return;
            }

            // Hardware zoom, strictly optional: nothing here may touch a stream that is already running.
            try {
                const caps = zoomCapsOf(streamRef.current?.getVideoTracks()[0]);
                capsRef.current = caps;
                setRange(caps ? { min: caps.min, max: caps.max } : null);
                // every start opens on the main lens (1x), whatever the wheel was left at
                valueRef.current = 1;
                setValue(1);
                void syncZoom();
            } catch (err) {
                console.warn("Zoom not available:", err);
            }
        }

        function onVisibility() {
            if (document.hidden) {
                streamRef.current?.getTracks().forEach(t => t.stop());
                if (videoRef.current) videoRef.current.srcObject = null;
                setReady(false);
            } else {
                void start();
            }
        }

        document.addEventListener("visibilitychange", onVisibility);
        void start();
        try { if (selectedId) localStorage.setItem("selected_camera_id", selectedId); } catch { /* optional */ }
        return () => { isActive = false; document.removeEventListener("visibilitychange", onVisibility); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, active]);

    const hardware = !!range;
    const lo = range ? range.min : 1;
    const hi = range ? Math.min(range.max, 10) : 5;
    const steps = hardware
        ? PRESETS.filter(p => p >= lo - 1e-6 && p <= hi + 1e-6)
        : CSS_STEPS;

    const zoom: Zoom = { value, hardware, min: lo, max: hi, steps, set };

    // the camera that is open, for the switch button
    const at = Math.max(0, options.findIndex(o => o.id === selectedId));
    const current = options[at];
    const facing: "rear" | "front" | null = !current ? null
        : /back|rear|environment|trasera/i.test(current.label) ? "rear"
        : /front|user|selfie|frontal/i.test(current.label) ? "front" : null;
    const cycle = () => { if (options.length > 1) setSelectedId(options[(at + 1) % options.length].id); };

    return { videoRef, streamRef, ready, denied, zoom, camera: { count: options.length, index: at, facing, cycle } };
}
