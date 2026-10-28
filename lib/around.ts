import { neon } from "@neondatabase/serverless";

// "Around you at this time of year": which of our species are normally reported near a point in this part of the
// year (GBIF's copy of the eBird dataset, cached per grid cell and month in our own DB) and which were reported
// in the last days (eBird's live API, also cached per cell). Users only ever read our DB, so one API key's
// limits (eBird: 500 requests/hour) don't depend on how many people use the app. Tables: migrations/001_*.sql.
// A cell nobody has asked for yet is filled the first time somebody does (see fillCell).

export const CELL_DEG = 0.2;                  // about 20 km
const GBIF_DATASET = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"; // "EOD – eBird Observation Dataset", CC BY 4.0
const GBIF_YEARS = "2018,2024";               // Spain's copy ends in 2024; 2020 is skewed but a 7 year window absorbs it
const EBIRD_TTL_MS = 6 * 60 * 60 * 1000;
const RUNNING_STALE_MS = 15 * 60 * 1000;

// Europe and Africa, with the Atlantic islands. Anywhere else answers "unsupported" and costs nothing.
const BOUNDS = { latMin: -35.5, latMax: 72, lngMin: -26, lngMax: 62 };

export type Cell = { lat: number; lng: number }; // integer grid indices

export const cellOf = (lat: number, lng: number): Cell => ({ lat: Math.floor((lat + 90) / CELL_DEG), lng: Math.floor((lng + 180) / CELL_DEG) });
export const inSupportedArea = (lat: number, lng: number) => lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax;
const cellCentre = (c: Cell) => ({ lat: (c.lat + 0.5) * CELL_DEG - 90, lng: (c.lng + 0.5) * CELL_DEG - 180 });
const cellPolygon = (c: Cell) => {
    const s = c.lat * CELL_DEG - 90, w = c.lng * CELL_DEG - 180, n = s + CELL_DEG, e = w + CELL_DEG;
    const f = (v: number) => v.toFixed(4);
    return `POLYGON((${f(w)} ${f(s)},${f(e)} ${f(s)},${f(e)} ${f(n)},${f(w)} ${f(n)},${f(w)} ${f(s)}))`; // counter-clockwise, as GBIF wants
};

// Position in the year as two months and their weights: 19 Oct is mostly October and a little November,
// because a month's counts describe its middle.
export function monthWeights(date: Date): { month: number; weight: number }[] {
    const m = date.getUTCMonth() + 1, d = date.getUTCDate();
    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), m, 0)).getUTCDate();
    const pos = (d - 0.5) / daysInMonth; // 0..1 through the month
    if (pos >= 0.5) return [{ month: m, weight: 1.5 - pos }, { month: (m % 12) + 1, weight: pos - 0.5 }];
    return [{ month: m, weight: 0.5 + pos }, { month: m === 1 ? 12 : m - 1, weight: 0.5 - pos }];
}

const db = () => neon(process.env.DATABASE_URL || "");
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

// ───────────────────────── filling a cell from GBIF ─────────────────────────

async function gbifMonth(cell: Cell, month: number): Promise<Record<string, number>> {
    const url = new URL("https://api.gbif.org/v1/occurrence/search");
    url.searchParams.set("datasetKey", GBIF_DATASET);
    url.searchParams.set("geometry", cellPolygon(cell));
    url.searchParams.set("month", String(month));
    url.searchParams.set("year", GBIF_YEARS);
    url.searchParams.set("facet", "speciesKey");
    url.searchParams.set("facetLimit", "1500");
    url.searchParams.set("limit", "0");
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`GBIF ${res.status}`);
            const body = await res.json();
            const out: Record<string, number> = {};
            for (const f of body.facets?.[0]?.counts ?? []) out[f.name] = f.count;
            return out;
        } catch (error) {
            if (attempt === 2) throw error;
            await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        }
    }
    return {};
}

// Takes the cell for this caller: only one fills it at a time. Returns false if it's done, running elsewhere, or not asked for.
async function claim(cell: Cell): Promise<boolean> {
    const sql = db();
    const rows = await sql`
        UPDATE area_fetch SET status = 'running', attempts = attempts + 1, last_error = NULL
        WHERE cell_lat = ${cell.lat} AND cell_lng = ${cell.lng} AND source = 'gbif'
          AND (status IN ('pending', 'error') OR (status = 'running' AND last_requested_at < now() - ${RUNNING_STALE_MS / 1000} * interval '1 second'))
        RETURNING 1 AS ok;`;
    return rows.length > 0;
}

