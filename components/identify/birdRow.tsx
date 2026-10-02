"use client";

import { useEffect, useState } from "react";
import { loadBirdDescription, peekBirdDescription } from "@/lib/birdDescription";
import { loadBirdByScientificName, peekBirdByScientificName, type LookupBird } from "@/lib/birdLookup";
import type { DetectedBird } from "@/components/identify/useBirdListener";

export function confidenceTone(confidence: number) {
    if (confidence >= 0.7) return "text-green-400";
    if (confidence >= 0.4) return "text-yellow-400";
    return "text-red-400";
}

// Full class strings rather than deriving one from the other: Tailwind scans the source for literals,
// so a name built at runtime never gets generated.
export function confidenceCell(confidence: number) {
    if (confidence >= 0.7) return "bg-green-400";
    if (confidence >= 0.4) return "bg-yellow-400";
    return "bg-red-400";
}

// A row lit up this recently is what the model is hearing right now, not just what it heard earlier.
const FRESH_MS = 2500;

export default function BirdRow({ bird }: { bird: DetectedBird }) {
    // undefined = still looking up, null = genuinely not in our list (BirdNET knows far more species
    // than the dex does, and those detections are still worth showing under BirdNET's own name).
    const [entry, setEntry] = useState<LookupBird | null | undefined>(() => peekBirdByScientificName(bird.scientificName));
    const [photo, setPhoto] = useState<string | null>(() => peekBirdDescription(bird.scientificName)?.photo?.src ?? null);

    useEffect(() => {
        let alive = true;
        loadBirdByScientificName(bird.scientificName, bird.commonName)
            .then(found => { if (alive) setEntry(found); })
            .catch(() => { if (alive) setEntry(null); });
        // same reference photo the camera flow shows, and the same client-side cache
        loadBirdDescription(bird.scientificName)
            .then(info => { if (alive) setPhoto(info.photo?.src ?? null); })
            .catch(() => {});
        return () => { alive = false; };
    }, [bird.scientificName, bird.commonName]);

    const fresh = Date.now() - bird.lastSeen < FRESH_MS;
    const name = entry?.name || bird.commonName;

    return (
        <div
            className={`pixel-corners-4 flex shrink-0 items-center gap-3 bg-neutral-700 px-3 py-2 ${
                fresh ? "ring-1 ring-yellow-400" : ""
            }`}
        >
            <div className="pixel-corners-4 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-neutral-800 font-pokemon text-lg text-neutral-500">
                {photo ? (
                    <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                    "?"
                )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-pokemon text-sm text-neutral-100">{name}</span>
                <span className="truncate text-xs italic text-neutral-400">{bird.scientificName}</span>
            </div>
            {bird.count > 1 && (
                <span className="shrink-0 font-pokemon text-[11px] uppercase text-neutral-400">×{bird.count}</span>
            )}
            <span className={`shrink-0 font-pokemon text-sm uppercase ${confidenceTone(bird.bestScore)}`}>
                {(bird.bestScore * 100).toFixed(0)}%
            </span>
        </div>
    );
}
