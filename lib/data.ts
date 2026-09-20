
import { neon } from "@neondatabase/serverless";

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