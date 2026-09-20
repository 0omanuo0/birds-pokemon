import { unstable_cache } from "next/cache";
import { HTMLElement, Node, NodeType, parse } from "node-html-parser";

export type DescriptionSection = { title: string; body: string };
export type IucnCode = "EX" | "EW" | "CR" | "EN" | "VU" | "NT" | "LC" | "DD" | "NE";
export type TabKey = "datos" | "area" | "vida" | "mas";

export type InfoImage = { src: string; srcSet?: string; width: number; height: number };

export type BirdInfo = {
    summary: string;
    taxonomy: { label: string; value: string }[];
    status: { code: IucnCode | null; label: string | null; image: string | null };
    rangeMap: InfoImage | null;
    photo: InfoImage | null; // the infobox's main species photo
    tabs: Record<TabKey, DescriptionSection[]>;
};

const WEEK = 60 * 60 * 24 * 7;

// Article sections per tab, matched on the heading's normalized id at any depth with startsWith
// (so "reproduccion_y_esperanza_de_vida" or "taxonomia_y_etimologia" match too).
const TAB_KEYS: Record<TabKey, string[]> = {
    datos: ["descripcion", "caracteristicas", "morfologia", "identificacion"],
    area: ["distribucion", "habitat", "migracion"],
    vida: ["alimentacion", "dieta", "reproduccion", "nidificacion", "comportamiento", "vocalizaciones", "canto", "voz", "comunicacion"],
    mas: ["taxonomia", "subespecies", "estado_de_conservacion", "conservacion", "importancia_cultural", "relacion_con_los_humanos"],
};
const TAB_ORDER: TabKey[] = ["datos", "area", "vida", "mas"];

// Kept short on purpose: this is a dex entry for a small screen, not an article.
const SUMMARY_PARAGRAPHS = 1;
const PARAGRAPHS_PER_SECTION = 2;
const SENTENCES = 3;
// soft cap of visible text per tab; checked between paragraphs so a paragraph is never cut in half
const MAX_CHARS_PER_TAB = 1000;

const TAXONOMY_LABELS = ["Orden", "Familia", "Género", "Especie"];
const IUCN_CODES: IucnCode[] = ["EX", "EW", "CR", "EN", "VU", "NT", "LC", "DD", "NE"];

function normalizeId(id: string): string {
    return id
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "_");
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SKIP_TAGS = new Set(["sup", "table", "style", "script", "figure", "link", "meta", "math"]);

// Rebuilds a paragraph keeping only <i>/<b> and wiki links (as brown italics, same look as before).
// Everything else is reduced to escaped text, so the output is safe for dangerouslySetInnerHTML.
function renderInline(node: Node): string {
    if (node.nodeType === NodeType.TEXT_NODE) return escapeHtml(node.text);
    if (!(node instanceof HTMLElement)) return "";

    const tag = node.rawTagName?.toLowerCase();
    if (!tag || SKIP_TAGS.has(tag)) return "";
    // e.g. "B. bernicla<br>(Linnaeus, 1758)" in the infobox: without this the two run together
    if (tag === "br") return " ";

    if (tag === "a" && node.getAttribute("rel") === "mw:WikiLink") {
        return `<i style="color:#830">${escapeHtml(node.text)}</i>`;
    }

    const inner = node.childNodes.map(renderInline).join("");
    if (tag === "i" || tag === "em") return `<i>${inner}</i>`;
    if (tag === "b" || tag === "strong") return `<b>${inner}</b>`;
    // e.g. several <p> inside one list item: keep a space between them
    if (tag === "p" || tag === "div") return `${inner} `;
    return inner;
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, "");
const plainLength = (html: string) => stripTags(html).length;

// Words that end in a period without ending the sentence (compared lowercase, without the period).
const ABBREVIATIONS = new Set([
    "p", "ej", "aprox", "sp", "ssp", "spp", "subsp", "var", "cf", "vs", "sr", "sra", "dr", "st", "sta",
    "fig", "pág", "págs", "núm", "no", "vol", "ed", "col", "lat", "long", "alt", "cap", "art", "prof",
]);

