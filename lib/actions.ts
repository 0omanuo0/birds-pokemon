"use server";

import { neon } from "@neondatabase/serverless";
import { revalidatePath } from "next/cache";
import { getSessionOrDevBypass } from "@/lib/session";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

// The signed-in user's row. Actions never trust a user id sent from the browser: server actions are
// public endpoints, so a client-supplied id would let anyone write or delete as anyone.
async function currentUserId(sql: ReturnType<typeof neon<false, false>>): Promise<number | null> {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) return null;
    const [user] = await sql`SELECT user_id FROM users WHERE email = ${session.user.email};` as { user_id: number }[];
    return user?.user_id ?? null;
}

export async function pushBird(
    birdId: number,
    imageId: string,
    location: string = "Unknown",
    timestamp: string = new Date().toISOString()
): Promise<ActionResult> {
    const sql = neon(process.env.DATABASE_URL || "");
    const userId = await currentUserId(sql);
    if (!userId) return { success: false, error: "Not signed in." };

    const img_url = process.env.CLOUDFLARE_R2_API_ENDPOINT + "/birds/" + birdId + "/" + imageId + ".webp";
    try {
        await sql`
            INSERT INTO sightings (user_id, bird_id, location, photo_url, seen_at)
            VALUES (${userId}, ${birdId}, ${location}, ${img_url}, ${timestamp}::timestamptz);
        `;
        revalidatePath("/");
        revalidatePath(`/bird/${birdId}`);
        return { success: true };
    } catch (error) {
        console.error("Error inserting sighting:", error);
        return { success: false, error: "Failed to insert sighting." };
    }
}