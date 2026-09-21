import { fetchBirdById } from "@/lib/data";
import { ebirdRecentNearby } from "@/lib/ebird";
import { getSessionOrDevBypass } from "@/lib/session";

// Backs the map page's "refetch as you pan/zoom": the client sends the visible area's center + radius,
// this route resolves the bird id to a scientific name and calls eBird server-side, so EBIRD_API_KEY
// never reaches the browser.
export async function GET(req: Request) {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) return Response.json({ error: "Not signed in" }, { status: 401 });

    const url = new URL(req.url);
    const birdId = url.searchParams.get("birdId") || "";
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const dist = Math.min(50, Math.max(1, Number(url.searchParams.get("dist")) || 25));
    if (!birdId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return Response.json({ error: "Invalid params" }, { status: 400 });
    }

    const bird = await fetchBirdById(birdId);
    if (!bird) return Response.json({ error: "Bird not found" }, { status: 404 });

    const sightings = await ebirdRecentNearby(bird.scientificName, lat, lng, { dist, back: 14 });
    return Response.json({ sightings }, { headers: { "Cache-Control": "private, max-age=60" } });
}
