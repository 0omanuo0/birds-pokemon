"use client";

import { Bird } from "@/lib/types";
import { use, useEffect, useState } from "react";

export default function Content({ birds, setSelectedBird, selectedBird }: { birds: Bird[], setSelectedBird: (bird: Bird) => void, selectedBird: Bird }) {

    const [birdItemHeight, setBirdItemHeight] = useState(32);

    useEffect(() => {
        const fontsize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        setBirdItemHeight(fontsize * 2.5);
    }, []);


    useEffect(() => {
        // console.log((Number(selectedBird.id)) * 32 - 4 * 32, "px");
        const canvas = document.getElementById("birdCanvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const image = new Image();
            image.src = selectedBird.image?.toString() || "img/abubilla.jpg";
            image.onload = () => {
                const tempCanvas = document.createElement("canvas");
                const tempCtx = tempCanvas.getContext("2d");

                if (tempCtx) {
                    // Set temporary canvas size to a lower resolution
                    const pixelArtScale = 0.1; // Reduce resolution to 20%
                    tempCanvas.width = image.width * pixelArtScale;
                    tempCanvas.height = image.height * pixelArtScale;

                    // Draw the image at reduced resolution
                    tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);

                    // Clear the main canvas and draw the scaled-up pixelated image
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.imageSmoothingEnabled = false; // Disable smoothing for pixel-art effect
                    const scale = Math.max(canvas.width / tempCanvas.width, canvas.height / tempCanvas.height);
                    const x = (canvas.width / 2) - (tempCanvas.width / 2) * scale;
                    const y = (canvas.height / 2) - (tempCanvas.height / 2) * scale;
                    ctx.drawImage(tempCanvas, x, y, tempCanvas.width * scale, tempCanvas.height * scale);
                }
            }
        }
    }, [selectedBird]);
    return (
        <div className="h-[calc(100dvh-55dvw)] w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
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
                className="w-full h-full bg-neutral-700 rounded-sm relative overflow-hidden noise-effect shining"
            >
                
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
                            {selectedBird.name}(id: {selectedBird.id.toString()})
                            <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                        </h2>
                    </div>
                    <div className="text-black text-sm py-1 text-right uppercase space-x-3 font-pokemon">
                        <span>Seen  {selectedBird.seen?.toString() || "0"}</span>
                        <span className="mx-2">Location  {selectedBird.location?.join(", ") || "Unknown"}</span>
                    </div>
                </div>


                <div className="flex flex-row w-full h-full relative">
                    <div className="m-2 mt-4">
                        <div className="bg-main-image px-2 pt-5 pb-2">
                            <canvas
                                className="w-[200px] h-[200px] aspect-square border border-neutral-500"
                                id="birdCanvas" width={200} height={200}></canvas>
                        </div>
                        <div
                            style={{
                                backgroundImage: "url('/img/container_info.svg')",
                                backgroundSize: "cover",
                            }}
                            className="w-[150px] min-h-[120px] absolute -mt-10 ml-4 px-2 pt-3 pb-2"
                        >
                            <ul className="bg-white h-full rounded-xs w-full mt-[7px] p-1 text-neutral-800 text-xs font-pokemon-smaller">
                                <li className="">
                                    <span className="font-bold">Family:</span> {selectedBird.family}
                                </li>
                                <li className="">
                                    <span className="font-bold">Habitat:</span> {selectedBird.habitat}
                                </li>
                                <li className="">
                                    <span className="font-bold">Description:</span> {selectedBird.description}
                                </li>
                            </ul>

                        </div>
                    </div>
                    <div
                        style={{
                            maskImage: "linear-gradient(0deg,#0000 0%, #000 25%, #000 75%, #0000 100%)",

                        }}
                        className="overflow-hidden h-[calc(100dvh-55dvw-8rem)] w-[180px] absolute top-0 right-0 "
                    >
                        <ul
                            style={{
                                backgroundImage: "linear-gradient(90deg,#0000 10%, #222 60%)",
                                transform: `translateY(${(Number(selectedBird.id)) * -birdItemHeight + 4 * birdItemHeight}px)`,
                            }}
                            className=" flex flex-col gap-2 transition-transform duration-300 ease-in-out"
                        >
                            {birds.map((bird) => (
                                <li
                                    style={{
                                        marginLeft: `${Math.cos(((Number(bird.id) - Number(selectedBird.id)) / 2.4) + 0) * -30 + 30}px`,
                                        transition: "margin-left 0.1s ease-in-out",
                                    }}
                                    className={`space-x-2 px-4 overflow-hidden py-1 ${bird.id === selectedBird.id ? "bg-neutral-800" : "bg-neutral-600"} rounded-l-sm  h-[32px]`}
                                    key={bird.id.toString()}
                                    onClick={() => setSelectedBird(bird)}
                                >
                                    <span
                                        style={{
                                            textOverflow: "ellipsis",
                                            overflow: "hidden",
                                            whiteSpace: "nowrap",
                                            maxWidth: "10%"
                                        }}
                                        className="text-base font-pokemon">{bird.name}</span>
                                    <span
                                        style={{
                                            textOverflow: "ellipsis",
                                            overflow: "hidden",
                                            whiteSpace: "nowrap",
                                            maxWidth: "30%"
                                        }}
                                        className="text-xs text-neutral-400 font-pokemon">{bird.scientificName.join(" ")}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div
                    className="absolute inset-0 pointer-events-none rounded-sm"
                    style={{ boxShadow: "inset 0 0 6px 1px #171717" }}
                />
            </div>

        </div>
    )
}