// 12 GBIF calls (one per month), a few seconds. Safe to call for any cell; does nothing unless it can claim it.
export async function fillCell(cell: Cell): Promise<{ filled: boolean; species?: number; error?: string }> {
    if (!(await claim(cell))) return { filled: false };
    const sql = db();
    try {
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        const results: Record<number, Record<string, number>> = {};
        // three at a time: polite to GBIF, still quick
        for (let i = 0; i < months.length; i += 3) {
            await Promise.all(months.slice(i, i + 3).map(async m => { results[m] = await gbifMonth(cell, m); }));
        }
        const all = new Set<string>();
        let records = 0;
        for (const m of months) {
            const species = results[m];
            const total = Object.values(species).reduce((a, b) => a + b, 0);
            records += total;
            Object.keys(species).forEach(k => all.add(k));
            await sql`
                INSERT INTO area_species_month (cell_lat, cell_lng, month, species, records, fetched_at)
                VALUES (${cell.lat}, ${cell.lng}, ${m}, ${JSON.stringify(species)}::jsonb, ${total}, now())
                ON CONFLICT (cell_lat, cell_lng, month) DO UPDATE SET species = EXCLUDED.species, records = EXCLUDED.records, fetched_at = now();`;
        }
        await sql`
            UPDATE area_fetch SET status = 'done', fetched_at = now(), data_from_year = 2018, data_to_year = 2024, records = ${records}, species = ${all.size}
            WHERE cell_lat = ${cell.lat} AND cell_lng = ${cell.lng} AND source = 'gbif';`;
        // lookups read the precomputed ranking, so build it now; neighbours that already have one gain a neighbour
        try {
            await buildRank(cell);
            await rebuildNeighbours(cell);
        } catch { /* a lookup builds a missing ranking itself */ }
        return { filled: true, species: all.size };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await sql`UPDATE area_fetch SET status = 'error', last_error = ${message.slice(0, 300)} WHERE cell_lat = ${cell.lat} AND cell_lng = ${cell.lng} AND source = 'gbif';`;
        return { filled: false, error: message };
    }
}

// Fills pending cells, most asked-for first, until the time budget is used. For the cron/worker route and the seed script.
export async function drainQueue(maxCells: number, budgetMs: number) {
    const sql = db();
    const started = Date.now();
    const done: { cell: Cell; species?: number; error?: string }[] = [];
    while (done.length < maxCells && Date.now() - started < budgetMs) {
        const [next] = await sql`
            SELECT cell_lat, cell_lng FROM area_fetch
            WHERE source = 'gbif' AND (status = 'pending' OR (status = 'error' AND attempts < 3))
            ORDER BY requested_count DESC, last_requested_at LIMIT 1;` as { cell_lat: number; cell_lng: number }[];
        if (!next) break;
        const cell = { lat: next.cell_lat, lng: next.cell_lng };
        const r = await fillCell(cell);
        done.push({ cell, species: r.species, error: r.error });
        if (!r.filled && !r.error) break; // lost the claim to someone else; don't spin
    }
    const [left] = await sql`SELECT count(*)::int AS n FROM area_fetch WHERE source = 'gbif' AND status IN ('pending', 'error');` as { n: number }[];
    return { done, pendingLeft: left.n };
}

// ───────────────────────── our birds, in memory ─────────────────────────

// The 600-odd species change rarely, so each server instance keeps them for a while instead of joining on every lookup.
type BirdInfo = { id: number; name: string; scientificName: string; family: string; gbifKey: number | null; ebirdCode: string | null };
type BirdTable = { byId: Map<number, BirdInfo>; idByGbifKey: Map<number, number> };
const BIRDS_TTL_MS = 60 * 60 * 1000;
let birdTable: { at: number; table: Promise<BirdTable> } | null = null;

