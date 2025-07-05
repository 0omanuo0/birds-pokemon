// pages/api/reverse-geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next'

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

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BirdsPokemon/1.0 (manu365manu@gmail.com)',
            }
        });

        const data = await response.json();

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
