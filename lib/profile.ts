import { neon } from "@neondatabase/serverless";
import { BIRD_GROUPS, OTHER_GROUP, groupOf } from "@/lib/birdGroups";
import { buildStamps, type Stamp } from "@/lib/stamps";

export type RecentSighting = {
    sightingId: number;
    birdId: number;
    name: string;
    photoUrl: string | null;
    seenAt: number; // unix seconds
};

export type PageProgress = { name: string; found: number; total: number };

export type Profile = {
    userId: number;
    username: string | null;
    species: number;
    totalSpecies: number;
    sightings: number;
    photos: number;
    daysOut: number;
    firstSeenAt: number | null; // unix seconds
    recent: RecentSighting[];
    stamps: Stamp[];
    pages: PageProgress[];
};

// Local time for "days outside" and the early-bird stamp. seen_at has no timezone of its own and the
// list is Spain-only for now (docs/CONCEPT.md, section 7), so Madrid it is.
const LOCAL_TZ = "Europe/Madrid";

// The pixel font has no accents; the dex strips them from names the same way.
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function getProfile(email: string): Promise<Profile | null> {
    const sql = neon(process.env.DATABASE_URL || "");
    const [user] = await sql`SELECT user_id, username FROM users WHERE email = ${email};` as { user_id: number; username: string | null }[];
    if (!user) return null;
    const userId = user.user_id;

    const totalsQuery = sql`
        SELECT COUNT(*)::int AS sightings,
               COUNT(photo_url)::int AS photos,
               COUNT(DISTINCT bird_id)::int AS species,
               COUNT(DISTINCT (seen_at AT TIME ZONE ${LOCAL_TZ})::date)::int AS days_out,
               EXTRACT(EPOCH FROM MIN(seen_at)) AS first_seen,
               COALESCE(BOOL_OR(EXTRACT(HOUR FROM seen_at AT TIME ZONE ${LOCAL_TZ}) < 7), false) AS early_bird
        FROM sightings WHERE user_id = ${userId};
    `;
    const repeatQuery = sql`
        SELECT COALESCE(MAX(days), 0)::int AS max_days FROM (
            SELECT COUNT(DISTINCT (seen_at AT TIME ZONE ${LOCAL_TZ})::date) AS days
            FROM sightings WHERE user_id = ${userId} GROUP BY bird_id
        ) per_bird;
    `;
    const foundQuery = sql`
        SELECT b.family, COUNT(DISTINCT s.bird_id)::int AS n
        FROM sightings s JOIN birds b ON b.bird_id = s.bird_id
        WHERE s.user_id = ${userId} GROUP BY b.family;
    `;
    const allQuery = sql`SELECT family, COUNT(*)::int AS n FROM birds GROUP BY family;`;
    const recentQuery = sql`
        SELECT s.sighting_id, s.bird_id, b.common_name, s.photo_url, EXTRACT(EPOCH FROM s.seen_at) AS seen_at
        FROM sightings s JOIN birds b ON b.bird_id = s.bird_id
        WHERE s.user_id = ${userId}
        ORDER BY s.seen_at DESC LIMIT 6;
    `;

    const [[totals], [repeat], foundRows, allRows, recentRows] = await Promise.all([
        totalsQuery, repeatQuery, foundQuery, allQuery, recentQuery,
    ]) as [
        { sightings: number; photos: number; species: number; days_out: number; first_seen: number | string | null; early_bird: boolean }[],
        { max_days: number }[],
        { family: string; n: number }[],
        { family: string; n: number }[],
        { sighting_id: number; bird_id: number; common_name: string; photo_url: string | null; seen_at: number | string }[],
    ];

    // sticker pages: found / total per bird group
    const found = new Map<string, number>();
    for (const row of foundRows) found.set(groupOf(row.family), (found.get(groupOf(row.family)) ?? 0) + row.n);
    const total = new Map<string, number>();
    for (const row of allRows) total.set(groupOf(row.family), (total.get(groupOf(row.family)) ?? 0) + row.n);

    const pages: PageProgress[] = [...BIRD_GROUPS.map(g => g.name), OTHER_GROUP]
        .filter(name => (total.get(name) ?? 0) > 0)
        .map(name => ({ name, found: found.get(name) ?? 0, total: total.get(name) ?? 0 }));

    const stamps = buildStamps({
        species: totals.species,
        photos: totals.photos,
        groupFound: Object.fromEntries(found),
        earlyBird: totals.early_bird,
        maxDaysOneBird: repeat.max_days,
    });

    return {
        userId,
        username: user.username,
        species: totals.species,
        totalSpecies: allRows.reduce((sum, row) => sum + row.n, 0),
        sightings: totals.sightings,
        photos: totals.photos,
        daysOut: totals.days_out,
        firstSeenAt: totals.first_seen == null ? null : Math.floor(Number(totals.first_seen)),
        recent: recentRows.map(row => ({
            sightingId: row.sighting_id,
            birdId: row.bird_id,
            name: plain(row.common_name),
            photoUrl: row.photo_url,
            seenAt: Math.floor(Number(row.seen_at)),
        })),
        stamps,
        pages,
    };
}
