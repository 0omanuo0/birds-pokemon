import { neon } from "@neondatabase/serverless";

// The personal part of Today: your last trip (the latest day out with several photos, the seed of the future
// Journal, where such a day is an "adventure" and other sightings sit between them as a timeline), your last
// catch, and what you met on this day in an earlier year.

const LOCAL_TZ = "Europe/Madrid"; // seen_at has no timezone of its own and the list is Spain's, as in lib/profile.ts
const TRIP_MIN_PHOTOS = 3;
const TRIP_MIN_SIGHTINGS = 4;
const TRIP_PHOTOS_SHOWN = 5;

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

export type TodayBird = { id: number; name: string; scientificName: string; family: string };
export type Trip = {
    day: string;                 // YYYY-MM-DD, local
    location: string | null;     // "lat,lng" of the first located sighting, for reverse geocoding on the client
    photos: { birdId: number; url: string }[];
    birds: TodayBird[];          // every species met that day
    newBirds: TodayBird[];       // the ones met for the first time that day
};
export type Moment = { bird: TodayBird; at: number }; // unix seconds
export type TodayFacts = { sightings: number; trip: Trip | null; lastCatch: Moment | null; onThisDay: (Moment & { yearsAgo: number }) | null };

type Row = { bird_id: number; photo_url: string | null; location: string | null; at: string; day: string; common_name: string; scientific_name: string; family: string };

export async function todayFacts(email: string, now = new Date()): Promise<TodayFacts> {
    const sql = neon(process.env.DATABASE_URL || "");
    const rows = await sql`
        SELECT s.bird_id, s.photo_url, s.location, EXTRACT(EPOCH FROM s.seen_at)::float8 AS at,
               to_char(s.seen_at AT TIME ZONE ${LOCAL_TZ}, 'YYYY-MM-DD') AS day,
               b.common_name, b.scientific_name, b.family
        FROM sightings s JOIN users u ON u.user_id = s.user_id JOIN birds b ON b.bird_id = s.bird_id
        WHERE u.email = ${email}
        ORDER BY s.seen_at DESC;` as Row[];

    const bird = (r: Row): TodayBird => ({ id: r.bird_id, name: plain(r.common_name), scientificName: r.scientific_name, family: r.family });
    if (rows.length === 0) return { sightings: 0, trip: null, lastCatch: null, onThisDay: null };

    // the day each species was first met (rows are newest first, so the last one seen wins)
    const firstDay = new Map<number, string>();
    for (const r of rows) firstDay.set(r.bird_id, r.day);

    const byDay = new Map<string, Row[]>();
    for (const r of rows) {
        const list = byDay.get(r.day);
        if (list) list.push(r); else byDay.set(r.day, [r]);
    }

    let trip: Trip | null = null;
    for (const [day, list] of byDay) { // newest day first
        const withPhoto = list.filter(r => r.photo_url);
        if (withPhoto.length < TRIP_MIN_PHOTOS && list.length < TRIP_MIN_SIGHTINGS) continue;
        const species = new Map<number, TodayBird>();
        [...list].reverse().forEach(r => species.set(r.bird_id, bird(r))); // in the order they were met
        // one photo per bird first, so the strip shows the day's variety
        const photos: { birdId: number; url: string }[] = [], used = new Set<number>();
        for (const r of [...withPhoto].reverse()) if (!used.has(r.bird_id)) { used.add(r.bird_id); photos.push({ birdId: r.bird_id, url: r.photo_url! }); }
        trip = {
            day,
            location: list.find(r => r.location && /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(r.location))?.location ?? null,
            photos: photos.slice(0, TRIP_PHOTOS_SHOWN),
            birds: [...species.values()],
            newBirds: [...species.values()].filter(b => firstDay.get(b.id) === day),
        };
        break;
    }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: LOCAL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const [year, monthDay] = [Number(today.slice(0, 4)), today.slice(5)];
    const past = rows.find(r => r.day.slice(5) === monthDay && Number(r.day.slice(0, 4)) < year);

    return {
        sightings: rows.length,
        trip,
        lastCatch: { bird: bird(rows[0]), at: Math.floor(Number(rows[0].at)) },
        onThisDay: past ? { bird: bird(past), at: Math.floor(Number(past.at)), yearsAgo: year - Number(past.day.slice(0, 4)) } : null,
    };
}
