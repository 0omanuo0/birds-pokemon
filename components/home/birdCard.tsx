"use client";
import { Bird } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";



export default function BirdCard(
    { selectedBird, selectedBirdSeenD, known_bird }
        : { selectedBird: any, selectedBirdSeenD: any, known_bird: boolean }
) {
    const router = useRouter();

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        if (!known_bird || !selectedBird) return;
        // console.log((Number(selectedBird.id)) * 32 - 4 * 32, "px");
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
            const image = new Image();
            image.src = selectedBirdSeenD?.photo_url || "img/abubilla.jpg";
            console.log(image)
            image.onload = () => {
                ctx.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);

                const canvasWidth = canvasRef.current?.width || 0;
                const canvasHeight = canvasRef.current?.height || 0;
                const imgWidth = image.width;
                const imgHeight = image.height;

                // Calculate scale to cover the canvas (zoom in if needed)
                const scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);

                // Calculate the size and position to center the image
                const drawWidth = imgWidth * scale;
                const drawHeight = imgHeight * scale;
                const offsetX = (canvasWidth - drawWidth) / 2;
                const offsetY = (canvasHeight - drawHeight) / 2;

                ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
            }
        }
    }, [selectedBird, selectedBirdSeenD]);



    return (
        <div className="m-2 mt-4" onClick={() => {
            if (known_bird) {

                router.push(`/bird/${selectedBird?.bird_id || selectedBird?.id}`);
            }
        }}>
            {/* {JSON.stringify(selectedBirdSeenD)} */}
            <div className="bg-main-image px-2 pt-5 pb-2">
                <canvas
                    ref={canvasRef}
                    className={`w-[200px] h-[200px] aspect-square border border-neutral-500 ${!known_bird || !selectedBirdSeenD?.photo_url ? "hidden" : ""}`}
                    id="birdCanvas"
                    width={200}
                    height={200}
                ></canvas>
                {!known_bird && (
                    <div className="w-[200px] h-[200px] aspect-square border border-neutral-500 bg-white flex items-center justify-center">
                        <span className="font-pokemon text-black text-6xl select-none">?</span>
                    </div>
                )}
            </div>
            <div
                style={{
                    backgroundImage: "url('/img/container_info.svg')",
                    backgroundSize: "cover",
                }}
                className="w-[150px] min-h-[120px] absolute -mt-10 ml-4 px-2 pt-3 pb-2 select-none"
            >
                <ul className="bg-white h-full rounded-xs w-full mt-[7px] p-1 text-neutral-800 text-xs font-pokemon-smaller">
                    <li className="">
                        <span className="font-bold">Scientific name:</span>
                        <br />
                        <span className="mx-2 -mt-1 block">{selectedBird?.scientificName || "???"}</span>
                    </li>
                    <li className="">
                        <span className="font-bold">Family:</span> {selectedBird?.family || "???"}
                    </li>
                    <li className="flex">
                        <span className="font-bold">Habitat:</span>
                        {selectedBird?.pb && <span className="ml-1 px-1 bg-yellow-200 text-xs pixel-corners-1">pb</span>}
                        {selectedBird?.na && <span className="ml-1 px-1 bg-blue-200 text-xs pixel-corners-1">na</span>}
                        {selectedBird?.ca && <span className="ml-1 px-1 bg-green-200 text-xs pixel-corners-1">ca</span>}
                    </li>
                    <li className="">
                        <span className="font-bold">Description:</span> {selectedBird?.description || "???"}
                    </li>
                </ul>

            </div>
        </div>
    )
}