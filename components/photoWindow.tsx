"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import type { MosaicTile } from "@/lib/mosaicAtlas";

// The photo window from docs/CONCEPT.md §5c (docs/mockup.html, docs/photo-lab.html): every photo sits in
// the screen the same way, whatever was uploaded. Pixel-cut corners, a thin dark inner edge, a soft
// vignette and scanlines like the screen glass, and a faint glow of the photo's own dominant colour.
// The photo itself only gets a small bounded grade.
//
// locked = a bird not met yet: a grey, darkened mosaic of the (reference) photo with a "?", so a shape
// emerges without giving the bird away.

const CUT_2 = "polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))";
const GLASS = [
    "repeating-linear-gradient(to bottom, #0000 0 2px, #0000000f 2px 3px)",
    "radial-gradient(ellipse at 50% 45%, transparent 52%, rgba(8,8,10,.38) 100%)",
].join(", ");
// mosaic blocks across the shorter side of the window
const MOSAIC_BLOCKS = 10;

type Grade = { br: number; sat: number; con: number };
type Loaded = { src: string; image: HTMLImageElement | null; dom: string | null; grade: Grade | null };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// mean lightness / saturation and a saturation-weighted dominant colour, from a 40x40 sample.
// Needs CORS on cross-origin images; without it the photo just shows ungraded.
function analyse(image: HTMLImageElement): { dom: string; grade: Grade } | null {
    try {
        const c = document.createElement("canvas");
        c.width = c.height = 40;
        const x = c.getContext("2d", { willReadFrequently: true })!;
        x.drawImage(image, 0, 0, 40, 40);
        const d = x.getImageData(0, 0, 40, 40).data;
        let L = 0, S = 0, n = 0, r = 0, g = 0, b = 0, ws = 0;
        for (let i = 0; i < d.length; i += 4) {
            const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
            const l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
            L += l; S += s; n++;
            const w = s * (1 - Math.abs(l - .5) * 1.6) + .02;
            r += R * w; g += G * w; b += B * w; ws += w;
        }
        L /= n; S /= n;
        return {
            dom: `rgb(${Math.round(r / ws)},${Math.round(g / ws)},${Math.round(b / ws)})`,
            // tiny bounded nudges: tame an over-bright or neon photo without flattening it
            grade: { br: clamp(1 + (.46 - L) * .4, .88, 1.12), sat: S > .42 ? clamp(1 - (S - .42) * 1.1, .78, 1) : 1.03, con: 1.04 },
        };
    } catch {
        return null;
    }
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        if (cors) image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

// cover-crops the image into a tiny canvas; CSS scales it up with pixelated rendering
function drawMosaic(canvas: HTMLCanvasElement, image: HTMLImageElement) {
    const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
    const cell = Math.min(W, H) / MOSAIC_BLOCKS;
    const tw = Math.max(1, Math.round(W / cell)), th = Math.max(1, Math.round(H / cell));
    canvas.width = tw;
    canvas.height = th;
    const x = canvas.getContext("2d")!;
    const iw = image.naturalWidth, ih = image.naturalHeight;
    const s = Math.max(tw / iw, th / ih), sw = tw / s, sh = th / s;
    x.fillStyle = "#222";
    x.fillRect(0, 0, tw, th);
    x.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, tw, th);
}

type Props = {
    src?: string | null;
    // not met yet: grey mosaic and a "?"
    locked?: boolean;
    // the bird's tile in the prebuilt mosaic atlas: when locked it is used instead of loading src
    tile?: MosaicTile | null;
    // what sits in the window when there is no image or it can't load (e.g. the pixel sprite)
    fallback?: ReactNode;
    // the src isn't known yet (still being looked up): show the empty glass, not the fallback
    pending?: boolean;
    // shown under a photo while it is still loading (not for locked mosaics)
    placeholder?: ReactNode;
    mark?: string;
    // size of the "?" over a locked mosaic
    markClassName?: string;
    alt?: string;
    className?: string;
};

export default function PhotoWindow({ src, locked = false, tile, fallback, pending = false, placeholder, mark = "?", markClassName = "text-5xl", alt = "", className = "" }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const fromAtlas = locked && !!tile;

    useEffect(() => {
        if (!src || fromAtlas) return;
        let cancelled = false;
        // CORS first so the grade and glow can be measured; plain load if the host doesn't allow it
        loadImage(src, true)
            .catch(() => loadImage(src, false))
            .then(image => {
                if (cancelled) return;
                const a = analyse(image);
                setLoaded({ src, image, dom: a?.dom ?? null, grade: a?.grade ?? null });
            })
            .catch(() => { if (!cancelled) setFailed(src); });
        return () => { cancelled = true; };
    }, [src, fromAtlas]);

    const ready = !!src && loaded?.src === src;
    const broken = !pending && (!src || failed === src);

    useEffect(() => {
        if (locked && ready && loaded?.image && canvasRef.current) drawMosaic(canvasRef.current, loaded.image);
    }, [locked, ready, loaded]);

    const dom = ready ? loaded?.dom : null;
    const grade = ready ? loaded?.grade : null;

    return (
        <div
            className={`relative shrink-0 ${className}`}
            style={dom ? { filter: `drop-shadow(0 0 9px color-mix(in srgb, ${dom} 40%, transparent))` } : undefined}
        >
            <div className="h-full w-full">
                <div
                    className="relative isolate h-full w-full overflow-hidden"
                    style={{ clipPath: CUT_2, background: dom ? `color-mix(in srgb, ${dom} 35%, #151515)` : "#1b1b1b" }}
                >
                    {/* a photo on its way: the placeholder sits underneath and the photo fades in over it */}
                    {!locked && !ready && !broken && placeholder && (
                        <div className="absolute inset-0 flex items-center justify-center">{placeholder}</div>
                    )}

                    {fromAtlas ? (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: `url(${tile!.url})`,
                                backgroundSize: `${tile!.cols * 100}% ${tile!.rows * 100}%`,
                                backgroundPosition: `${tile!.cols > 1 ? tile!.col / (tile!.cols - 1) * 100 : 0}% ${tile!.rows > 1 ? tile!.row / (tile!.rows - 1) * 100 : 0}%`,
                                imageRendering: "pixelated",
                                filter: "grayscale(.85) brightness(.5) contrast(1.15)",
                            }}
                            aria-hidden
                        />
                    ) : pending && !src ? null : broken ? (
                        fallback && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>
                    ) : locked ? (
                        <canvas
                            ref={canvasRef}
                            className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
                            style={{ imageRendering: "pixelated", filter: "grayscale(.85) brightness(.5) contrast(1.15)" }}
                            aria-hidden
                        />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- any user or reference URL, sized by the window
                        <img
                            src={src!}
                            alt={alt}
                            onError={() => setFailed(src!)}
                            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
                            style={grade ? { filter: `brightness(${grade.br}) saturate(${grade.sat}) contrast(${grade.con})` } : undefined}
                        />
                    )}

                    {locked && (
                        <span className={`absolute inset-0 z-[3] flex select-none items-center justify-center font-pokemon ${markClassName} text-white/60 [text-shadow:0_3px_0_#000a]`}>
                            {mark}
                        </span>
                    )}

                    {/* the screen glass: inner edge, scanlines, vignette */}
                    <div
                        className="pointer-events-none absolute inset-0 z-[2]"
                        style={{ boxShadow: "inset 0 0 0 1px #0008, inset 0 0 6px #0006", background: GLASS }}
                        aria-hidden
                    />
                </div>
            </div>
        </div>
    );
}