function birds(): Promise<BirdTable> {
    if (birdTable && Date.now() - birdTable.at < BIRDS_TTL_MS) return birdTable.table;
    const table = (async () => {
        const rows = await db()`SELECT bird_id, common_name, scientific_name, family, gbif_key, ebird_code FROM birds ORDER BY bird_id;` as
            { bird_id: number; common_name: string; scientific_name: string; family: string; gbif_key: number | null; ebird_code: string | null }[];
        const byId = new Map<number, BirdInfo>(), idByGbifKey = new Map<number, number>();
        for (const b of rows) {
            byId.set(b.bird_id, { id: b.bird_id, name: plain(b.common_name), scientificName: b.scientific_name, family: b.family, gbifKey: b.gbif_key, ebirdCode: b.ebird_code });
            // two of our rows can share a GBIF key (lumped species): the first one stands for it
            if (b.gbif_key != null && !idByGbifKey.has(b.gbif_key)) idByGbifKey.set(b.gbif_key, b.bird_id);
        }
        return { byId, idByGbifKey };
    })();
    birdTable = { at: Date.now(), table };
    table.catch(() => { if (birdTable?.table === table) birdTable = null; }); // do not keep a failure
    return table;
}

// ───────────────────────── the precomputed ranking (area_cell_rank) ─────────────────────────

type RankMonths = Record<string, [number, number][]>; // month -> [[bird_id, score], ...] best first
const RANK_KEEP = 80;

// Blends this cell and its eight neighbours (the neighbours count half) into one ranked list of OUR birds per month,
// so a lookup does no arithmetic over GBIF keys. score = share of the cell-month's records.
export async function buildRank(cell: Cell): Promise<RankMonths | null> {
    const sql = db();
    const [rows, table] = await Promise.all([
        sql`SELECT cell_lat, cell_lng, month, species, records FROM area_species_month
            WHERE cell_lat BETWEEN ${cell.lat - 1} AND ${cell.lat + 1} AND cell_lng BETWEEN ${cell.lng - 1} AND ${cell.lng + 1} AND records > 0;`
            .then(r => r as { cell_lat: number; cell_lng: number; month: number; species: Record<string, number>; records: number }[]),
        birds(),
    ]);
    const isOwn = (r: { cell_lat: number; cell_lng: number }) => r.cell_lat === cell.lat && r.cell_lng === cell.lng;
    if (rows.length === 0) return null; // a filled cell with nothing reported (open sea) still borrows its neighbours

    // Two blends per month. "1".."12": neighbours at half weight, the wide view (about 65 x 50 km) for the bird of the day
    // and the season's changes. "n1".."n12": neighbours at a quarter, so "near you" leans on your own cell and a city
    // isn't mixed up with the hills around it.
    const blend = (neighbourWeight: number) => {
        const perMonth = new Map<number, Map<number, number>>();
        for (const r of rows) {
            const w = isOwn(r) ? 1 : neighbourWeight;
            let scores = perMonth.get(r.month);
            if (!scores) perMonth.set(r.month, scores = new Map());
            for (const [key, n] of Object.entries(r.species)) {
                const id = table.idByGbifKey.get(Number(key));
                if (id != null) scores.set(id, (scores.get(id) ?? 0) + (n / r.records) * w);
            }
        }
        return perMonth;
    };
    const months: RankMonths = {};
    const keep = (scores: Map<number, number>) => [...scores].sort((a, b) => b[1] - a[1]).slice(0, RANK_KEEP).map(([id, s]) => [id, Math.round(s * 1e6) / 1e6] as [number, number]);
    for (const [month, scores] of blend(0.5)) months[month] = keep(scores);
    for (const [month, scores] of blend(0.25)) months[`n${month}`] = keep(scores);
    const neighbours = new Set(rows.filter(r => !isOwn(r)).map(r => `${r.cell_lat}:${r.cell_lng}`)).size;
    await sql`
        INSERT INTO area_cell_rank (cell_lat, cell_lng, months, neighbours, built_at)
        VALUES (${cell.lat}, ${cell.lng}, ${JSON.stringify(months)}::jsonb, ${neighbours}, now())
        ON CONFLICT (cell_lat, cell_lng) DO UPDATE SET months = EXCLUDED.months, neighbours = EXCLUDED.neighbours, built_at = now();`;
    return months;
}

