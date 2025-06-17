
import { neon } from "@neondatabase/serverless";

export async function fetchBirdData(birdName: string) {
    const sql = neon(process.env.DATABASE_URL || "");
    const birds_data_raw = await sql`SELECT * FROM birds WHERE common_name = ${birdName} OR scientific_name = ${birdName} LIMIT 1;`;
    if (birds_data_raw.length === 0) {
        throw new Error('Bird not found');
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