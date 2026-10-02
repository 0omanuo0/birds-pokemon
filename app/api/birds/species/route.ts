import { neon } from "@neondatabase/serverless";
import type { RegionCode } from "@/lib/regions";

// The dex's own species list, used to restrict BirdNET's 6522 global classes to birds that actually
// occur here. Without it the model happily reports North American warblers in Spain — BirdNET's own
// tooling always applies a species list before scoring, and this is ours.
//
// Names only: the client turns them into an index mask against labels.txt and never needs the rows.
// The English name rides along because our taxonomy and BirdNET's disagree on ~20 genus names
// (Larus audouinii vs Ichthyaetus audouinii, and friends), and the common name bridges them.

export type SpeciesListResponse = {
    species: { scientificName: string; nameEn: string | null }[];
    region: RegionCode | null;
};

const REGIONS = new Set<RegionCode>(["pb", "na", "ca"]);

export async function GET(req: Request) {
    const requested = new URL(req.url).searchParams.get("region");
    const region = REGIONS.has(requested as RegionCode) ? (requested as RegionCode) : null;

    const sql = neon(process.env.DATABASE_URL || "");
    // Three explicit branches rather than dynamic SQL: the column name can't be parameterised, and
    // interpolating it would be an injection hole for the sake of saving four lines.
    const rows = region === "pb"
        ? await sql`SELECT scientific_name, name_en FROM birds WHERE pb;`
        : region === "na"
            ? await sql`SELECT scientific_name, name_en FROM birds WHERE na;`
            : region === "ca"
                ? await sql`SELECT scientific_name, name_en FROM birds WHERE ca;`
                : await sql`SELECT scientific_name, name_en FROM birds;`;

    const species = rows
        .map(row => ({
            scientificName: (row.scientific_name as string | null)?.trim() ?? "",
            nameEn: (row.name_en as string | null)?.trim() || null,
        }))
        .filter(entry => entry.scientificName);

    return Response.json({ species, region } satisfies SpeciesListResponse, {
        // The dex list changes about never; let the browser keep it for the session.
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
}
