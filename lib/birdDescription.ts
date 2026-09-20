import type { BirdInfo } from "@/app/api/bird_info/route";

// In-memory cache for /api/bird_info, shared by the whole client session. Home warms it while a bird
// stays selected, so the bird page usually finds the info already there instead of waiting.
// (The API's Cache-Control uses s-maxage, which browsers ignore, so this is what caches on the client.)
// Client-side copy of the API's empty result (importing the route module at runtime would bundle its HTML parser)
export const EMPTY_BIRD_INFO: BirdInfo = {
    summary: "",
    taxonomy: [],
    status: { code: null, label: null, image: null },
    rangeMap: null,
    photo: null,
    tabs: { datos: [], area: [], vida: [], mas: [] },
};

const pending = new Map<string, Promise<BirdInfo>>();
const resolved = new Map<string, BirdInfo>();

export function loadBirdDescription(scientificName: string): Promise<BirdInfo> {
    const cached = pending.get(scientificName);
    if (cached) return cached;

    const request = fetch(`/api/bird_info?name=${encodeURIComponent(scientificName)}`)
        .then(response => response.json())
        .then((info: BirdInfo) => {
            resolved.set(scientificName, info);
            return info;
        })
        .catch(error => {
            // drop the failed request so the next attempt retries instead of reusing the failure
            pending.delete(scientificName);
            throw error;
        });

    pending.set(scientificName, request);
    return request;
}

// Synchronous read, so prefetched info renders on the first paint with no loading flash.
export function peekBirdDescription(scientificName: string): BirdInfo | undefined {
    return resolved.get(scientificName);
}
