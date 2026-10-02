
import { neon } from "@neondatabase/serverless";

export type SightingStamp = { name: string; seenAt: number }; // seenAt: unix seconds
export type HeatmapCell = { lat: number; lng: number; count: number; latest: SightingStamp[] };
export type BirdHeatmap = {
    cells: HeatmapCell[];
    latest: SightingStamp[]; // latest 3 sightings of the bird overall (with or without location)
    total: number;
    located: number;
    observers: number;
};

// All users' sightings of a bird for the map. Coordinates are rounded to 0.01° (~1 km) and grouped in the
// database, so exact locations never leave the server; each cell carries its latest 3 observers
// (username only, never the email) with the sighting time.
export async function birdHeatmap(birdId: number): Promise<BirdHeatmap> {
    const sql = neon(process.env.DATABASE_URL || "");

    // location is free text: only "lat,lng" rows count. [.] instead of \. because the template's escaping eats backslashes.
    const cellsQuery = sql`
        WITH located AS (
            SELECT s.seen_at, u.username,
                   ROUND(TRIM(split_part(s.location, ',', 1))::numeric, 2)::float AS lat,
                   ROUND(TRIM(split_part(s.location, ',', 2))::numeric, 2)::float AS lng
            FROM sightings s JOIN users u ON u.user_id = s.user_id
            WHERE s.bird_id = ${birdId}
              AND s.location ~ '^ *-?[0-9]+([.][0-9]+)? *, *-?[0-9]+([.][0-9]+)? *$'
        ), ranked AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY lat, lng ORDER BY seen_at DESC) AS rn
            FROM located
        )
        SELECT lat, lng, COUNT(*)::int AS count,
               COALESCE(
                   json_agg(json_build_object('name', username, 'seenAt', EXTRACT(EPOCH FROM seen_at)) ORDER BY seen_at DESC)
                       FILTER (WHERE rn <= 3),
                   '[]'::json
               ) AS latest
        FROM ranked
        GROUP BY lat, lng;
    `;
    const latestQuery = sql`
        SELECT u.username AS name, EXTRACT(EPOCH FROM s.seen_at) AS "seenAt"
        FROM sightings s JOIN users u ON u.user_id = s.user_id
        WHERE s.bird_id = ${birdId}
        ORDER BY s.seen_at DESC LIMIT 3;
    `;
    const statsQuery = sql`
        SELECT COUNT(*)::int AS total, COUNT(DISTINCT user_id)::int AS observers
        FROM sightings WHERE bird_id = ${birdId};
    `;
    const [cellRows, latestRows, [stats]] = await Promise.all([cellsQuery, latestQuery, statsQuery]);

    const stamp = (row: { name: string | null; seenAt: number | string }): SightingStamp => ({
        name: row.name || "Birder",
        seenAt: Math.floor(Number(row.seenAt)),
    });
    const cells: HeatmapCell[] = (cellRows as { lat: number; lng: number; count: number; latest: { name: string | null; seenAt: number }[] }[])
        .filter(c => Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180)
        .map(c => ({ lat: c.lat, lng: c.lng, count: c.count, latest: c.latest.map(stamp) }));

    return {
        cells,
        latest: (latestRows as { name: string | null; seenAt: string }[]).map(stamp),
        total: (stats as { total: number }).total,
        located: cells.reduce((sum, c) => sum + c.count, 0),
        observers: (stats as { observers: number }).observers,
    };
}

export async function fetchBirdData(birdName: string) {
    const sql = neon(process.env.DATABASE_URL || "");
    const birds_data_raw = await sql`SELECT * FROM birds WHERE common_name = ${birdName} OR scientific_name = ${birdName} LIMIT 1;`;
    if (birds_data_raw.length === 0) {
        return null; // No bird found with the given name
    }
    const bird_data = birds_data_raw[0];
    const bird = {
        id: bird_data.bird_id,
        name: bird_data.common_name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        scientificName: bird_data.scientific_name,
        family: bird_data.family,
        subspecies: bird_data.subspecies,
        name_en: bird_data.name_en,
        name_es: bird_data.name_es,
        pb: bird_data.pb,
        na: bird_data.na,
        ca: bird_data.ca,
        seo_notes: bird_data.seo_notes,
    };
    return bird;
}

// fetch by id
export async function fetchBirdById(birdId: string) {
    const sql = neon(process.env.DATABASE_URL || "");
    const birds_data_raw = await sql`SELECT * FROM birds WHERE bird_id = ${birdId} LIMIT 1;`;
    if (birds_data_raw.length === 0) {
    }
    const bird_data = birds_data_raw[0];
    const bird = {
        id: bird_data.bird_id,
        name: bird_data.common_name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        scientificName: bird_data.scientific_name,
        family: bird_data.family,
        subspecies: bird_data.subspecies,
        name_en: bird_data.name_en,
        name_es: bird_data.name_es,
        pb: bird_data.pb,
        na: bird_data.na,
        ca: bird_data.ca,
        seo_notes: bird_data.seo_notes,
    };
    return bird;
}


// Same result as looking up the user by email and then calling sightingsByUserId, in one round trip.
export async function sightingsByUserEmail(email: string, birdId: string) {
    const sql = neon(process.env.DATABASE_URL || "");
    const sightings = await sql`
        SELECT s.*, EXTRACT(EPOCH FROM s.seen_at) AS seen_at_unix
        FROM sightings s
        JOIN users u ON u.user_id = s.user_id
        WHERE u.email = ${email} AND s.bird_id = ${birdId}
        ORDER BY s.seen_at DESC;`;
    return sightings.map((sighting: any) => ({
        ...sighting,
        seen_at: Number(sighting.seen_at_unix),
    }));
}

export async function sightingsByUserId(userId: string, birdId: string) {
    console.log("Fetching sightings for user:", userId, "and bird:", birdId);
    const sql = neon(process.env.DATABASE_URL || "");
    const sightings = await sql`SELECT *, EXTRACT(EPOCH FROM seen_at) AS seen_at_unix FROM sightings WHERE user_id = ${userId} and bird_id = ${birdId} ORDER BY seen_at DESC;`;
    // Map seen_at_unix to a number and optionally remove the original seen_at if not needed
    return sightings.map((sighting: any) => ({
        ...sighting,
        seen_at: Number(sighting.seen_at_unix),
    }));
}