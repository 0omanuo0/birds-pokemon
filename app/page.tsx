"use client";

import BirdCard from "@/components/birdCard";
import ButtonContext from "@/components/buttonContext";
import Content from "@/components/content";
import PokeballRotation from "@/components/pokeballRotation";
import { Bird } from "@/lib/types";
import Image from "next/image";
import { useState } from "react";

export default function Home() {

    const birds_default1: Bird[] = Array(50).fill({
        id: 0,
        name: "Abubilla",
        scientificName: ["Upupa", "epops"],
        family: "Upupidae",
    }).map((bird, index) => ({ ...bird, id: index }));
    const birds_default2: Bird[] = Array(50).fill({
        id: 0,
        name: "Martin Pescador",
        image: "/img/martin.jpg",
        scientificName: ["Alcedo", "atthis"],
        family: "Alcedinidae",
    }).map((bird, index) => ({ ...bird, id: index }));

    const birds_default: Bird[] = birds_default1.map((bird, index) =>
        index % 2 === 0 ? bird : birds_default2[index]
    );

    console.log(birds_default);

    const degrees_per_item = 18; // 360 / 20

    const [selectedBird, setSelectedBird] = useState<Bird>(birds_default[0]);
    const [tab, setTab] = useState(false);
    const [contextMenu, setContextMenu] = useState(false);

    return (
        <main
            className="flex min-h-screen flex-col items-center justify-between bg-neutral-500 overflow-hidden"
        >
            <section className="relative w-full h-fit">
                <Content birds={birds_default} setSelectedBird={setSelectedBird} selectedBird={selectedBird} />
                <BirdCard bird={selectedBird} show={tab} />

            </section>
            <div
                className="fixed top-1/2 right-0 w-5 h-16 bg-teal-900 animate-pulse"
                style={{
                    clipPath: "polygon(0% 20%, 100% 0%, 100% 100%, 0% 80%)",
                    boxShadow: "0 0 0 9999px #0006, inset 0 0 10px 2px #0006",
                    WebkitMaskImage: "polygon(0% 20%, 100% 0%, 100% 100%, 0% 80%)",
                    maskImage: "polygon(0% 20%, 100% 0%, 100% 100%, 0% 80%)",
                    animation: "colorPulse 2s infinite",
                }}
            >
            </div>
            <style jsx>{`
                @keyframes colorPulse {
                    0%, 100% {
                        background-color: #134e4a; /* teal-900 */
                    }
                    50% {
                        background-color: #065f46; /* emerald-800 */
                    }
                }
            `}</style>
            <PokeballRotation
                onWheel={absoluteRotation => {
                    // console.log(absoluteRotation);
                    // each rotation is 20 items so each item is 18 degrees
                    const id = Math.round(absoluteRotation / degrees_per_item);
                    if (id < birds_default.length && id >= 0) {
                        setSelectedBird(birds_default[id]);
                    }
                }}
                startScroll={0}
                endScroll={birds_default.length * degrees_per_item}
                onPress={() =>
                    setTab((prevTab) => !prevTab)
                }
                onLongPress={() =>
                    setContextMenu((prevContextMenu) => !prevContextMenu)
                }

            />
            <section
                // context menu
                style={{
                    left: "50%",
                    transform: contextMenu ? "translate(-50%, 20%)" : "translate(-50%, 200%)",
                    transition: "transform 0.3s ease-in-out",
                }}
                className="fixed overflow-hidden bottom-0 left-0 w-full pointer-events-none flex items-end justify-between my-20 px-20"
            >
                <ButtonContext bgcolor="bg-emerald-300">
                    <svg
                        style={{
                            filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))",
                            color: "#ddd"
                        }}
                        fill="none"
                        className="w-6 h-6 -ml-[2px] -mt-[2px]"
                    >
                        <path d="M15 2H9v2H7v6h2V4h6V2zm0 8H9v2h6v-2zm0-6h2v6h-2V4zM4 16h2v-2h12v2H6v4h12v-4h2v6H4v-6z" fill="currentColor" />
                    </svg>
                </ButtonContext>
                <ButtonContext bgcolor="bg-rose-300">
                    <svg
                        style={{
                            filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))",
                            color: "#ddd"
                        }}
                        fill="none"
                        className="w-6 h-6 -ml-[2px] -mt-[2px]"
                    >
                        <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zm-6-8h4v2h-4v4h-2v-4H7v-2h4V7h2v4z" fill="currentColor" />
                    </svg>
                </ButtonContext>

                <ButtonContext bgcolor="bg-sky-300">
                    <svg
                        style={{
                            filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))",
                            color: "#ddd"
                        }}
                        fill="none"
                        className="w-6 h-6 -ml-[2px] -mt-[2px]"
                    >
                        <path d="M18 2h-2v2h2V2zM4 4h6v2H4v14h14v-6h2v8H2V4h2zm4 8H6v6h6v-2h2v-2h-2v2H8v-4zm4-2h-2v2H8v-2h2V8h2V6h2v2h-2v2zm2-6h2v2h-2V4zm4 0h2v2h2v2h-2v2h-2v2h-2v-2h2V8h2V6h-2V4zm-4 8h2v2h-2v-2z" fill="currentColor" />
                    </svg>
                </ButtonContext>

            </section>
        </main>
    );
}
