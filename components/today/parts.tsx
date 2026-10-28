"use client";

import { useRouter } from "next/navigation";
import { Stop } from "@/components/device/cursor";
import BirdPic from "./birdPic";

// Building blocks shared by the Today sections.

export function Heading({ children, note, first = false }: { children: React.ReactNode; note?: React.ReactNode; first?: boolean }) {
    return (
        <h2 className={`mb-2 ${first ? "mt-0" : "mt-5"} flex items-baseline gap-1.5 font-pokemon text-base uppercase text-neutral-400`}>
            <span className="inline-block h-2.5 w-[2px] self-center bg-yellow-500" aria-hidden />
            {children}
            {note && <span className="ml-auto truncate text-xs normal-case text-neutral-400">{note}</span>}
        </h2>
    );
}

type SlotBird = { id: number; name: string; scientificName: string; family: string; seen: boolean; photo: string | null };

// One bird in a grid slot: picture, name, and an optional second line. Press opens its card.
export function Slot({ bird, sub, subTone = "text-neutral-400", hint = "Open", mystery = false }: { bird: SlotBird; sub?: string; subTone?: string; hint?: string; mystery?: boolean }) {
    const router = useRouter();
    return (
        <Stop hint={hint} onPress={() => router.push(`/bird/${bird.id}`)}>
            <div className="pixel-corners-4 bg-[#3a3a3e] p-1">
                <BirdPic bird={bird} className="aspect-square w-full" mystery={mystery} />
                <span className={`mt-1 block truncate text-center font-pokemon text-[13px] leading-tight ${bird.seen ? "text-neutral-100" : "text-neutral-300"}`}>
                    {bird.name}
                </span>
                {sub && <span className={`block truncate text-center font-pokemon text-xs leading-tight ${subTone}`}>{sub}</span>}
            </div>
        </Stop>
    );
}

// a placeholder slot while the area loads, so the layout doesn't jump when it arrives
export function SlotSkeleton() {
    return (
        <div className="pixel-corners-4 bg-[#3a3a3e] p-1" aria-hidden>
            <div className="aspect-square w-full animate-pulse bg-[#4a4a4e]" />
            <div className="mx-auto mt-1.5 h-2.5 w-3/4 animate-pulse bg-[#4a4a4e]" />
        </div>
    );
}

// block bar for "found X of Y", as on the profile
export function Blocks({ value, total }: { value: number; total: number }) {
    return (
        <div className="flex gap-[2px]" aria-label={`${value} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`h-[6px] flex-1 ${i < value ? "bg-yellow-400" : "bg-[#4a4a4e]"}`} />
            ))}
        </div>
    );
}
