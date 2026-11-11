import { loadBirdDescription } from "@/lib/birdDescription";
import { fetchRetry } from "@/lib/fetchJson";

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

// How long a failed lookup is remembered, so a spinning wheel doesn't hammer Wikipedia but a transient failure heals.
const FAILURE_TTL_MS = 60_000;

type Lookup = { src: string | null; failed: boolean };

async function fetchSummaryThumbnail(scientificName: string): Promise<Lookup> {
    const title = encodeURIComponent(scientificName.trim().replace(/\s+/g, "_"));
    try {
        const response = await fetchRetry(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {}, { timeout: 6000 });
        if (response.status === 404) return { src: null, failed: false };
        if (!response.ok) return { src: null, failed: true };
        const json = await response.json();
        return { src: json?.thumbnail?.source ?? null, failed: false };
    } catch {
        return { src: null, failed: true };
    }
}

export function loadReferencePhoto(scientificName: string): Promise<string | null> {
    const cached = cache.get(scientificName);
    if (cached) return cached;

    const request = fetchSummaryThumbnail(scientificName)
        .then(async (summary): Promise<Lookup> => {
            if (summary.src) return summary;
            try {
                const info = await loadBirdDescription(scientificName);
                return { src: info.photo?.src ?? null, failed: summary.failed };
            } catch {
                return { src: null, failed: true };
            }
        })
        .then(({ src, failed }) => {
            if (failed && !src) {
                // not "this bird has no photo" but "we couldn't find out": forget it (after a short pause, so a
                // spinning wheel doesn't hammer Wikipedia) so the next look retries
                setTimeout(() => cache.delete(scientificName), FAILURE_TTL_MS);
                return null;
            }
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
