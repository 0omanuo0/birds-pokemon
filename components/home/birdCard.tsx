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
                {(!known_bird || !selectedBirdSeenD?.photo_url) && (
                    <div className="w-[200px] h-[200px] aspect-square border details-bg border-neutral-500 bg-white flex items-center justify-center">
                        <span className="font-pokemon text-black text-6xl select-none">?</span>
                    </div>
                )}
            </div>
            <div
                style={{
                    backgroundImage: "url('/img/container_info.svg')",
                    backgroundSize: "cover",
                }}
                className="min-w-[150px] max-w-[180px] min-h-[120px] absolute -mt-12 ml-4 px-2 pt-3 pb-2 select-none"
            >
                <ul
                    style={{
                        lineHeight: 0.8,
                    }}
                    className="details-bg bg-white min-h-[90px] rounded-xs w-full mt-[7px] p-1 text-black mr-3 text-base font-pokemon-smaller leading-tight space-y-0.5"
                >
                    <li>
                        <span className="text-gray-500 mr-1">SCI</span> <i>{selectedBird?.scientificName || "???"}</i>
                    </li>
                    <li>
                        <span className="text-gray-500 mr-1">FAM</span> <i>{selectedBird?.family || "???"}</i>
                    </li>
                    <li className="flex items-center">
                        <span className="text-gray-500 mr-1">HAB</span>
                        {selectedBird?.pb && <span className="ml-1 h-[14px] px-1 leading-[14px] bg-yellow-200 text-[10px] pixel-corners-1 uppercase">pb</span>}
                        {selectedBird?.na && <span className="ml-1 h-[14px] px-1 leading-[14px] bg-blue-200 text-[10px] pixel-corners-1 uppercase">na</span>}
                        {selectedBird?.ca && <span className="ml-1 h-[14px] px-1 leading-[14px] bg-green-200 text-[10px] pixel-corners-1 uppercase">ca</span>}
                    </li>
                    <li>
                        <span className="font-bold">DESC</span> {selectedBird?.description || "???"}
                    </li>
                </ul>

            </div>
        </div>
    )
}