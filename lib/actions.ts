"use server";

import { neon } from "@neondatabase/serverless";

export async function pushBird(
    userId: number,
    birdId: number,
    location: string = "Unknown",
    timestamp: string = new Date().toISOString()
) {
    const sql = neon(process.env.DATABASE_URL || "");
    const img_url = "img/bird_" + birdId + ".jpg"; ////////////// temporal
    try {
        // const idExists = await sql`
        //     SELECT 1 FROM sightings WHERE user_id = ${userId} AND bird_id = ${birdId};
        // `;
        await sql`
            INSERT INTO sightings (user_id, bird_id, location, photo_url, seen_at)
            VALUES (${userId}, ${birdId}, ${location}, ${img_url}, ${timestamp}::timestamptz);
        `;
        return { success: true };
    } catch (error) {
        console.error("Error inserting sighting:", error);
        return { success: false, error: "Failed to insert sighting." };
    }
}