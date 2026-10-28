import { after } from "next/server";
import { around } from "@/lib/around";
import { getSessionOrDevBypass } from "@/lib/session";

// A fill is 12 GBIF calls; give the work that runs after the response room to finish.
export const maxDuration = 60;

// GET /api/around?lat=..&lng=.. : what is normally around here at this time of year, and what was seen lately.
// If the cell has never been asked for, answers { status: "filling" } and fills it after the response; the client asks again shortly.
export async function GET(req: Request) {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) return Response.json({ error: "Not signed in" }, { status: 401 });

    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat")), lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return Response.json({ error: "Invalid params" }, { status: 400 });
    }

    // dev only: ?date=2026-10-25 to see another day's bird of the day
    const dateParam = process.env.NODE_ENV !== "production" ? url.searchParams.get("date") : null;
    const date = dateParam && !Number.isNaN(Date.parse(dateParam)) ? new Date(dateParam) : new Date();

    // one database round trip for the answer; counting the request, the eBird refresh and filling a new cell run after it
    const { result, background } = await around(lat, lng, session.user.email, date);
    after(background);
    // not cached: a bird you just caught must show as met when you come back (the query is ~50 ms)
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
