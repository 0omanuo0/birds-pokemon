"use client";

import { useEffect, useRef } from "react";
import type { AudioRing } from "@/lib/audioRing";
import { COLS, FFT_SIZE, ROWS, SpectrogramColumns, SpectrogramRenderer, hopFor } from "@/lib/spectrogram";

/**
 * Realtime spectrogram: X is time (scrolling left), Y is frequency (low at the bottom) and
 * brightness is that frequency's level, with anything standing clearly above the rolling noise floor
 * drawn in yellow.
 *
 * The picture is computed here, in an animation frame, and never in the audio callback: the ring
 * buffer decouples the two, so a slow frame costs a column rather than stalling capture.
 */
export default function Spectrogram({
    ring,
    sampleRate,
    active,
    className = "",
}: {
    ring: AudioRing | null;
    sampleRate: number;
    active: boolean;
    className?: string;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const rendererRef = useRef<SpectrogramRenderer | null>(null);
    const scaleRef = useRef({ x: 1, y: 1 });

    // The renderer owns a canvas, so it can't be built during render (SSR has no document).
    useEffect(() => {
        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (!canvas || !host) return;

        ctxRef.current = canvas.getContext("2d");
        rendererRef.current = new SpectrogramRenderer();

        const resize = () => {
            const ctx = ctxRef.current;
            if (!ctx) return;
            // We're upscaling, so devicePixelRatio only picks an integer pixel size. The canvas must
            // never be scaled again by CSS or the browser resamples it smoothly and undoes the point.
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            const sx = Math.max(1, Math.floor((host.clientWidth * dpr) / COLS));
            const sy = Math.max(1, Math.floor((host.clientHeight * dpr) / ROWS));
            canvas.width = COLS * sx;
            canvas.height = ROWS * sy;
            canvas.style.width = `${(COLS * sx) / dpr}px`;
            canvas.style.height = `${(ROWS * sy) / dpr}px`;
            scaleRef.current = { x: sx, y: sy };
            // resizing a canvas clears it and resets the context, so repaint what was there
            rendererRef.current?.blit(ctx, sx, sy);
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const renderer = rendererRef.current;
        const ctx = ctxRef.current;
        if (!renderer || !ctx) return;

        if (!ring || !active) {
            renderer.clear();
            renderer.blit(ctx, scaleRef.current.x, scaleRef.current.y);
            return;
        }

        const columns = new SpectrogramColumns(sampleRate);
        const hop = hopFor(sampleRate);
        const frame = new Float32Array(FFT_SIZE);
        const column = new Uint8Array(ROWS);
        let nextEnd = ring.totalWritten + FFT_SIZE; // absolute end of the next column to draw
        let raf = 0;

        const tick = () => {
            raf = requestAnimationFrame(tick);
            const written = ring.totalWritten;

            // Fell behind — a hidden tab, or a long task on the main thread. Jump to the newest audio
            // rather than catching up column by column: those bursts are exactly what made the old
            // version freeze and then lurch every 3 seconds.
            if (written - nextEnd > ring.capacity - FFT_SIZE) nextEnd = written;

            let drawn = 0;
            while (nextEnd <= written && drawn < 6) {
                if (ring.read(frame, nextEnd)) {
                    columns.compute(frame, column);
                    renderer.pushColumn(column);
                    drawn++;
                }
                nextEnd += hop;
            }
            // ~27 columns/s against 60fps: most frames have nothing new and skip the blit entirely
            if (drawn) renderer.blit(ctx, scaleRef.current.x, scaleRef.current.y);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [ring, sampleRate, active]);

    return (
        <div ref={hostRef} className={`relative flex items-center justify-center overflow-hidden ${className}`}>
            <canvas
                ref={canvasRef}
                aria-label="Live frequency spectrogram"
                role="img"
                style={{ imageRendering: "pixelated" }}
            />
        </div>
    );
}
