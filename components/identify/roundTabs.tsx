"use client";

import type { ReactNode } from "react";
import { LIT_RED } from "./slantTabs";

// The round (pixel-cornered) controls of the top bar, in the device's red.
//  - RoundTabs: a switch of two or more options, the lit one red
//  - RedButton: a plain press button, red
export type RoundItem = { key: string; label: string; content: ReactNode; on: boolean; onPress: () => void };

export function RoundTabs({ items, label }: { items: RoundItem[]; label: string }) {
    return (
        <div role="group" aria-label={label} className="pixel-corners-4 flex shrink-0 bg-neutral-900/85 p-[2px] backdrop-blur-sm">
            {items.map(it => (
                <button
                    key={it.key}
                    type="button"
                    aria-pressed={it.on}
                    aria-label={it.label}
                    onClick={it.onPress}
                    style={{ background: it.on ? LIT_RED : undefined }}
                    className={`pixel-corners-4 flex h-8 cursor-pointer touch-manipulation items-center gap-1.5 px-2.5 font-pokemon text-xs uppercase transition-colors ${it.on ? "text-white" : "text-neutral-300 hover:bg-neutral-700"}`}
                >
                    {it.content}
                </button>
            ))}
        </div>
    );
}

export function RedButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onPress}
            style={{ background: LIT_RED }}
            className="pixel-corners-4 flex h-8 min-w-8 cursor-pointer touch-manipulation items-center justify-center gap-1 px-2 font-pokemon text-xs uppercase text-white transition-[filter] hover:brightness-110 active:brightness-90"
        >
            {children}
        </button>
    );
}
