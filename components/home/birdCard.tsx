import { Bird } from "@/lib/types";
import { useEffect } from "react";



export default function BirdCard(
    { selectedBird, selectedBirdSeenD, known_bird }
        : { selectedBird: Bird, selectedBirdSeenD: any, known_bird: boolean }
) {

    useEffect(() => {
        if (!known_bird || !selectedBird) return;
        // console.log((Number(selectedBird.id)) * 32 - 4 * 32, "px");
        const canvas = document.getElementById("birdCanvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const image = new Image();
            image.src = selectedBirdSeenD?.photo_url || "img/abubilla.jpg";
            image.onload = () => {
                const tempCanvas = document.createElement("canvas");
                const tempCtx = tempCanvas.getContext("2d");

                if (tempCtx) {
                    // Calculate the desired pixel size for the pixel-art effect
                    const desiredPixelSize = 2;
                    const maxPixels = Math.floor(canvas.width / desiredPixelSize);

                    // Maintain aspect ratio
                    const targetWidth = Math.min(image.width, maxPixels);
                    const targetHeight = Math.round((image.height / image.width) * targetWidth);

                    tempCanvas.width = targetWidth;
                    tempCanvas.height = targetHeight;

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
    }, [selectedBird, selectedBirdSeenD]);


    return (
        <div className="m-2 mt-4">
            {/* {JSON.stringify(selectedBirdSeenD)} */}
            <div className="bg-main-image px-2 pt-5 pb-2">
                {
                    known_bird
                        ? <canvas
                            className="w-[200px] h-[200px] aspect-square border border-neutral-500"
                            id="birdCanvas" width={200} height={200}></canvas>
                        : <div className="w-[200px] h-[200px] aspect-square border border-neutral-500 bg-white flex items-center justify-center">
                            <span className="font-pokemon text-black text-6xl select-none">?</span>
                        </div>
                }


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
                        <br/>
                        <span className="mx-2 -mt-1 block">{selectedBird?.scientificName || "???"}</span>
                    </li>
                    <li className="">
                        <span className="font-bold">Family:</span> {selectedBird?.family || "???"}
                    </li>
                    <li className="">
                        <span className="font-bold">Habitat:</span> {selectedBird?.habitat || "???"}
                    </li>
                    <li className="">
                        <span className="font-bold">Description:</span> {selectedBird?.description || "???"}
                    </li>
                </ul>

            </div>
        </div>
    )
}