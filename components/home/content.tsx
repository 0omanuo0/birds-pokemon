"use client";

import { Bird } from "@/lib/types";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import BirdCardScroll from "./birdCardScroll";
import BirdCard from "./birdCard";
import HeadCard from "./headCard";

export default function Content(
    { birds, birdsSeen, setSelectedBird, selectedBird, known_bird }:
        { birds: Bird[], birdsSeen: any[], setSelectedBird: (bird: Bird) => void, selectedBird: Bird, known_bird: boolean[] }
) {
    const [birdItemHeight, setBirdItemHeight] = useState(32);
    const [selectedBirdSeenD, setSelectedBirdSeenD] = useState<any | undefined>({});

    useEffect(() => {
        const fontsize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        setBirdItemHeight(fontsize * 2.5);
        requestAnimationFrame(() => setMarginAminationScroll());
    }, []);

    useEffect(() => {
        if (!selectedBird) return;


        const birdId = (selectedBird as any).bird_id;
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


    function setMarginAminationScroll() {
        if (selectedBird === undefined) return;
        const width = 20 / 2;

        const inp = selectedBird.id - width < 0 ? 0 : selectedBird.id - width;
        const ipp = selectedBird.id + width;
        for (let i = inp; i < ipp; i++) {
            const el = document.getElementById(`bird-item-${i}`);
            if (!el) continue;
            if (i === selectedBird?.id)
                el.style.backgroundColor = "#262626";
            else
                el.style.backgroundColor = "#525252";
            const margin_calc = Math.cos(((i - Number
                (selectedBird.id)) / 2.4) + 0) * -60 + 60;

            el.style.marginLeft = `${margin_calc}px`;
        }
    }


    useLayoutEffect(() => {
        requestAnimationFrame(() => setMarginAminationScroll());
    }, [selectedBird]);

    // console.log()
    // `${(Math.cos(((Number(bird.id) - Number(selectedBird.id)) / 2.4) + 0) * -30 + 30).toFixed(2)}px`


    return (
        <>
            <HeadCard selectedBird={selectedBird ? { ...selectedBird, ...selectedBirdSeenD } : undefined} known_bird={known_bird[selectedBird?.id - 1] || false} />

            <div className="flex flex-row w-full h-[50dvh] md:h-full relative">
                <BirdCard
                    selectedBird={selectedBird}
                    selectedBirdSeenD={selectedBirdSeenD}
                    known_bird={known_bird[selectedBird?.id - 1]}
                />
                {selectedBird && <div
                    style={{
                        maskImage: "linear-gradient(0deg,#0000 0%, #000 25%, #000 75%, #0000 100%)",

                    }}
                    className="overflow-hidden h-full w-[180px] absolute top-0 right-0 "
                >

                    <ul
                        style={{
                            backgroundImage: "linear-gradient(90deg,#0000 10%, #222 60%)",
                            transform: selectedBird ? `translateY(${(Number(selectedBird.id)) * -birdItemHeight + 4 * birdItemHeight}px)` : "0px",
                        }}
                        className=" flex flex-col gap-2 transition-transform duration-100 ease-in-out pb-96"
                    >
                        {birds.map((bird, index) => (
                            <BirdCardScroll
                                key={bird.id.toString()}
                                bird={bird}
                                setSelectedBird={setSelectedBird}
                                known_bird={known_bird[index]}
                            />
                        ))}
                    </ul>
                </div>
                }
            </div>

            <div
                className="absolute inset-0 pointer-events-none rounded-sm"
                style={{ boxShadow: "inset 0 0 6px 1px #171717" }}
            />
        </>
    )
}