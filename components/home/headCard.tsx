"use client";

import { useEffect, useState } from "react";


export default function HeadCard(
    { selectedBird, known_bird }: { selectedBird: any | undefined, known_bird: boolean }
) {
    const [location, setLocation] = useState<string | undefined>(undefined);
    console.log("selectedBird", selectedBird);


    useEffect(() => {
        

        if (!selectedBird || !selectedBird?.location) {
            setLocation(undefined);
            return;
        }

        if (selectedBird?.location.split(",").length !== 2) {
            setLocation(selectedBird?.location);
            return;
        }

        const timeoutId = setTimeout(() => {
            const lat = selectedBird?.location?.split(",")[0];
            const lon = selectedBird?.location?.split(",")[1];

            const url = `/api/reverse-geocode?lat=${lat}&lon=${lon}`;

            // fetch(url, {
            //     headers: {
            //         'User-Agent': 'BirdsPokemon/1.0 (manu365manu@gmail.com)',
            //     }
            // })
            //     .then(response => response.json())
            //     .then(data => {
            //         setLocation(data.location?.split(",")[0] || "???");
            //     })
            //     .catch(error => console.error('Error:', error));
        }, 800); // Wait 800ms before fetching

        return () => clearTimeout(timeoutId);
    }, [selectedBird]);

    return (
        <div className=" select-none bg-white border-b-2 border-neutral-900 after:border-b-1 after:border-neutral-400 after:content-[''] after:block after:w-full">
            <div style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                <h2
                    style={{
                        clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                        WebkitMaskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                        maskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                    }}
                    className={`bg-neutral-700 uppercase font-pokemon py-1 px-2 border-b border-yellow-400 shadow-sm`}
                >
                    <span style={{ content: "" }} className="bg-yellow-400 w-[2px] h-3 inline-block mx-1"></span>
                    <span className="mr-2">
                        {
                            selectedBird?.bird_id ?
                                selectedBird.bird_id.toString().padStart(4, "0") :
                                selectedBird.id.toString().padStart(4, "0")
                        }
                    </span>
                    {known_bird ? selectedBird?.name || "???" : "???"}
                </h2>
            </div>
            <div className="text-black text-sm py-1 text-right uppercase space-x-3 font-pokemon">
                <span>{selectedBird ? <>Seen  {(known_bird ? selectedBird?.seen?.toString() : "???") || "???"}</> : "???"}</span>
                <span className="mx-2">{selectedBird ? <>Location  {(known_bird ? location : "???") || "???"}</> : "???"}</span>
            </div>
        </div>
    )
}