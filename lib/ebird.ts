// Server-only: needs EBIRD_API_KEY, never call from the client.
import { unstable_cache } from "next/cache";

const EBIRD_API = "https://api.ebird.org/v2";
const DAY = 60 * 60 * 24;

export type EbirdSighting = {
    speciesCode: string;
    comName: string;
    sciName: string;
    locId: string;
    locName: string;
    obsDt: string; // "YYYY-MM-DD HH:mm", local to the sighting — eBird doesn't give a timezone/offset
    howMany: number | null;
    lat: number;
    lng: number;
    locationPrivate: boolean;
    subId: string; // checklist id, for linking out to ebird.org
};

// eBird identifies species by a short internal code ("eurrob1"), not scientific name, so a lookup
// against the full taxonomy is needed first. That taxonomy is ~11k species and only changes about
// once a year, so it's fetched and cached whole instead of hitting eBird per bird page view.
const getTaxonomyMap = unstable_cache(
    async (): Promise<Record<string, string>> => {
        const res = await fetch(`${EBIRD_API}/ref/taxonomy/ebird?cat=species&fmt=json`, {
            headers: { "X-eBirdApiToken": process.env.EBIRD_API_KEY || "" },
        });
        if (!res.ok) throw new Error(`eBird taxonomy fetch failed: ${res.status}`);
        const rows: { sciName: string; speciesCode: string }[] = await res.json();
        const map: Record<string, string> = {};
        for (const row of rows) map[row.sciName.toLowerCase()] = row.speciesCode;
        return map;
    },
    ["ebird-taxonomy-v1"],
    { revalidate: 30 * DAY }
);

async function ebirdSpeciesCode(scientificName: string): Promise<string | null> {
    if (!process.env.EBIRD_API_KEY) return null;
    const map = await getTaxonomyMap();
    return map[scientificName.toLowerCase()] ?? null;
}

// Everyone else's (eBird's) recent sightings of this species near a point — separate from our own
// users' sightings in the DB. dist is a radius in km (eBird caps it at 50), back is days (capped at 30).
// code = the species' eBird code when the caller has it (birds.ebird_code, matched by scripts/match-birds.mjs);
// only birds without one fall back to the whole-taxonomy lookup.
export async function ebirdRecentNearby(
    scientificName: string,
    lat: number,
    lng: number,
    { dist = 25, back = 14, code }: { dist?: number; back?: number; code?: string | null } = {}
): Promise<EbirdSighting[]> {
    try {
        const speciesCode = code || await ebirdSpeciesCode(scientificName);
        if (!speciesCode) return [];

        const url = `${EBIRD_API}/data/obs/geo/recent/${speciesCode}?lat=${lat}&lng=${lng}&dist=${dist}&back=${back}`;
        const res = await fetch(url, {
            headers: { "X-eBirdApiToken": process.env.EBIRD_API_KEY || "" },
            next: { revalidate: 60 * 15 }, // eBird gets new checklists constantly; 15min is fresh enough here
        });
        if (!res.ok) return [];

        const rows = await res.json();
        return (rows as any[]).map(r => ({
            speciesCode: r.speciesCode,
            comName: r.comName,
            sciName: r.sciName,
            locId: r.locId,
            locName: r.locName,
            obsDt: r.obsDt,
            howMany: r.howMany ?? null,
            lat: r.lat,
            lng: r.lng,
            locationPrivate: !!r.locationPrivate,
            subId: r.subId,
        }));
    } catch (err) {
        // eBird being down/rate-limited shouldn't break the map page, only leave that layer empty
        console.error("eBird lookup failed:", err);
        return [];
    }
}
