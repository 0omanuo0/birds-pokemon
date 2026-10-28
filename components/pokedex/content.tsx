"use client";

import { Bird } from "@/lib/types";
import { useEffect, useMemo } from "react";
import BirdCardScroll from "./birdCardScroll";
import BirdCard from "./birdCard";
import HeadCard from "./headCard";
import { loadReferencePhoto } from "@/lib/referencePhoto";

// Row geometry in px (not rem), so the list stays aligned whatever the root font size is.
// Must match BirdCardScroll: h-[32px] rows + gap-[8px] on the ul.
const ROW_PITCH = 32 + 8;

// Rows slide right the further they are from the selected one, easing out and then holding
// at MAX. The old cos(d / 2.4) curve kept oscillating, so far rows swung back out to 120px.
const MAX_INDENT = 90;
const INDENT_SPREAD = 4; // rows away from the selection before the indent maxes out

// Only the rows around the selection are mounted (the list is 600 birds); the selection sits on the 4th slot,
// so a few above and a screenful below cover even the tall layout.
const ROWS_ABOVE = 8;
const ROWS_BELOW = 20;
function rowIndent(distance: number) {
    const t = Math.min(Math.abs(distance) / INDENT_SPREAD, 1);
    return Math.round(MAX_INDENT * (1 - Math.cos(t * Math.PI / 2)));
}

export default function Content(
    { birds, birdsSeen, setSelectedBird, selectedBird, known_bird, isFiltered }:
        { birds: Bird[], birdsSeen: any[], setSelectedBird: (bird: Bird) => void, selectedBird: Bird, known_bird: boolean[], isFiltered: boolean }
) {
    // each bird's latest sighting (highest sighting_id), looked up instead of filtering every sighting per selection
    const latestSighting = useMemo(() => {
        const latest = new Map<number, any>();
        for (const s of birdsSeen) {
            const prev = latest.get(s.bird_id);
            if (!prev || s.sighting_id > prev.sighting_id) latest.set(s.bird_id, s);
        }
        return latest;
    }, [birdsSeen]);

    // filtered-mode birds carry bird_id (their id is re-indexed); All-mode birds only have id
    const selectedBirdSeenD = selectedBird ? latestSighting.get((selectedBird as any).bird_id ?? selectedBird.id) : undefined;
    const headBird = useMemo(
        () => (selectedBird ? { ...selectedBird, ...selectedBirdSeenD } : undefined),
        [selectedBird, selectedBirdSeenD]
    );

    // Position in the list, not bird.id: ids are DB ids in All mode, 1-based in the seen-only
    // list and 0-based in search results, so only the index is consistent across all three.
    const selectedIndex = selectedBird ? birds.findIndex(b => b.id === selectedBird.id) : -1;
    const selectedKnown = selectedIndex >= 0 && !!known_bird[selectedIndex];

    // warm the reference photos of the met birds around the selection, so their card shows at once
    // (birds not met yet come from the mosaic atlas and need nothing). Delayed a little so a fast spin
    // through the list doesn't fire a request per row.
    useEffect(() => {
        if (selectedIndex < 0) return;
        const timer = setTimeout(() => {
            for (const d of [0, 1, -1, 2, -2, 3]) {
                const sci = birds[selectedIndex + d]?.scientificName;
                if (sci && known_bird[selectedIndex + d]) loadReferencePhoto(sci);
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [selectedIndex, birds, known_bird]);

    const firstRow = Math.max(0, selectedIndex - ROWS_ABOVE);
    const lastRow = Math.min(birds.length, Math.max(selectedIndex, 0) + ROWS_BELOW);

    return (
        <>
            <HeadCard selectedBird={headBird} known_bird={selectedKnown} />

            <div className="flex flex-row w-full min-h-0 flex-1 relative">
                <BirdCard
                    selectedBird={selectedBird}
                    selectedBirdSeenD={selectedBirdSeenD}
                    known_bird={selectedKnown}
                />
                {selectedBird && <div
                    style={{
                        maskImage: "linear-gradient(0deg,#0000 15%, #000 45%, #000 75%, #0000 95%)",
                        // on the fixed column, not the ul, so it doesn't slide with the list
                        backgroundImage: "linear-gradient(90deg,#0000 10%, #1b1b1b 60%)",
                    }}
                    className="overflow-hidden h-full w-[180px] absolute top-0 right-0 "
                >

                    <ul
                        style={{
                            // selected row parked on the 4th slot (index 3), same spot as before
                            transform: `translateY(${(3 - Math.max(selectedIndex, 0)) * ROW_PITCH}px)`,
                            // the unmounted rows above keep their space, so row i still sits at i * ROW_PITCH
                            paddingTop: firstRow * ROW_PITCH,
                        }}
                        className="flex flex-col gap-[8px] transition-transform duration-100 ease-in-out pb-96"
                    >
                        {birds.slice(firstRow, lastRow).map((bird, i) => {
                            const index = firstRow + i;
                            return (
                                <BirdCardScroll
                                    key={bird.id.toString()}
                                    bird={bird}
                                    setSelectedBird={setSelectedBird}
                                    known={!!known_bird[index]}
                                    selected={index === selectedIndex}
                                    indent={rowIndent(index - selectedIndex)}
                                />
                            );
                        })}
                    </ul>
                </div>
                }
            </div>
        </>
    )
}