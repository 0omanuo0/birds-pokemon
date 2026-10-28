import { getSessionOrDevBypass } from '@/lib/session';

// Bounded, so a long-running server doesn't grow it forever; the oldest entry goes first.
const CACHE_MAX = 2000;
const temp_Cache = new Map<string, string>();

export async function GET(req: Request) {
    // signed-in users only: otherwise this is an open proxy to Nominatim under our contact address
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) {
        return Response.json({ message: 'Not signed in', status: 'error' }, { status: 401 });
    }

    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");

    if (!lat || !lon) {
        return new Response(
            JSON.stringify({
                message: 'Latitude and longitude are required',
                status: 'error',
            }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }

    // numbers only: both go straight into the Nominatim URL
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return new Response(
            JSON.stringify({ message: 'Latitude and longitude must be numbers', status: 'error' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // a place's name doesn't change: the browser keeps it for a day, so spinning back to a bird asks nothing
    const cacheHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=86400' };

    const cacheKey = `${Number(lat)},${Number(lon)}`;
    if (temp_Cache.has(cacheKey)) {
        return new Response(
            JSON.stringify({ location: temp_Cache.get(cacheKey) }),
            { status: 200, headers: cacheHeaders }
        );
    }

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BirdsPokemon/1.0 (manu365manu@gmail.com)',
            }
        });

        const data = await response.json();

        // only real answers are kept: a rate-limited or empty reply used to be cached as undefined for good
        if (!response.ok || typeof data?.display_name !== 'string') {
            return Response.json({ location: null }, { status: 200 });
        }
        if (temp_Cache.size >= CACHE_MAX) temp_Cache.delete(temp_Cache.keys().next().value!);
        temp_Cache.set(cacheKey, data.display_name);

        return new Response(
            JSON.stringify({ location: data.display_name }),
            { status: 200, headers: cacheHeaders }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Failed to fetch location' }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}
