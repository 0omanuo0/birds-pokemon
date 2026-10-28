import { cache } from "react";
import { neon } from "@neondatabase/serverless";
import { getSessionOrDevBypass } from "@/lib/session";

// The only user fields the browser gets (no email: it used to receive the whole users row).
export type ClientUser = { user_id: number; username: string | null };

// The signed-in user's row, created on their first visit. cache(): the root layout and the page share one lookup
// per request instead of each decoding the session and querying users.
export const getCurrentUser = cache(async (): Promise<{ email: string; name: string | null; user: ClientUser } | null> => {
    const session = await getSessionOrDevBypass();
    const email = session?.user?.email;
    if (!email) return null;

    const sql = neon(process.env.DATABASE_URL || "");
    const [found] = await sql`SELECT user_id, username FROM users WHERE email = ${email};` as ClientUser[];
    const user = found ?? (await sql`
        INSERT INTO users (email, username) VALUES (${email}, ${session.user?.name ?? null})
        RETURNING user_id, username;` as ClientUser[])[0];
    return { email, name: session.user?.name ?? null, user };
});
