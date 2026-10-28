// pages/api/reverse-geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next'


const temp_Cache = new Map<string, string>();

export async function GET(req: Request) {

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

    const cacheKey = `${lat},${lon}`;
    if (temp_Cache.has(cacheKey)) {
        return new Response(
            JSON.stringify({ location: temp_Cache.get(cacheKey) }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
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

        temp_Cache.set(cacheKey, data.display_name);

        return new Response(
            JSON.stringify({ location: data.display_name }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
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