// A cell that just got data changes the ranking of the cells around it that were already built.
async function rebuildNeighbours(cell: Cell) {
    const near = await db()`
        SELECT cell_lat, cell_lng FROM area_cell_rank
        WHERE cell_lat BETWEEN ${cell.lat - 1} AND ${cell.lat + 1} AND cell_lng BETWEEN ${cell.lng - 1} AND ${cell.lng + 1}
          AND NOT (cell_lat = ${cell.lat} AND cell_lng = ${cell.lng});` as { cell_lat: number; cell_lng: number }[];
    for (const n of near) await buildRank({ lat: n.cell_lat, lng: n.cell_lng });
}

// ───────────────────────── eBird freshness ─────────────────────────

type Recent = { code: string; last: string; n: number | null };

async function fetchEbirdRecent(cell: Cell): Promise<Recent[] | null> {
    const key = process.env.EBIRD_API_KEY;
    if (!key) return null;
    const { lat, lng } = cellCentre(cell);
    // 25 km around the centre covers the whole cell; one row per species comes back (its latest report)
    const url = `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&dist=25&back=14&maxResults=10000`;
    try {
        const res = await fetch(url, { headers: { "X-eBirdApiToken": key }, cache: "no-store" });
        if (!res.ok) return null; // 429 and friends: use what we have
        const rows = await res.json() as { speciesCode: string; obsDt: string; howMany?: number }[];
        return rows.map(r => ({ code: r.speciesCode, last: r.obsDt, n: r.howMany ?? null }));
    } catch {
        return null;
    }
}

// Never on the way to an answer: a lookup serves what is cached (even if old) and this runs after the response.
// The memo stops a failing eBird (429) from being hit once per request for the same cell.
const recentTried = new Map<string, number>();
async function refreshRecent(cell: Cell) {
    const id = `${cell.lat}:${cell.lng}`;
    if (Date.now() - (recentTried.get(id) ?? 0) < 5 * 60 * 1000) return;
    recentTried.set(id, Date.now());
    const fresh = await fetchEbirdRecent(cell);
    if (!fresh) return;
    await db()`
        INSERT INTO area_ebird_recent (cell_lat, cell_lng, payload, fetched_at) VALUES (${cell.lat}, ${cell.lng}, ${JSON.stringify(fresh)}::jsonb, now())
        ON CONFLICT (cell_lat, cell_lng) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now();`;
}

// ───────────────────────── the lookup ─────────────────────────

// photo = the user's latest photo of it (null if none, or not met)
export type AroundBird = { id: number; name: string; scientificName: string; family: string; seen: boolean; fresh: boolean; score: number; photo: string | null };
// special = one day in seven the bird of the day comes from the rarer end of the area's list
export type DayBird = AroundBird & { special: boolean };
export type Around =
    | {
        status: "ready"; cell: Cell; month: number; reportedRecently: number;
        regulars: AroundBird[]; maybe: AroundBird[]; dayBird: DayBird | null; arriving: AroundBird[]; leaving: AroundBird[];
    }
    | { status: "filling" }
    | { status: "unsupported" };

// ───────────────────────── picking the bird of the day ─────────────────────────

// a small integer hash, so the same day gives the same bird on every visit and every device
function mix(n: number) {
    n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0;
    return Math.imul(n ^ (n >>> 13), 3266489909) >>> 0;
}

