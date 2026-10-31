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
export type IdentifyError = { error: "no_image" | "backend" | "no_bird" | "unauthorized" };

// the client sends a downscaled JPEG, so this is generous
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type BackendResult = {
    prediction?: string;
    top_5_predictions?: { species: string; confidence: number }[];
};

const errorResponse = (error: IdentifyError["error"], status: number) =>
    Response.json({ error } satisfies IdentifyError, { status });

export async function POST(req: Request) {
    // signed-in users only: this relays images to the identifier backend and queries the DB
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) return errorResponse("unauthorized", 401);

    let file: FormDataEntryValue | null;
    try {
        file = (await req.formData()).get("image");
    } catch {
        return errorResponse("no_image", 400);
    }
    if (!(file instanceof Blob) || file.size === 0) return errorResponse("no_image", 400);
    if (file.size > MAX_IMAGE_BYTES) return errorResponse("no_image", 413);

    const url = process.env.BACKEND_IDENTIFY;
    if (!url) {
        console.error("identify: BACKEND_IDENTIFY is not set");
        return errorResponse("backend", 502);
    }
    const backendForm = new FormData();
    backendForm.append("file", file);

    let result: BackendResult;
    try {
        // a hung backend must not hold the request (and the user's "analyzing" screen) until the platform kills it
        const response = await fetch(url, { method: "POST", body: backendForm, signal: AbortSignal.timeout(20_000) });
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

    let rows: Record<string, any>[];
    const history = new Map<number, { count: number; lastSeenAt: number | null }>();
    try {
        // one query for all candidates instead of one per species
        rows = await sql`
            SELECT bird_id, common_name, scientific_name, family, name_es, name_en, pb, na, ca, seo_notes
            FROM birds WHERE scientific_name = ANY(${names});
        `;

        const ids = rows.map(row => row.bird_id as number);
        if (ids.length) {
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
    } catch (error) {
        // without this a DB hiccup came back as an HTML 500 and the user only saw "backend"
        console.error("identify: database error", error);
        return errorResponse("backend", 502);
    }
    const byName = new Map(rows.map(row => [row.scientific_name as string, row]));

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
