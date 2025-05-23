"use client";

import Content from "@/components/content";
import PokeballRotation from "@/components/pokeballRotation";
import { Bird } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import ContextMenu from "./contextMenu";

export default function Main({ birds_default, birds_seen }: { birds_default: Bird[], birds_seen: any[] }) {


    const degrees_per_item = 18; // 360 / 20

    const [selectedBird, setSelectedBird] = useState<Bird>(birds_default[0]);


    const contextMenuRef = useRef<any>(null);

    const [isFiltered, setIsFiltered] = useState(false);
    const [birdsFiltered, setBirdsFiltered] = useState(birds_default);
    const [known_bird, setKnownBird] = useState<boolean[]>([]);



    // console.log(birds_default);
    // console.log(birds_seen);

    return (
        <main
            className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
        >
            <section className="relative w-full h-fit md:h-[500px]">
                <div className="h-full w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
                    <svg width="0" height="0" id="noise">
                        <defs>
                            <filter id="noiseFilter">
                                <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" stitchTiles="stitch" />
                                <feBlend mode="soft-light" in="SourceGraphic" />
                            </filter>
                        </defs>
                    </svg>
                    <nav className="flex flex-row justify-between items-center w-full my-2 h-8">
                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                        <span className="text-neutral-300 text-sm font-medium font-pokemon">Birds Pokedex</span>
                    </nav>
                    <Content
                        birds={birdsFiltered} birdsSeen={birds_seen}
                        setSelectedBird={setSelectedBird} selectedBird={selectedBird}
                        known_bird={known_bird}
                    />
                </div>
            </section>
            <PokeballRotation
                onWheel={absoluteRotation => {
                    // console.log(absoluteRotation);
                    // each rotation is 20 items so each item is 18 degrees
                    const id = Math.round(absoluteRotation / degrees_per_item);
                    if (id < birdsFiltered.length && id >= 0) {
                        setSelectedBird(birdsFiltered[id]);
                    }
                }}
                startScroll={0}
                endScroll={(birdsFiltered.length - 1) * degrees_per_item}
                onPress={() =>
                    setIsFiltered((prev) => {
                        if (prev) {
                            setBirdsFiltered(birds_default);
                            setKnownBird(birds_default.map((bird) => birds_seen.some((birdSeen) => birdSeen.bird_id === bird.id)));
                        }
                        else
                        {
                            
                            setBirdsFiltered(
                                birds_default
                                    .filter((bird) => birds_seen.find((birdSeen) => birdSeen.bird_id === bird.id))
                                    .map((bird, index) => ({
                                        ...bird,
                                        id: index + 1,
                                        bird_id: bird.id
                                    }))
                            )
                            setKnownBird(birds_default.map((bird) => true));
                        }
                        
                        return !prev;
                    })
                }
                onLongPress={() =>
                    contextMenuRef.current.toggleContextMenu()
                }

            />
            <ContextMenu ref={contextMenuRef} />

        </main>
    );
}
