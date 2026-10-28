import { neon } from "@neondatabase/serverless";
import { getSessionOrDevBypass } from "@/lib/session";

export type BirdFact = { es: string; en: string; kind: "fact" | "funny" };

// GET /api/bird/facts?id=.. : the generated fun facts of one bird (scripts/facts/), for the Today buddy.
// Only complete entries are sent; an English line can be missing on "partial" birds.
export async function GET(req: Request) {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) return Response.json({ error: "Not signed in" }, { status: 401 });

    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Invalid id" }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL || "");
    const [row] = await sql`SELECT fun_facts FROM birds WHERE bird_id = ${id} LIMIT 1;`;
    const facts: BirdFact[] = Array.isArray(row?.fun_facts)
        ? row.fun_facts
            .filter((f: Partial<BirdFact>) => typeof f?.es === "string" && (f.kind === "fact" || f.kind === "funny"))
            .map((f: BirdFact) => ({ es: f.es, en: typeof f.en === "string" ? f.en : "", kind: f.kind }))
        : [];
    return Response.json({ facts }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