// Split points are "[.!?] + space + capital/opening mark/tag", skipping the ones that are really
// abbreviations or initials ("S. r. rubicola", "C. L. Brehm", "EE. UU.", "p. ej. En"), so a
// sentence is never cut in the middle.
function splitSentences(html: string): string[] {
    const sentences: string[] = [];
    let start = 0;
    for (const match of html.matchAll(/[.!?]\s+(?=[A-ZÁÉÍÓÚÑ¿¡«("<])/g)) {
        const end = match.index! + 1;
        if (html[match.index!] === ".") {
            const word = stripTags(html.slice(start, match.index!)).match(/(\S+)$/)?.[1] ?? "";
            const bare = word.replace(/^[(«"¿¡]+/, "");
            // a single letter ("S.", "r."), 1–2 capitals ("EE."), or a known abbreviation
            if (/^\p{L}$/u.test(bare) || /^\p{Lu}{1,2}$/u.test(bare) || ABBREVIATIONS.has(bare.toLowerCase())) continue;
        }
        sentences.push(html.slice(start, end).trim());
        start = match.index! + match[0].length;
    }
    const rest = html.slice(start).trim();
    if (rest) sentences.push(rest);
    return sentences;
}

// Whole sentences only; never adds or cuts punctuation (a paragraph ending in ":" keeps its ":").
function firstSentences(html: string, count: number): string {
    return splitSentences(html).slice(0, count).join(" ").trim();
}

function headingOf(section: HTMLElement): HTMLElement | null {
    return section.childNodes.find(
        (n): n is HTMLElement => n instanceof HTMLElement && /^h[2-6]$/i.test(n.rawTagName ?? "")
    ) ?? null;
}

function tabOf(section: HTMLElement): TabKey | null {
    const heading = headingOf(section);
    if (!heading) return null;
    const id = normalizeId(heading.id || heading.text);
    return TAB_ORDER.find(tab => TAB_KEYS[tab].some(key => id.startsWith(key))) ?? null;
}

// A paragraph, plus the list it introduces when it ends with ":" (e.g. "Se aceptan dos subespecies:" + <ul>).
type Block = { html: string; items?: string[] };

const LIST_TAGS = new Set(["ul", "ol", "dl"]);
// elements Parsoid may put between an intro paragraph and its list
const BETWEEN_TAGS = new Set(["style", "link", "meta", "figure"]);
const tagOf = (el: HTMLElement) => el.rawTagName?.toLowerCase() ?? "";

// Each list item clamped to its first whole sentence; nested sub-lists are dropped.
function listItems(list: HTMLElement): string[] {
    return list.childNodes
        .filter((n): n is HTMLElement => n instanceof HTMLElement && ["li", "dt", "dd"].includes(tagOf(n)))
        .map(item => item.childNodes
            .filter(n => !(n instanceof HTMLElement && LIST_TAGS.has(tagOf(n))))
            .map(renderInline).join("").replace(/\s+/g, " ").trim())
        .map(html => firstSentences(html, 1))
        .filter(html => plainLength(html) > 0);
}

// Paragraphs of a section and its nested subsections, in document order. Only direct <p> children
// (and lists introduced by one), so text inside tables, infoboxes and figures is ignored. Nested
// subsections that match a tab on their own are skipped: they become their own entry, so their
// text isn't repeated under the parent.
function collectBlocks(section: HTMLElement): Block[] {
    const out: Block[] = [];
    const children = section.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tag = tagOf(child);
        if (tag === "p") {
            const html = renderInline(child).replace(/\s+/g, " ").trim();
            if (plainLength(html) === 0) continue;
            const block: Block = { html };
            if (/:\s*$/.test(stripTags(html))) {
                let j = i + 1;
                while (j < children.length && BETWEEN_TAGS.has(tagOf(children[j]))) j++;
                if (j < children.length && LIST_TAGS.has(tagOf(children[j]))) {
                    const items = listItems(children[j]);
                    if (items.length) {
                        block.items = items;
                        i = j;
                    }
                }
            }
            out.push(block);
        } else if (tag === "section" && !tabOf(child)) {
            out.push(...collectBlocks(child));
        }
    }
    return out;
}

// A paragraph keeps its first SENTENCES sentences. A paragraph that introduces a list is kept whole
// with the entire list, even past the limits, so a "…subespecies:" is never left without its items.
function formatBlock(block: Block): string {
    if (!block.items) return firstSentences(block.html, SENTENCES);
    return `${block.html}<ul>${block.items.map(item => `<li>${item}</li>`).join("")}</ul>`;
}

// <br><br> between paragraphs; a list is already a block, so nothing extra after it.
function joinBlocks(parts: string[]): string {
    return parts.reduce((out, part, i) => (i === 0 ? part : out + (out.endsWith("</ul>") ? "" : "<br><br>") + part), "");
}

// Parsoid image URLs are protocol-relative ("//thumb.wikimedia.org/..."), srcset entries too.
const absoluteUrl = (url: string) => (url.startsWith("//") ? `https:${url}` : url);

function imageOf(img: HTMLElement, fallback: { width: number; height: number }): InfoImage {
    const srcSet = img.getAttribute("srcset");
    return {
        src: absoluteUrl(img.getAttribute("src")!),
        srcSet: srcSet ? srcSet.split(",").map(part => absoluteUrl(part.trim())).join(", ") : undefined,
        width: Number(img.getAttribute("width")) || fallback.width,
        height: Number(img.getAttribute("height")) || fallback.height,
    };
}

function readInfobox(root: HTMLElement): Pick<BirdInfo, "taxonomy" | "status" | "rangeMap" | "photo"> {
    const info: Pick<BirdInfo, "taxonomy" | "status" | "rangeMap" | "photo"> = {
        taxonomy: [],
        status: { code: null, label: null, image: null },
        rangeMap: null,
        photo: null,
    };
    const box = root.querySelector("table.infobox");
    if (!box) return info;

    const rows = box.querySelectorAll("tr");
    // A full-width header row (<th colspan>) names what the next row holds, e.g. "Estado de conservación" → status image.
    const rowAfterHeader = (header: string) => {
        const index = rows.findIndex(tr => {
            const th = tr.querySelector("th");
            return th && !tr.querySelector("td") && normalizeId(th.text.trim()) === normalizeId(header);
        });
        return index >= 0 ? rows[index + 1] : undefined;
    };

    const statusImg = rowAfterHeader("Estado de conservación")?.querySelector("img");
    if (statusImg) {
        const resource = decodeURIComponent(statusImg.getAttribute("resource") ?? "");
        const code = resource.match(/Status_iucn[\d.]*_([A-Z]{2})/i)?.[1]?.toUpperCase() as IucnCode | undefined;
        const title = statusImg.parentNode?.getAttribute("title") ?? "";
        info.status = {
            code: code && IUCN_CODES.includes(code) ? code : null,
            // "Preocupación menor (LC)" → "Preocupación menor"
            label: title.replace(/\s*\([^)]*\)\s*$/, "").trim() || null,
            image: statusImg.getAttribute("src") ? absoluteUrl(statusImg.getAttribute("src")!) : null,
        };
    }

    const mapImg = rowAfterHeader("Distribución")?.querySelector("img")
        ?? box.querySelectorAll("img").find(img => /map|mapa|distrib|range/i.test(img.getAttribute("resource") ?? ""));
    if (mapImg?.getAttribute("src")) {
        info.rangeMap = imageOf(mapImg, { width: 250, height: 125 });
    }

    // main photo: the first infobox image that isn't the status graphic or the range map
    const photoImg = box.querySelectorAll("img").find(img =>
        img !== statusImg && img !== mapImg && img.getAttribute("src")
        && !/Status_iucn|map|mapa|distrib|range/i.test(decodeURIComponent(img.getAttribute("resource") ?? ""))
    );
    if (photoImg) {
        info.photo = imageOf(photoImg, { width: 250, height: 250 });
    }

    for (const tr of rows) {
        const th = tr.querySelector("th[scope=row]");
        const td = tr.querySelector("td");
        if (!th || !td) continue;
        const label = th.text.replace(":", "").trim();
        if (!TAXONOMY_LABELS.includes(label)) continue;
        // keep <i>/<b> (species names) but no brown link styling in the compact grid
        const value = renderInline(td).replace(/<i style="color:#830">/g, "<i>").replace(/\s+/g, " ").trim();
        if (value) info.taxonomy.push({ label, value });
    }

    return info;
}

const EMPTY: BirdInfo = {
    summary: "",
    taxonomy: [],
    status: { code: null, label: null, image: null },
    rangeMap: null,
    photo: null,
    tabs: { datos: [], area: [], vida: [], mas: [] },
};

async function fetchBirdInfo(scientificName: string): Promise<BirdInfo> {
    const title = encodeURIComponent(scientificName.trim().replace(/\s+/g, "_"));
    const res = await fetch(`https://es.wikipedia.org/w/rest.php/v1/page/${title}/html`, {
        // Wikimedia asks API clients to identify themselves
        headers: { "User-Agent": "BirdsPokedex/1.0 (manu365manu@gmail.com)" },
    });
    if (!res.ok) return EMPTY;

    const root = parse(await res.text());
    const sections = root.querySelectorAll("section[data-mw-section-id]");

    const lead = sections.find(s => s.getAttribute("data-mw-section-id") === "0");
    const summary = lead
        ? joinBlocks(collectBlocks(lead).slice(0, SUMMARY_PARAGRAPHS).map(formatBlock).filter(Boolean))
        : "";

    // Candidates per tab in document order (e.g. Distribución before Migración, as in the article).
    // A paragraph that introduces a list is "required": it's kept even past PARAGRAPHS_PER_SECTION and the
    // tab's size cap, so every list in a shown section appears in full.
    type Candidate = { title: string; paragraphs: { html: string; required: boolean }[] };
    const candidates: Record<TabKey, Candidate[]> = { datos: [], area: [], vida: [], mas: [] };
    for (const section of sections) {
        const tab = tabOf(section);
        if (!tab) continue;
        const paragraphs = collectBlocks(section)
            .filter((block, i) => i < PARAGRAPHS_PER_SECTION || block.items)
            .map(block => ({ html: formatBlock(block), required: !!block.items }))
            .filter(p => p.html);
        if (paragraphs.length) candidates[tab].push({ title: headingOf(section)!.text.trim(), paragraphs });
    }

    // Breadth first: every section gets its first paragraph before any section gets a second one,
    // so a tab covers more topics (Alimentación, Reproducción…) instead of spending its budget on one long section.
    const tabs = {} as BirdInfo["tabs"];
    for (const tab of TAB_ORDER) {
        const picked = candidates[tab].map(c => ({ title: c.title, paragraphs: [] as string[] }));
        const rounds = Math.max(0, ...candidates[tab].map(c => c.paragraphs.length));
        let chars = 0;
        for (let round = 0; round < rounds; round++) {
            candidates[tab].forEach((c, i) => {
                const paragraph = c.paragraphs[round];
                if (!paragraph || (!paragraph.required && chars >= MAX_CHARS_PER_TAB)) return;
                picked[i].paragraphs.push(paragraph.html);
                chars += plainLength(paragraph.html);
            });
        }
        tabs[tab] = picked
            .filter(p => p.paragraphs.length)
            .map(p => ({ title: p.title, body: joinBlocks(p.paragraphs) }));
    }

    return { summary, ...readInfobox(root), tabs };
}

// Parsed result cached for a week per bird, shared by every visitor.
// Bump the version whenever the response shape, TAB_KEYS or the limits above change,
// or old cached results keep being served.
const getBirdInfo = unstable_cache(fetchBirdInfo, ["bird-info", "v8"], { revalidate: WEEK });

export async function GET(req: Request) {
    const name = new URL(req.url).searchParams.get("name");
    if (!name) {
        return Response.json({ ...EMPTY, error: "Missing name" }, { status: 400 });
    }

    try {
        const info = await getBirdInfo(name);
        return Response.json(info, {
            headers: { "Cache-Control": `public, s-maxage=${WEEK}, stale-while-revalidate=86400` },
        });
    } catch (error) {
        console.error("bird_info: failed to load description for", name, error);
        return Response.json(EMPTY, { status: 502 });
    }
}
