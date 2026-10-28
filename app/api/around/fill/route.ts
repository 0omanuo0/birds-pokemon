import { drainQueue } from "@/lib/around";

export const maxDuration = 60;

// Drains the queue of cells somebody asked for (or the seed script queued), most requested first.
// For a cron job (Authorization: Bearer $CRON_SECRET) or by hand while developing. GET /api/around/fill?max=6
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    const authorised = secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
    if (!authorised) return Response.json({ error: "Forbidden" }, { status: 403 });

    const max = Math.min(20, Math.max(1, Number(new URL(req.url).searchParams.get("max")) || 5));
    return Response.json(await drainQueue(max, 45_000));
}
