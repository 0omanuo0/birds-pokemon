import { Bird } from "@/lib/types";
import Image from "next/image";



export default function BirdCard({ bird, show }: { bird: Bird; show: boolean }) {
    return (
        <div 
            style={{
                transform: show ? "translateY(0)" : "translateY(-100%)",
                top: "0",
                transition: "transform 0.3s ease-in-out",
                position: "absolute",
            }}
        className="h-[calc(100dvh-55dvw)] w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
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
                            {bird.name}(id: {bird.id.toString()})
                            <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                        </h2>
                    </div>
                    <div className="text-black text-sm py-1 text-right uppercase space-x-3 font-pokemon">
                        <span>Seen  {bird.seen?.toString() || "0"}</span>
                        <span className="mx-2">Location  {bird.location?.join(", ") || "Unknown"}</span>
                    </div>
                </div>
                <div className="flex flex-row w-full h-full relative">
                    <div className="m-2 mt-4">
                        <div className="bg-main-image px-2 pt-5 pb-2">
                            <Image
                                src={bird.image || "/img/abubilla.jpg"}
                                alt={bird.name} width={200} height={200}
                                className="w-[200px] h-[200px] aspect-square object-cover border border-neutral-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}