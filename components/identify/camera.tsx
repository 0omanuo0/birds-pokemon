"use client";

import { useEffect, useState } from "react";
import CameraSelector, { type CameraStatus } from "./cameraSelector";

const STATUS_TEXT: Record<CameraStatus, { title: string; hint: string } | null> = {
    starting: { title: "Starting camera", hint: "" },
    denied: { title: "Camera blocked", hint: "Allow camera access for Birds Dex in your phone's settings, then try again." },
    unsupported: { title: "No camera", hint: "This device or browser can't open the camera. You can still upload a photo." },
    error: { title: "Camera unavailable", hint: "Another app may be using it. Close it and try again." },
    // the result or an error is covering the screen; keep it dark, no text
    off: null,
};

// shown whenever the <video> isn't playing, so the screen never sits blank or white
function CameraPlaceholder({ status, onRetry }: { status: CameraStatus; onRetry: () => void }) {
    const text = STATUS_TEXT[status];
    const failed = status === "denied" || status === "unsupported" || status === "error";

    return (
        <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-hidden bg-neutral-900 px-6 text-center"
            style={{
                borderRadius: 8,
                backgroundImage:
                    "linear-gradient(#ffffff0a 1px, transparent 1px), linear-gradient(90deg, #ffffff0a 1px, transparent 1px)",
                backgroundSize: "24px 24px",
            }}
        >
            {/* viewfinder corners */}
            <span className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-neutral-600" aria-hidden />
            <span className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-neutral-600" aria-hidden />
            <span className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-neutral-600" aria-hidden />
            <span className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-neutral-600" aria-hidden />

            {text && (
                <>
                    <svg
                        viewBox="0 0 24 24"
                        className={"h-12 w-12 " + (failed ? "text-red-400" : "animate-pulse text-neutral-400")}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="square"
                        aria-hidden
                    >
                        <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                        <circle cx="12" cy="13" r="3.5" />
                        {failed && <path d="M3 21 21 3" />}
                    </svg>
                    <p className="font-pokemon text-sm uppercase tracking-widest text-neutral-200">
                        {text.title}
                        {!failed && <span className="animate-pulse">…</span>}
                    </p>
                    {text.hint && <p className="max-w-[260px] text-xs text-neutral-400">{text.hint}</p>}
                    {failed && status !== "unsupported" && (
                        <button
                            onClick={onRetry}
                            className="z-20 mt-1 cursor-pointer border-2 border-neutral-700/70 bg-red-400 px-4 py-1 font-pokemon text-sm uppercase tracking-wider text-black"
                        >
                            Try again
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

export default function CameraComponent(
    {
        videoRef,
        streamRef,
        scale,
        active = true,
    }: {
        videoRef: React.RefObject<HTMLVideoElement | null>;
        streamRef: React.RefObject<MediaStream | null>;
        scale: number;
        active?: boolean;
    }) {
    const [status, setStatus] = useState<CameraStatus>("starting");
    const [playing, setPlaying] = useState(false);
    // remounting the selector asks for the camera again from scratch
    const [attempt, setAttempt] = useState(0);

    // the video says when frames are really showing; until then (or after the stream is dropped) show the placeholder
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const on = () => setPlaying(true);
        const off = () => setPlaying(false);
        video.addEventListener("playing", on);
        video.addEventListener("emptied", off);
        video.addEventListener("pause", off);
        video.addEventListener("ended", off);
        setPlaying(!video.paused && video.readyState >= 3);
        return () => {
            video.removeEventListener("playing", on);
            video.removeEventListener("emptied", off);
            video.removeEventListener("pause", off);
            video.removeEventListener("ended", off);
        };
    }, [videoRef]);

    return (
        <div style={{ position: 'relative', height: "100%", width: "100%" }} >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width={1920}
                height={1080}
                style={{
                    borderRadius: 8, objectFit: 'cover', width: "100%", height: "100%",
                    transform: `scale(${scale})`,
                }}
            />

            {!playing && <CameraPlaceholder status={status} onRetry={() => { setStatus("starting"); setAttempt(a => a + 1); }} />}

            <div className="absolute bottom-0 left-0 z-20 w-full h-16 bg-gradient-to-t from-black to-transparent flex items-end justify-center">
                <CameraSelector
                    key={attempt}
                    videoRef={videoRef}
                    streamRef={streamRef}
                    active={active}
                    onStatus={setStatus}
                />
            </div>
        </div >
    );
}