// Days since 1970 in Madrid, so the bird changes at local midnight, not at UTC midnight.
function localDay(date: Date): number {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" })
        .format(date).split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

const COMMON_SKIP = 12;      // the 12 commonest are already on the month page and in "maybe today"
const SPECIAL_FROM = 40;     // a special day picks from rank 40 down
const MIN_SHARE = 0.002;     // at least 0.2% of the area's records that month, so it's a bird you could really find
const NO_REPEAT_DAYS = 30;

export function isSpecialDay(day: number) { return mix(day * 13 + 5) % 7 === 0; }

// One weighted, seeded pick among the less common birds of the area. Not met counts x3, arriving this month x2,
// reported nearby this week x2. Earlier days' picks are replayed so the same bird doesn't come back within a month.
export function pickDayBird(ranked: AroundBird[], arrivingIds: Set<number>, day: number): DayBird | null {
    const pickOn = (d: number, exclude: Set<number>): AroundBird | null => {
        const special = isSpecialDay(d);
        let pool = ranked.slice(special ? SPECIAL_FROM : COMMON_SKIP).filter(b => b.score >= MIN_SHARE / (special ? 4 : 1) && !exclude.has(b.id));
        if (pool.length === 0) pool = ranked.filter(b => !exclude.has(b.id)); // a thin area: anything rather than nothing
        if (pool.length === 0) return null;
        const weight = (b: AroundBird) => (b.seen ? 1 : 3) * (arrivingIds.has(b.id) ? 2 : 1) * (b.fresh ? 2 : 1);
        const total = pool.reduce((s, b) => s + weight(b), 0);
        let r = (mix(d) / 4294967296) * total;
        for (const b of pool) { r -= weight(b); if (r < 0) return b; }
        return pool[pool.length - 1];
    };
    const recent = new Set<number>();
    for (let d = day - NO_REPEAT_DAYS; d < day; d++) {
        const b = pickOn(d, recent);
        if (b) recent.add(b.id);
    }
    const today = pickOn(day, recent);
    return today ? { ...today, special: isSpecialDay(day) } : null;
}

// Birds whose share jumps between two months: arriving = this month at least twice last month's, leaving = next month at
// most half of this one. A bird missing from a month's top 80 counts as a fraction of that month's smallest kept share.
function seasonShift(months: RankMonths, month: number) {
    const prev = month === 1 ? 12 : month - 1, next = (month % 12) + 1;
    const asMap = (m: number) => new Map(months[m] ?? []);
    const cur = asMap(month), before = asMap(prev), after = asMap(next);
    const floorOf = (m: Map<number, number>) => (m.size ? Math.min(...m.values()) : 0) / 2;
    const fb = floorOf(before), fa = floorOf(after);
    const arriving: number[] = [], leaving: number[] = [];
    for (const [id, s] of cur) {
        if (s < MIN_SHARE) continue;
        if (s >= 2 * (before.get(id) ?? fb)) arriving.push(id);
        if ((after.get(id) ?? fa) <= s / 2) leaving.push(id);
    }
    const byGain = (ratio: (id: number) => number) => (a: number, b: number) => ratio(b) - ratio(a);
    arriving.sort(byGain(id => (cur.get(id) ?? 0) / Math.max(before.get(id) ?? fb, 1e-6)));
    leaving.sort(byGain(id => (cur.get(id) ?? 0) / Math.max(after.get(id) ?? fa, 1e-6)));
    return { arriving: arriving.slice(0, 4), leaving: leaving.slice(0, 4) };
}

// Records the request (so popular cells get filled first) and says whether the cell is filled.
export async function touchCell(cell: Cell): Promise<"done" | "pending" | "running" | "error"> {
    const sql = db();
    const [row] = await sql`
        INSERT INTO area_fetch (cell_lat, cell_lng, source) VALUES (${cell.lat}, ${cell.lng}, 'gbif')
        ON CONFLICT (cell_lat, cell_lng, source) DO UPDATE SET requested_count = area_fetch.requested_count + 1, last_requested_at = now()
        RETURNING status;` as { status: "done" | "pending" | "running" | "error" }[];
    return row.status;
}

// One query for everything that depends on the request (the cell's ranking, this user's sightings, the cached eBird
// codes) while the bird table comes from memory. Anything that is not needed for the answer (counting the request,
// refreshing eBird, filling a new cell) is returned as `background` for the route to run after the response.
export async function around(lat: number, lng: number, email: string, date = new Date()): Promise<{ result: Around; background: () => Promise<unknown> }> {
    if (!inSupportedArea(lat, lng)) return { result: { status: "unsupported" }, background: async () => {} };
    const cell = cellOf(lat, lng);
    const sql = db();

    const [[row], table] = await Promise.all([
        sql`
            SELECT
                (SELECT months FROM area_cell_rank WHERE cell_lat = ${cell.lat} AND cell_lng = ${cell.lng}) AS months,
                (SELECT array_agg(DISTINCT s.bird_id) FROM sightings s JOIN users u ON u.user_id = s.user_id WHERE u.email = ${email}) AS seen,
                (SELECT jsonb_object_agg(bird_id, photo_url) FROM (
                    SELECT DISTINCT ON (s.bird_id) s.bird_id, s.photo_url FROM sightings s JOIN users u ON u.user_id = s.user_id
                    WHERE u.email = ${email} AND s.photo_url IS NOT NULL ORDER BY s.bird_id, s.seen_at DESC) p) AS photos,
                (SELECT array_agg(p->>'code') FROM area_ebird_recent r, jsonb_array_elements(r.payload) p WHERE r.cell_lat = ${cell.lat} AND r.cell_lng = ${cell.lng}) AS recent_codes,
                (SELECT fetched_at FROM area_ebird_recent WHERE cell_lat = ${cell.lat} AND cell_lng = ${cell.lng}) AS recent_at;`
            .then(r => r as { months: RankMonths | null; seen: (number | string)[] | null; photos: Record<string, string> | null; recent_codes: string[] | null; recent_at: string | null }[]),
        birds(),
    ]);

    let months = row.months;
    if (!months) {
        // no ranking yet: a cell filled before rankings existed gets one now; a cell nobody filled is queued and filled after the response
        const status = await touchCell(cell);
        if (status === "done") months = (await buildRank(cell)) ?? {}; // filled but empty (open sea): an honest empty answer
        if (!months) return { result: { status: "filling" }, background: async () => { if (status !== "running") await fillCell(cell); } };
    }

    const weights = monthWeights(date);
    // rankings built before the "near" blend existed get it after this response; until then near = wide
    const hasNear = Object.keys(months).some(k => k.startsWith("n"));
    const scoreOf = (prefix: string) => {
        const score = new Map<number, number>();
        for (const { month, weight } of weights) {
            for (const [id, s] of months![`${prefix}${month}`] ?? []) score.set(id, (score.get(id) ?? 0) + s * weight);
        }
        return score;
    };

    const seen = new Set((row.seen ?? []).map(Number));
    const photos = row.photos ?? {};
    const recent = new Set(row.recent_codes ?? []);
    const toBirds = (score: Map<number, number>) => {
        const out: AroundBird[] = [];
        for (const [id, s] of score) {
            const b = table.byId.get(id);
            if (b) out.push({
                id, name: b.name, scientificName: b.scientificName, family: b.family, seen: seen.has(id),
                fresh: !!b.ebirdCode && recent.has(b.ebirdCode), score: s, photo: photos[id] ?? null,
            });
        }
        return out.sort((a, b) => b.score - a.score);
    };
    const wide = toBirds(scoreOf(""));
    const near = hasNear ? toBirds(scoreOf("n")) : wide;
    const byId = new Map(wide.map(b => [b.id, b]));

    // maybe today: what you haven't met yet near you, a bird reported this week counting double (it's about now, not
    // just the season); topped up with ones you have met so a well-travelled user still sees four
    // (the 8 regulars are already on the month page, so maybe-today looks past them)
    const regulars = near.slice(0, 8), onPage = new Set(regulars.map(b => b.id));
    const rest = near.filter(b => !onPage.has(b.id));
    const fresher = (a: AroundBird, b: AroundBird) => b.score * (b.fresh ? 2 : 1) - a.score * (a.fresh ? 2 : 1);
    const maybe = [...rest.filter(b => !b.seen).sort(fresher), ...rest.filter(b => b.seen).sort(fresher)].slice(0, 4);
    const shift = seasonShift(months, weights[0].month);
    const pick = (ids: number[]) => ids.map(id => byId.get(id)).filter((b): b is AroundBird => !!b);
    const dayBird = pickDayBird(wide, new Set(shift.arriving), localDay(date));

    const stale = !row.recent_at || Date.now() - new Date(row.recent_at).getTime() > EBIRD_TTL_MS;
    return {
        result: {
            status: "ready", cell, month: weights[0].month, reportedRecently: recent.size,
            regulars, maybe, dayBird, arriving: pick(shift.arriving), leaving: pick(shift.leaving),
        },
        background: async () => {
            await touchCell(cell);
            if (!hasNear) await buildRank(cell);
            if (stale) await refreshRecent(cell);
        },
    };
}
