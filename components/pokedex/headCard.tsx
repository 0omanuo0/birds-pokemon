"use client";

import { useEffect, useState } from "react";
import { fetchRetry } from "@/lib/fetchJson";
import { formatSeenDate } from "@/lib/format";

export default function HeadCard(
    { selectedBird, known_bird }: { selectedBird: any | undefined, known_bird: boolean }
) {
    const [location, setLocation] = useState<string | undefined>(undefined);
    // keyed on the string, not the object: callers pass a freshly spread object, so every re-render restarted the lookup
    const rawLocation: string | undefined = selectedBird?.location || undefined;

    useEffect(() => {
        if (!rawLocation) {
            setLocation(undefined);
            return;
        }

        const parts = rawLocation.split(",");
        if (parts.length !== 2) {
            setLocation(rawLocation);
            return;
        }

        let cancelled = false;
        const timeoutId = setTimeout(() => {
            const [lat, lon] = parts;
            fetchRetry(`/api/reverse-geocode?lat=${encodeURIComponent(lat.trim())}&lon=${encodeURIComponent(lon.trim())}`, {}, { timeout: 10000 })
                .then(response => response.ok ? response.json() : null)
                .then(data => {
                    // a slower answer for the previous bird mustn't overwrite this one
                    if (!cancelled) setLocation(data?.location || "???");
                })
                .catch(() => { if (!cancelled) setLocation("???"); });
        }, 800); // Wait 800ms before fetching

        return () => { cancelled = true; clearTimeout(timeoutId); };
    }, [rawLocation]);

    const locFull = known_bird && location && location !== "???" ? location : undefined;
    // raw sighting location is "lat,lon" (or free text) — more precise for Maps than the geocoded name
    const mapsHref = locFull
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedBird?.location ?? locFull)}`
        : undefined;
    // truncates to whatever width the row leaves it (flex child with min-w-0), no fixed max
    const locNode = mapsHref ? (
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" title={locFull}
            className="block min-w-0 truncate decoration-dotted underline-offset-2 cursor-pointer">
            {locFull}
        </a>
    ) : "???";

    return (
        <div className="text-sm  select-none bg-white border-b-2 border-neutral-900 ">
            <div style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                <h2
                    style={{
                        clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                        WebkitMaskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                        maskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                    }}
                    className={`bg-neutral-700  uppercase font-pokemon py-1 px-2 border-b border-yellow-400 shadow-sm flex items-center`}
                >
                    <span style={{ content: "" }} className="bg-yellow-400 w-[2px] h-3 inline-block mx-1 mb-[1px]"></span>
                    <span className="mr-2 text-yellow-400">
                        Nº{
                            selectedBird?.bird_id ?
                                selectedBird.bird_id.toString().padStart(4, "0") :
                                selectedBird.id.toString().padStart(4, "0")
                        }
                    </span>
                    {known_bird ? selectedBird?.name || "???" : "???"}
                </h2>
            </div>
            <div className={"flex gap-x-3 min-w-[40%] max-w-[calc(100%-1rem)] w-fit justify-between text-sm text-black pt-1 text-right uppercase font-pokemon mx-2"}>
                <span className="shrink-0 whitespace-nowrap">
                    {selectedBird ? (
                        <>
                        <span className="text-gray-500 font-pokemon-ns">Seen{" "}</span>
                            {known_bird && selectedBird?.seen_at
                                ? formatSeenDate(selectedBird.seen_at)
                                : "???"}
                        </>
                    ) : "???"}
                </span>
                {selectedBird ? (
                    <span className=" flex min-w-0 items-baseline gap-x-1">
                        <span className="shrink-0 text-gray-500 font-pokemon-ns text-sm leading-[1]">LOC</span>{locNode}
                    </span>
                ) : "???"}
            </div>
        </div>
    )
}