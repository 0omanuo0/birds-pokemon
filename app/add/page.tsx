"use client";

import ContextMenu from "@/components/contextMenu";
import { ClockSvg, ImageAddSvg, PinSvg } from "@/components/imageSvg";
import PokeballRotation from "@/components/pokeballRotation";
import { useRouter } from "next/navigation";
import { useRef } from "react";




export default function Add() {
    const contextMenuRef = useRef<any>(null);
    const router = useRouter();

    return (
        <div className='h-[100dvh] md:py-4 2xl:py-12 w-full'
            style={{
                backgroundImage: "linear-gradient(45deg,#0000 10%, #222 60%)",
            }}
        >

            <div className='md:w-[420px] h-full mx-auto md:rounded-3xl overflow-hidden md:p-2 md:bg-neutral-700'>
                <main
                    className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
                >
                    <section className="relative w-full h-fit md:h-[450px]">
                        <div className="h-full w-full flex flex-col justify-center items-start bg-neutral-900 px-3 pb-3">
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
                                <span className="text-neutral-300 font-medium font-pokemon">Birds Pokedex</span>
                            </nav>
                            <div
                                className="w-full h-[60dvh] md:h-full bg-neutral-700 rounded-sm relative overflow-hidden noise-effect shining"
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
                                            Add pokemon
                                            <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                                        </h2>
                                    </div>
                                    <div className="text-black text-sm py-1 text-right uppercase space-x-3 font-pokemon">
                                        <span className="mx-2">Sumbi</span>
                                    </div>
                                </div>
                                <form>
                                    <div className="flex flex-col gap-2 items-center justify-center w-full h-full p-4">
                                        <div className="flex justify-between w-full">
                                            <div className="relative w-[200px] h-[200px]">
                                                <canvas className="absolute top-0 left-0 z-50 h-40 w-40 bg-white"></canvas>
                                                <canvas className="absolute top-2 left-2 z-40 h-40 w-40 bg-neutral-200"></canvas>
                                                <canvas className="absolute top-4 left-4 z-30 h-40 w-40 bg-neutral-300"></canvas>
                                                <canvas className="absolute top-6 left-6 z-20 h-40 w-40 bg-neutral-400"></canvas>
                                                <button className="absolute bottom-12 left-1 w-10 h-8 px-2 py-1 z-[99] bg-red-400 border-2 border-neutral-700/70">{ImageAddSvg}</button>
                                            </div>
                                            <div className="flex flex-col gap-2 items-center justify-center h-full p-2">
                                                <img src={"icons/pokeball.png"} className="h-[37px] w-10 saturate-50" style={{ imageRendering: "pixelated" }}/>
                                                <span className="h-10 w-10 flex font-pokemon relative">
                                                    {PinSvg}
                                                    <span className="text-red-400 absolute -bottom-2 right-0 text-2xl">x</span>
                                                </span>
                                                <span className="h-10 w-10 flex font-pokemon relative">
                                                    {ClockSvg}
                                                    <span className="text-red-400 absolute -bottom-2 right-0 text-2xl">x</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div className="absolute bottom-0 w-full px-10 flex items-center justify-between gap-2">
                            <input
                                style={{
                                    filter: "drop-shadow(4px 4px 6px rgba(0, 0, 0, 0.3))",
                                    clipPath: "polygon(5% 0%, 95% 0%, 100% 50%, 95% 100%, 5% 100%, 0% 50%)",
                                    maskImage: "polygon(5% 0%, 95% 0%, 100% 50%, 95% 100%, 5% 100%, 0% 50%)",
                                    backgroundImage: "linear-gradient(0deg, #0000 10%, #fff2 60%, #0000 100%)"
                                }}
                                placeholder="Añadir Pokémon"
                                className=" px-4 shadow-lg bg-neutral-700 w-52 h-10 translate-y-[calc(50%-6px)] border-2 border-y-neutral-800/50 border-x-transparent"
                            />
                            <button
                                style={{
                                    filter: "drop-shadow(4px 4px 6px rgba(0, 0, 0, 0.3))",
                                    clipPath: "polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)",
                                    maskImage: "polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)",
                                    backgroundImage: "linear-gradient(0deg, #0000 10%, #fff2 60%, #0000 100%)",
                                }}
                                className=" shadow-lg bg-neutral-700 w-18 h-10 translate-y-[calc(50%-6px)] border-2 border-y-yellow-400 border-x-transparent"
                            >
                                <span style={{ left: 23, top: 1, textShadow: "2px 2px 0px #0006", }} className="font-pokemon absolute">+</span>
                            </button>
                        </div>
                    </section>
                    <PokeballRotation
                        onWheel={() => { }}
                        startScroll={0}
                        endScroll={0}
                        onLongPress={() => router.push("/")}
                        onPress={() =>
                            contextMenuRef.current.toggleContextMenu()
                        }

                    />
                    <ContextMenu ref={contextMenuRef} />

                </main>
            </div>
        </div>
    )
}