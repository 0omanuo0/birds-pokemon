// Client-side cache for /api/bird, same shape as lib/birdDescription.ts: detections repeat constantly
// (the same robin is heard every few seconds), so without this every hit would be another round trip.
//
// Read-only: sound identification never writes a sighting, it just shows what it heard.

export type LookupBird = {
    id: number;
    name: string;
    scientificName: string;
    family: string;
};

// null = looked up and genuinely not in our list. BirdNET knows 6522 species and the dex list is
// smaller, so this is a normal outcome, not an error — those rows fall back to BirdNET's own name.
const pending = new Map<string, Promise<LookupBird | null>>();
const resolved = new Map<string, LookupBird | null>();

async function lookup(name: string): Promise<LookupBird | null> {
    const response = await fetch(`/api/bird?bird_name=${encodeURIComponent(name)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`bird lookup failed (${response.status})`);
    const data = await response.json();
    return { id: data.id, name: data.name, scientificName: data.scientificName, family: data.family };
}

/**
 * `commonName` is BirdNET's English name, tried when the scientific name finds nothing. BirdNET
 * follows a newer taxonomy than our list — it says Ichthyaetus audouinii where we store Larus
 * audouinii — and for those species the English name is the only thing both sides share.
 */
export function loadBirdByScientificName(scientificName: string, commonName?: string): Promise<LookupBird | null> {
    const cached = pending.get(scientificName);
    if (cached) return cached;

    const request = lookup(scientificName)
        .then(bird => (bird || !commonName ? bird : lookup(commonName)))
        .then(bird => {
            resolved.set(scientificName, bird);
            return bird;
        })
        .catch(error => {
            // drop the failed request so the next detection retries instead of reusing the failure
            pending.delete(scientificName);
            throw error;
        });

    pending.set(scientificName, request);
    return request;
}

// Synchronous read, so an already-known species renders on the first paint with no flash.
export function peekBirdByScientificName(scientificName: string): LookupBird | null | undefined {
    return resolved.get(scientificName);
}
