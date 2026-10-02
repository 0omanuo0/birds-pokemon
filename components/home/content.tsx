"use client";

import { Bird } from "@/lib/types";
import { useEffect, useState } from "react";
import BirdCardScroll from "./birdCardScroll";
import BirdCard from "./birdCard";
import HeadCard from "./headCard";

// Row geometry in px (not rem), so the list stays aligned whatever the root font size is.
// Must match BirdCardScroll: h-[32px] rows + gap-[8px] on the ul.
const ROW_PITCH = 32 + 8;

// Rows slide right the further they are from the selected one, easing out and then holding
// at MAX. The old cos(d / 2.4) curve kept oscillating, so far rows swung back out to 120px.
const MAX_INDENT = 90;
const INDENT_SPREAD = 4; // rows away from the selection before the indent maxes out
function rowIndent(distance: number) {
    const t = Math.min(Math.abs(distance) / INDENT_SPREAD, 1);
    return Math.round(MAX_INDENT * (1 - Math.cos(t * Math.PI / 2)));
}

export default function Content(
    { birds, birdsSeen, setSelectedBird, selectedBird, known_bird, isFiltered }:
        { birds: Bird[], birdsSeen: any[], setSelectedBird: (bird: Bird) => void, selectedBird: Bird, known_bird: boolean[], isFiltered: boolean }
) {
    const [selectedBirdSeenD, setSelectedBirdSeenD] = useState<any | undefined>({});

    // Position in the list, not bird.id: ids are DB ids in All mode, 1-based in the seen-only
    // list and 0-based in search results, so only the index is consistent across all three.
    const selectedIndex = selectedBird ? birds.findIndex(b => b.id === selectedBird.id) : -1;
    const selectedKnown = selectedIndex >= 0 && !!known_bird[selectedIndex];

    useEffect(() => {
        if (!selectedBird) return;


        // filtered-mode birds carry bird_id (their id is re-indexed); All-mode birds only have id
        const birdId = (selectedBird as any).bird_id ?? selectedBird.id;
        // collect all sightings of this bird…
        const sightings = birdsSeen
            .filter(b => b.bird_id === birdId)
            .sort((a, b) => a.sighting_id - b.sighting_id);
        if (sightings.length > 0) {
            // …and pick the last one
            setSelectedBirdSeenD(sightings[sightings.length - 1]);
        } else {
            setSelectedBirdSeenD(undefined);
        }
        

    }, [selectedBird, birdsSeen, birds]);



    return (
        <>
            <HeadCard selectedBird={selectedBird ? { ...selectedBird, ...selectedBirdSeenD } : undefined} known_bird={selectedKnown} />

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
                        }}
                        className="flex flex-col gap-[8px] transition-transform duration-100 ease-in-out pb-96"
                    >
                        {birds.map((bird, index) => (
                            <BirdCardScroll
                                key={bird.id.toString()}
                                bird={bird}
                                setSelectedBird={setSelectedBird}
                                known={!!known_bird[index]}
                                selected={index === selectedIndex}
                                indent={rowIndent(index - selectedIndex)}
                            />
                        ))}
                    </ul>
                </div>
                }
            </div>
        </>
    )
}