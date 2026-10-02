import { neon } from "@neondatabase/serverless";
import { getSessionOrDevBypass } from "@/lib/session";

export type IdentifyBird = {
    id: number;
    name: string;
    scientificName: string;
    family: string;
    nameEs: string | null;
    nameEn: string | null;
    pb: boolean;
    na: boolean;
    ca: boolean;
    rare: boolean;
};

export type IdentifyCandidate = {
    scientificName: string;
    confidence: number; // 0..1
    bird: IdentifyBird | null; // null = species not in the SEO/BirdLife list
    seen: { count: number; lastSeenAt: number | null } | null; // signed-in user's history (unix seconds)
};

export type IdentifyResponse = { candidates: IdentifyCandidate[] };
export type IdentifyError = { error: "no_image" | "backend" | "no_bird" };

type BackendResult = {
    prediction?: string;
    top_5_predictions?: { species: string; confidence: number }[];
};

const errorResponse = (error: IdentifyError["error"], status: number) =>
    Response.json({ error } satisfies IdentifyError, { status });

export async function POST(req: Request) {
    const formData = await req.formData();
    const file = formData.get("image");
    if (!(file instanceof Blob)) return errorResponse("no_image", 400);

    const url = process.env.BACKEND_IDENTIFY || "http://10.1.1.108:5000/predict";
    const backendForm = new FormData();
    backendForm.append("file", file);

    let result: BackendResult;
    try {
        const response = await fetch(url, { method: "POST", body: backendForm });
        if (!response.ok) {
            console.error("identify: backend responded", response.status, response.statusText);
            return errorResponse("backend", 502);
        }
        result = await response.json();
    } catch (error) {
        console.error("identify: backend unreachable", error);
        return errorResponse("backend", 502);
    }

    // Keep every guess, even ones that aren't in our list (they're still useful as "could be…").
    const guesses = result.top_5_predictions?.length
        ? result.top_5_predictions
        : result.prediction ? [{ species: result.prediction, confidence: 1 }] : [];
    if (guesses.length === 0) return errorResponse("no_bird", 422);

    const sql = neon(process.env.DATABASE_URL || "");
    const names = guesses.map(g => g.species);

    // one query for all candidates instead of one per species
    const rows = await sql`
        SELECT bird_id, common_name, scientific_name, family, name_es, name_en, pb, na, ca, seo_notes
        FROM birds WHERE scientific_name = ANY(${names});
    `;
    const byName = new Map(rows.map(row => [row.scientific_name as string, row]));

    const session = await getSessionOrDevBypass();
    const ids = rows.map(row => row.bird_id as number);
    const history = new Map<number, { count: number; lastSeenAt: number | null }>();
    if (session?.user?.email && ids.length) {
        const seenRows = await sql`
            SELECT s.bird_id, COUNT(*)::int AS count, EXTRACT(EPOCH FROM MAX(s.seen_at)) AS last_seen
            FROM sightings s JOIN users u ON u.user_id = s.user_id
            WHERE u.email = ${session.user.email} AND s.bird_id = ANY(${ids})
            GROUP BY s.bird_id;
        `;
        for (const row of seenRows) {
            history.set(row.bird_id, {
                count: Number(row.count),
                lastSeenAt: row.last_seen === null ? null : Math.floor(Number(row.last_seen)),
            });
        }
    }

    const candidates: IdentifyCandidate[] = guesses.map(guess => {
        const row = byName.get(guess.species);
        const bird: IdentifyBird | null = row ? {
            id: row.bird_id,
            name: row.common_name,
            scientificName: row.scientific_name,
            family: row.family,
            nameEs: row.name_es ?? null,
            nameEn: row.name_en ?? null,
            pb: !!row.pb,
            na: !!row.na,
            ca: !!row.ca,
            rare: /\bR[12]\b/.test(row.seo_notes ?? ""),
        } : null;
        return {
            scientificName: guess.species,
            confidence: guess.confidence,
            bird,
            seen: bird ? (history.get(bird.id) ?? { count: 0, lastSeenAt: null }) : null,
        };
    });

    return Response.json({ candidates } satisfies IdentifyResponse);
}
