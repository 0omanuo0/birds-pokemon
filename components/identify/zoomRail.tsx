"use client";

import type { Zoom } from "@/lib/useCamera";
import SlantTabs from "./slantTabs";

// Zoom as a rail along the bottom of the viewfinder, like a phone camera app: one diagonal segment per zoom step, the
// current one lit red. The pokeball spins through the values in between; while the zoom is between two stops a readout
// shows the exact value.
const fmt = (v: number) => `x${Number.isInteger(v) ? v : v.toFixed(1)}`;

export default function ZoomRail({ zoom, onPick }: { zoom: Zoom; onPick: (index: number) => void }) {
    // the lit step is always the nearest one, wherever the zoom is between two; the readout shows when it is not on a step
    let nearest = 0;
    zoom.steps.forEach((s, i) => { if (Math.abs(s - zoom.value) < Math.abs(zoom.steps[nearest] - zoom.value)) nearest = i; });
    const onStop = Math.abs(zoom.steps[nearest] - zoom.value) < 0.03;
    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-1.5">
            {/* the live value while spinning between stops; keeps its space so the rail doesn't jump */}
            <span
                aria-hidden
                className={`bg-neutral-900/85 px-3 py-0.5 font-pokemon text-sm text-white transition-opacity [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)] ${onStop ? "opacity-0" : "opacity-100"}`}
            >
                {fmt(zoom.value)}
            </span>
            <div className="pointer-events-auto">
                <SlantTabs
                    label="Zoom"
                    text="text-sm"
                    items={zoom.steps.map((s, i) => ({
                        key: String(s), label: `Zoom ${fmt(s)}`, content: fmt(s), on: i === nearest, onPress: () => onPick(i),
                    }))}
                />
            </div>
        </div>
    );
}
