"use client";

import { useEffect, useState } from "react";
import { useDevice } from "./deviceContext";

// shortest time the cover stays shut, counted from the start of the page load (not from hydration), so a fast
// load still shows a breath of the light instead of a flicker
const MIN_MS = 900;
// it opens by then even if a page still holds it
const MAX_MS = 4000;

// once per page load: a client navigation that remounts the shell (from a non-device route) shouldn't boot again
let booted = false;

// The closed Pokédex lid over the screen on the first load. It's in the server HTML, so it covers the screen from
// the first paint and the lens pulses on CSS alone before hydration. When the app is ready (hydrated, fonts in,
// no page holding it via useScreenHold) the lens flashes, the lid unlatches and slides up into the bezel.
// Sits over the screen inset only; the bezel, legend, tabs and ball stay visible around it.
export default function ScreenCover({ className }: { className: string }) {
    const holds = useDevice()?.screenHolds ?? 0;
    const [phase, setPhase] = useState<"shut" | "opening" | "gone">(() => (booted ? "gone" : "shut"));
    const [minDone, setMinDone] = useState(false);
    const [maxDone, setMaxDone] = useState(false);

    useEffect(() => {
        if (booted) return;
        let cancelled = false;
        const min = new Promise(r => setTimeout(r, Math.max(0, MIN_MS - performance.now())));
        Promise.all([min, document.fonts?.ready]).then(() => { if (!cancelled) setMinDone(true); });
        const max = setTimeout(() => setMaxDone(true), MAX_MS);
        return () => { cancelled = true; clearTimeout(max); };
    }, []);

    useEffect(() => {
        if (phase === "shut" && ((minDone && holds === 0) || maxDone)) {
            booted = true;
            setPhase("opening");
        }
    }, [phase, minDone, maxDone, holds]);

    if (phase === "gone") return null;

    return (
        // the whole bezel (title row included): the top half of the device. Clipped to it, so sliding up reads as the lid
        // leaving through the top of the device; the clip reaches a little below so the lid's shadow falls on the controls
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-40 [clip-path:inset(0_0_-24px_0)] ${className}`}>
            {/* the closed Kanto dex lid turned a quarter counterclockwise: lens corner bottom-left, hinge along the top */}
            <div
                role="status"
                aria-label={phase === "shut" ? "Starting up" : undefined}
                className={`screen-cover pointer-events-auto absolute inset-0 ${phase === "opening" ? "screen-cover-open" : ""}`}
                onAnimationEnd={e => { if (e.target === e.currentTarget) setPhase("gone"); }}
            >
                {/* the lid's thickness along the bottom: one light line, then the dark underside */}
                <div className="screen-cover-lip absolute inset-x-0 bottom-0 h-1.5" aria-hidden />

                {/* the stepped seam: wide around the lens at the bottom, a diagonal, then closer to the edge up to the top.
                    Stretches vertically only (the viewBox is 80 wide, like the svg), and the stroke doesn't scale */}
                <svg className="absolute left-0 top-0 h-[calc(100%-6px)] w-[80px]" viewBox="0 0 80 100" preserveAspectRatio="none" aria-hidden>
                    <path d="M70 100V70L38 58V0" transform="translate(2 0)" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <path d="M70 100V70L38 58V0" fill="none" stroke="#5e2427" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>

                {/* the light: a flat blue disc in a recessed well. Breathes while loading, flashes when it's ready */}
                <div className="screen-cover-socket absolute bottom-[18px] left-3 h-12 w-12 rounded-full p-[7px]">
                    <div className="screen-cover-glow h-full w-full rounded-full" />
                </div>
                {/* the three little lights above it */}
                <div className="absolute bottom-[90px] left-3.5 flex flex-col-reverse gap-2" aria-hidden>
                    <div className="screen-cover-led h-2 w-2 rounded-full bg-[#ef4444]" />
                    <div className="screen-cover-led h-2 w-2 rounded-full bg-[#facc15]" />
                    <div className="screen-cover-led h-2 w-2 rounded-full bg-[#22c55e]" />
                </div>

                {/* yellow arrow on the bottom edge, pointing up */}
                <svg className="screen-cover-arrow absolute bottom-[9px] left-1/2 h-[18px] w-6 -translate-x-1/2" viewBox="0 0 8 6" aria-hidden>
                    <path d="M0 6L4 0L8 6Z" fill="#facc15" stroke="#5e2427" strokeWidth="0.6" strokeLinejoin="round" />
                </svg>

                {/* groove near the right edge, toward the top */}
                <div className="screen-cover-groove absolute right-[12%] top-[12%] h-[44%] w-1" aria-hidden />
            </div>
        </div>
    );
}
