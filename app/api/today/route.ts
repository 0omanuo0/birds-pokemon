import { todayFacts } from "@/lib/today";
import { getSessionOrDevBypass } from "@/lib/session";

// GET /api/today : the personal part of the Today page (last trip, last catch, on this day). No location needed,
// so it loads alongside /api/around.
export async function GET() {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) return Response.json({ error: "Not signed in" }, { status: 401 });
    const facts = await todayFacts(session.user.email);
    // not cached: it must change as soon as you catch something
    return Response.json(facts, { headers: { "Cache-Control": "no-store" } });
}
