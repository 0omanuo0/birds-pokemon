"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stop } from "@/components/device/cursor";
import PhotoWindow from "@/components/photoWindow";
import type { Trip } from "@/lib/today";
import { Heading } from "./parts";
import { PAPER } from "./birdPic";
import { UI, type Lang } from "./lines";

// The last trip out: a day with several photos, shown like a page stuck in a field notebook. A first, mockup-level
// look at the future Journal, where such days are adventures and the other sightings sit between them.

function useLocality(location: string | null) {
    const [place, setPlace] = useState<string | null>(null);
    useEffect(() => {
        if (!location) return;
        const [lat, lon] = location.split(",").map(s => s.trim());
        let cancelled = false;
        fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (!cancelled && d?.location) setPlace(d.location); })
            .catch(() => { /* the date is enough */ });
        return () => { cancelled = true; };
    }, [location]);
    return place;
}

function formatDay(day: string, lang: Lang) {
    const [y, m, d] = day.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, d))).toUpperCase().replace(/\./g, "");
}

export default function LastTrip({ trip, lang }: { trip: Trip; lang: Lang }) {
    const router = useRouter();
    const t = UI[lang];
    const place = useLocality(trip.location);
    const open = trip.newBirds[0] ?? trip.birds[0];
    return (
        <>
            <Heading>{t.trip}</Heading>
            <Stop hint="Open" onPress={() => router.push(`/bird/${open.id}`)}>
                <div className="relative px-3 pb-3 pt-2.5 text-neutral-900" style={PAPER}>
                    <div className="font-pokemon">
                        <span className="block text-[15px] leading-tight">{formatDay(trip.day, lang)}</span>
                        {place && <span className="block truncate text-xs text-neutral-600">{place}</span>}
                    </div>
                    {/* the photos, taped in a slightly crooked row */}
                    <div className="mt-2 flex gap-1.5">
                        {trip.photos.map((p, i) => (
                            <div key={p.url} className="min-w-0 flex-1 bg-white p-[3px] shadow-[1px_2px_0_#0003]" style={{ transform: `rotate(${[-2, 1.5, -1, 2, -1.5][i % 5]}deg)` }}>
                                <PhotoWindow className="aspect-square w-full" src={p.url} alt="" />
                            </div>
                        ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-pokemon text-[13px]">
                        <span>{t.tripBirds(trip.birds.length)}</span>
                        {trip.newBirds.length > 0 && <span className="bg-yellow-400 px-1.5 text-neutral-900">{t.tripNew(trip.newBirds.length)}: {trip.newBirds.slice(0, 2).map(b => b.name).join(", ")}{trip.newBirds.length > 2 ? "…" : ""}</span>}
                    </div>
                </div>
            </Stop>
        </>
    );
}
