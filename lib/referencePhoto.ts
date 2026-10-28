import { loadBirdDescription } from "@/lib/birdDescription";

// A species' reference photo: the lead image of its Wikipedia article. The REST summary endpoint is a
// small JSON straight from the browser (CORS allowed), far quicker than /api/bird_info, which downloads
// and parses the whole article; that stays the fallback for species the summary has no image for.
// Results are cached for the session, and the image itself is warmed so the photo window gets it from
// the browser cache.

const cache = new Map<string, Promise<string | null>>();
const resolved = new Map<string, string | null>();

function warm(src: string) {
    const image = new Image();
    image.crossOrigin = "anonymous"; // same request mode as the photo window, so it hits the cache
    image.src = src;
}

async function fetchSummaryThumbnail(scientificName: string): Promise<string | null> {
    const title = encodeURIComponent(scientificName.trim().replace(/\s+/g, "_"));
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
    if (!response.ok) return null;
    const json = await response.json();
    return json?.thumbnail?.source ?? null;
}

export function loadReferencePhoto(scientificName: string): Promise<string | null> {
    const cached = cache.get(scientificName);
    if (cached) return cached;

    const request = fetchSummaryThumbnail(scientificName)
        .catch(() => null)
        .then(src => src ?? loadBirdDescription(scientificName).then(info => info.photo?.src ?? null).catch(() => null))
        .then(src => {
            resolved.set(scientificName, src);
            if (src) warm(src);
            return src;
        });

    cache.set(scientificName, request);
    return request;
}

// Synchronous read, so a prefetched photo renders on the first paint. undefined = not looked up yet.
export function peekReferencePhoto(scientificName: string): string | null | undefined {
    return resolved.get(scientificName);
}
