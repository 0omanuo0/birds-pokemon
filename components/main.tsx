"use client";

import Content from "@/components/content";
import PokeballRotation from "@/components/pokeballRotation";
import { Bird } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import ContextMenu from "./contextMenu";
import LateralLeft from "./nav/lateralLeft";
import LateralRight from "./nav/lateralRight";
import { addSvg, CameraSvg, homeSvg, searchSvg, userSvg } from "./imageSvg";

export default function Main({ birds_default, birds_seen }: { birds_default: Bird[], birds_seen: any[] }) {


    const degrees_per_item = 18; // 360 / 20

    const [selectedBird, setSelectedBird] = useState<Bird>(birds_default[0]);


    const contextMenuRef = useRef<any>(null);

    const [_, setIsFiltered] = useState(false);
    const [birdsFiltered, setBirdsFiltered] = useState(birds_default);
    const [known_bird, setKnownBird] = useState<boolean[]>([]);

    const [showDialogSearch, setShowDialogSearch] = useState(false);

    // console.log(birds_default);
    // console.log(birds_seen);

    return (
        <main
            className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
        >
            <LateralLeft target='/identify' setTop="65%">{CameraSvg}</LateralLeft>
            <LateralRight onAction={() => {
                setShowDialogSearch(prev => !prev);
            }} setTop="65%">{searchSvg}</LateralRight>

            <section
                className="relative md:h-[500px] w-full h-fit">
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
                    <div
                        className="w-full h-full bg-neutral-700 pixel-corners-4 relative overflow-hidden noise-effect shining"
                    >
                        <div
                            style={{
                                transition: "all 0.3s ease-in-out",
                            }}
                            className={"absolute pointer-events-none left-0 w-full p-4 z-50 overflow-hidden pixel-corners-4" + (showDialogSearch ? " top-0 h-full opacity-100 backdrop-blur-xs bg-neutral-800/20 " : "  top-[50%] h-0 opacity-0")}
                        >
                            <div className="bg-gradient-to-br from-neutral-800 to-neutral-500 h-full w-full p-2 pixel-corners-12 shadow-lg">
                                <div className="flex flex-col bg-gradient-to-bl from-neutral-800 to-neutral-900 pixel-corners-10 w-full h-full overflow-hidden">
                                    <div className="bg-white border-b-2 border-neutral-900 after:border-b-1 after:border-neutral-400 after:content-[''] after:block after:w-full">
                                        <div style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                                            <h2
                                                style={{
                                                    clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                                    WebkitMaskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                                    maskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                                }}
                                                className={`bg-neutral-700 uppercase font-pokemon relative py-1 px-2 border-b border-yellow-400 shadow-sm`}
                                            >
                                                <span style={{ content: "" }} className="bg-yellow-400 w-[2px] h-3 inline-block mx-1"></span>
                                                Filter birds
                                                <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                                            </h2>
                                        </div>
                                        <div className="text-black text-sm -mt-3 text-right uppercase space-x-3 font-pokemon">
                                            <span className="mx-2">{birdsFiltered.length} birds</span>
                                        </div>
                                    </div>
                                    <div className="flex h-full w-full items-center justify-between">
                                        <div className="h-[calc(100%-30px)] w-fit" style={{ filter: "drop-shadow(2px 2px 0px #fcc800aa)", }}>
                                            <aside
                                                style={{
                                                    clipPath: "polygon(60% 0, 100% 5%, 100% 95%, 60% 100%, 0 100%, 0 0)",
                                                    filter: "drop-shadow(2px 2px 0px rgba(255, 255, 255, 0.5))",
                                                    maskImage: "polygon(60% 0, 100% 5%, 100% 95%, 60% 100%, 0 100%, 0 0)"

                                                }}
                                                className="h-[calc(100%-30px)] w-fit p-2 bg-white">
                                                <ul className="flex flex-col items-center justify-center gap-2 h-full">
                                                    <li style={{ filter: "drop-shadow(2px 2px 0px #000b)" }}> <button className="w-full h-fit bg-red-400 py-1 pixel-corners-4 px-4">a</button></li>
                                                    <li style={{ filter: "drop-shadow(2px 2px 0px #000b)" }}> <button className="w-full h-fit bg-red-400 py-1 pixel-corners-4 px-4">a</button></li>
                                                    <li style={{ filter: "drop-shadow(2px 2px 0px #000b)" }}> <button className="w-full h-fit bg-red-400 py-1 pixel-corners-4 px-4">a</button></li>
                                                    <li style={{ filter: "drop-shadow(2px 2px 0px #000b)" }}> <button className="w-full h-fit bg-red-400 py-1 pixel-corners-4 px-4">a</button></li>
                                                </ul>
                                            </aside>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Content
                            birds={birdsFiltered} birdsSeen={birds_seen}
                            setSelectedBird={setSelectedBird} selectedBird={selectedBird}
                            known_bird={known_bird}
                        />
                    </div>
                </div>
                {/* <div className="absolute bottom-0 w-full px-10 flex items-center justify-center gap-0">
                    <input
                        style={{
                            filter: "drop-shadow(4px 4px 6px rgba(0, 0, 0, 0.3))",
                            clipPath: "polygon(5% 0%, 100% 0%, 100% 50%, 100% 100%, 5% 100%, 0% 50%)",
                            maskImage: "polygon(5% 0%, 100% 0%, 100% 50%, 100% 100%, 5% 100%, 0% 50%)",
                            backgroundImage: "linear-gradient(0deg, #0000 10%, #fff2 60%, #0000 100%)"
                        }}
                        placeholder="Search birds..."
                        className=" px-4 shadow-lg bg-neutral-700 w-52 h-10 translate-y-[calc(50%-6px)] border-2 border-y-neutral-800/50 border-x-transparent outline-none"
                    />
                    <div className="h-10 w-[2px] bg-neutral-700 border-y-2 border-neutral-800/60 translate-y-[calc(50%-6px)]"></div>
                    <button
                        style={{
                            filter: "drop-shadow(4px 4px 6px rgba(0, 0, 0, 0.3))",
                            clipPath: "polygon(0% 0%, 80% 0%, 100% 50%, 80% 100%, 0% 100%, 0% 50%)",
                            maskImage: "polygon(0% 0%, 80% 0%, 100% 50%, 80% 100%, 0% 100%, 0% 50%)",
                            backgroundImage: "linear-gradient(0deg, #0000 10%, #fff2 60%, #0000 100%)",
                        }}
                        className=" shadow-lg bg-neutral-700 w-18 h-10 translate-y-[calc(50%-6px)] border-2 border-y-yellow-400 border-x-transparent flex items-center justify-center"
                    >
                        <span className="h-6 w-8 pr-2">
                            {searchSvg}
                        </span>
                    </button>
                </div> */}
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
                    setIsFiltered(prev => {
                        if (prev) {
                            // → going _back_ to un-filtered mode
                            setBirdsFiltered(birds_default);
                            // mark each bird “known” if it ever appears in birds_seen
                            setKnownBird(
                                birds_default.map(b =>
                                    birds_seen.some(bs => bs.bird_id === b.id)
                                )
                            );
                        } else {
                            // → going _into_ filtered mode: only show birds you've seen,
                            //    and for each id pick the *last* record from birds_seen
                            const lastSeenById = new Map<number, typeof birds_seen[0]>();
                            birds_seen.forEach(record => {
                                // each successive record with the same bird_id will overwrite,
                                // so at the end Map.get(bird_id) is the last one
                                lastSeenById.set(record.bird_id, record);
                            });

                            const filtered = birds_default
                                .filter(b => lastSeenById.has(b.id))
                                .map((b, idx) => {
                                    const seenRecord = lastSeenById.get(b.id)!;
                                    return {
                                        // keep your default bird fields...
                                        ...b,
                                        // merge in any fields you want from the last-seen record
                                        ...seenRecord,
                                        // re-index for display
                                        id: idx + 1,
                                        bird_id: b.id,
                                    };
                                });

                            console.log("Filtered birds:", filtered);

                            setBirdsFiltered(filtered);
                            // all of the filtered list are “known”
                            setKnownBird(filtered.map(() => true));
                        }

                        return !prev;
                    })
                }
                onLongPress={() => { }
                    // contextMenuRef.current.toggleContextMenu()
                }

            />
            {/* <ContextMenu ref={contextMenuRef} /> */}

        </main>
    );
}
