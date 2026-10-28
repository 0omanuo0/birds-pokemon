"use server";

import { neon } from "@neondatabase/serverless";
import { revalidatePath } from "next/cache";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "@/lib/s3";
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
        revalidatePath("/pokedex");
        revalidatePath(`/bird/${birdId}`);
        return { success: true };
    } catch (error) {
        console.error("Error inserting sighting:", error);
        return { success: false, error: "Failed to insert sighting." };
    }
}

// Deletes one of the signed-in user's sightings and its photo. remaining = the user's sightings of
// that bird left afterwards (0 means the bird is back to unseen in their dex).
export async function deleteSighting(sightingId: number): Promise<ActionResult<{ remaining: number }>> {
    const sql = neon(process.env.DATABASE_URL || "");
    const userId = await currentUserId(sql);
    if (!userId) return { success: false, error: "Not signed in." };

    try {
        // the user_id condition makes deleting someone else's sighting a no-op
        const [deleted] = await sql`
            DELETE FROM sightings WHERE sighting_id = ${sightingId} AND user_id = ${userId}
            RETURNING bird_id, photo_url;
        ` as { bird_id: number; photo_url: string | null }[];
        if (!deleted) return { success: false, error: "Sighting not found." };

        // photo_url is "<public endpoint>/birds/<bird>/<image>.webp"; the object key is the part after the endpoint
        const endpoint = process.env.CLOUDFLARE_R2_API_ENDPOINT ?? "";
        if (deleted.photo_url && endpoint && deleted.photo_url.startsWith(endpoint + "/")) {
            const key = deleted.photo_url.slice(endpoint.length + 1);
            try {
                await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET, Key: key }));
            } catch (error) {
                // the sighting is already gone; an orphaned image in the bucket isn't worth failing the delete
                console.error("Sighting deleted but its image couldn't be removed:", key, error);
            }
        }

        const [{ count }] = await sql`
            SELECT COUNT(*)::int AS count FROM sightings WHERE user_id = ${userId} AND bird_id = ${deleted.bird_id};
        ` as { count: number }[];

        revalidatePath("/");
        revalidatePath("/pokedex");
        revalidatePath(`/bird/${deleted.bird_id}`);
        return { success: true, remaining: count };
    } catch (error) {
        console.error("Error deleting sighting:", error);
        return { success: false, error: "Failed to delete sighting." };
    }
}
