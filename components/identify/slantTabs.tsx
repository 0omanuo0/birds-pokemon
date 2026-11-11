"use client";

import type { ReactNode } from "react";

// A row of diagonal-cut segments, the Gen 5 menu look (as the banner of the dex notice): every segment is a parallelogram,
// the lit one is the red of the device's own tabs, the others are dark glass. The segments touch along their diagonals,
// with no gap between them. Used by the zoom rail.
export type SlantItem = { key: string; label: string; content: ReactNode; on: boolean; onPress: () => void };

const SLANT = 8; // px the diagonal cuts into each end

const shape = `polygon(${SLANT}px 0, 100% 0, calc(100% - ${SLANT}px) 100%, 0 100%)`;

// the red of the device's side tabs, with a light top edge; shared with the round buttons
export const LIT_RED = [
    "linear-gradient(to bottom, rgba(255,255,255,0.28) 0 2px, transparent 2px)",
    "linear-gradient(160deg, #e85d63, #c63f44 70%)",
].join(", ");

export default function SlantTabs({ items, label, text = "text-xs" }: { items: SlantItem[]; label: string; text?: string }) {
    return (
        <div role="group" aria-label={label} className="flex drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]">
            {items.map((it, i) => (
                <button
                    key={it.key}
                    type="button"
                    aria-pressed={it.on}
                    aria-label={it.label}
                    onClick={it.onPress}
                    // pulling each segment back by the slant makes neighbouring diagonals meet exactly
                    style={{ clipPath: shape, background: it.on ? LIT_RED : undefined, marginLeft: i === 0 ? 0 : -SLANT }}
                    className={`relative flex h-8 min-w-9 cursor-pointer touch-manipulation items-center justify-center gap-1.5 px-[18px] font-pokemon uppercase transition-colors ${text} ${it.on ? "z-10 text-white" : "bg-neutral-900/85 text-neutral-300 backdrop-blur-sm hover:bg-neutral-700"}`}
                >
                    {it.content}
                </button>
            ))}
        </div>
    );
}
