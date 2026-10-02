import { Bird } from "@/lib/types";
import { BIRD_GROUPS, OTHER_GROUP, groupOf } from "@/lib/birdGroups";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { searchSvg } from "../imageSvg";

type Region = "pb" | "na" | "ca";
type Status = "all" | "seen" | "unseen";
type Picker = null | "group" | "family";

const REGIONS: { key: Region; label: string; title: string; on: string }[] = [
    { key: "pb", label: "PB", title: "Península y Baleares", on: "bg-yellow-200 text-neutral-900" },
    { key: "na", label: "NA", title: "Norte de África", on: "bg-blue-200 text-neutral-900" },
    { key: "ca", label: "CA", title: "Canarias", on: "bg-green-200 text-neutral-900" },
];

const STATUSES: { key: Status; label: string }[] = [
    { key: "all", label: "All" },
    { key: "seen", label: "Seen" },
    { key: "unseen", label: "New" },
];

// results are capped in the DOM; the count in the banner is always the full number
const RESULT_LIMIT = 60;

const norm = (s: string | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Chip({ on, onClick, children, title, onClass = "bg-yellow-400 text-neutral-900" }: {
    on: boolean; onClick: () => void; children: ReactNode; title?: string; onClass?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            aria-pressed={on}
            onClick={onClick}
            className={`pixel-corners-4 h-[22px] shrink-0 px-2 font-pokemon text-xs uppercase leading-none transition-colors ${on ? onClass : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"}`}
        >
            {children}
        </button>
    );
}

export default function Dialog({
    birds_default, setBirdsFiltered, setKnownBird, birds_seen,
    showDialogSearch, setShowDialogSearch,
    onClose,
}: {
    birds_default: Bird[];
    setBirdsFiltered: (birds: Bird[]) => void;
    setKnownBird: (known: boolean[]) => void;
    showDialogSearch: boolean;
    setShowDialogSearch: (show: boolean) => void;
    birds_seen: any[];
    onClose?: () => void;
}) {
    const [query, setQuery] = useState("");
    const [regions, setRegions] = useState<Set<Region>>(new Set());
    const [status, setStatus] = useState<Status>("all");
    const [rareOnly, setRareOnly] = useState(false);
    const [groups, setGroups] = useState<Set<string>>(new Set());
    const [families, setFamilies] = useState<Set<string>>(new Set());
    const [picker, setPicker] = useState<Picker>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const close = () => (onClose ? onClose() : setShowDialogSearch(false));

    const seenIds = useMemo(() => new Set(birds_seen.map(s => s.bird_id)), [birds_seen]);

    // skip lets a picker count its own options against every *other* active filter
    function matches(b: Bird, skip?: "group" | "family") {
        const q = norm(query.trim());
        if (q && ![b.name, b.scientificName, b.nameEn, b.family].some(v => norm(v).includes(q))) return false;
        if (regions.size && ![...regions].some(r => b[r])) return false;
        if (status === "seen" && !seenIds.has(b.id)) return false;
        if (status === "unseen" && seenIds.has(b.id)) return false;
        if (rareOnly && !b.rare) return false;
        if (skip !== "group" && groups.size && !groups.has(groupOf(b.family))) return false;
        if (skip !== "family" && families.size && !families.has(b.family)) return false;
        return true;
    }

    const results = useMemo(
        () => birds_default.filter(b => matches(b)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [birds_default, query, regions, status, rareOnly, groups, families, seenIds]
    );

    const hasFilters = query.trim() !== "" || regions.size > 0 || status !== "all" || rareOnly || groups.size > 0 || families.size > 0;

    const groupOptions = useMemo(() => {
        if (picker !== "group") return [];
        const counts = new Map<string, number>();
        for (const b of birds_default) if (matches(b, "group")) counts.set(groupOf(b.family), (counts.get(groupOf(b.family)) ?? 0) + 1);
        const names = [...BIRD_GROUPS.map(g => g.name), ...(counts.has(OTHER_GROUP) ? [OTHER_GROUP] : [])];
        return names.map(name => ({ key: name, label: name, sub: undefined as string | undefined, count: counts.get(name) ?? 0 }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [picker, birds_default, query, regions, status, rareOnly, families, seenIds]);

    const familyOptions = useMemo(() => {
        if (picker !== "family") return [];
        const counts = new Map<string, number>();
        for (const b of birds_default) {
            if (groups.size && !groups.has(groupOf(b.family))) continue;
            if (!counts.has(b.family)) counts.set(b.family, 0);
            if (matches(b, "family")) counts.set(b.family, counts.get(b.family)! + 1);
        }
        return [...counts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([family, count]) => ({ key: family, label: family, sub: groupOf(family), count }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [picker, birds_default, query, regions, status, rareOnly, groups, seenIds]);

    function toggle<T>(set: Set<T>, value: T) {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        return next;
    }

    function toggleGroup(name: string) {
        const next = toggle(groups, name);
        setGroups(next);
        // drop picked families that no longer belong to any selected group
        if (next.size) setFamilies(prev => new Set([...prev].filter(f => next.has(groupOf(f)))));
    }

    function reset() {
        setQuery(""); setRegions(new Set()); setStatus("all"); setRareOnly(false);
        setGroups(new Set()); setFamilies(new Set()); setPicker(null);
    }

    function apply() {
        const list = hasFilters ? results : birds_default;
        if (list.length === 0) return;
        setBirdsFiltered(list);
        setKnownBird(list.map(b => seenIds.has(b.id)));
        close();
    }

    useEffect(() => {
        if (!showDialogSearch) { setPicker(null); return; }
        inputRef.current?.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            // Escape backs out of a picker first, then closes the dialog
            setPicker(p => { if (p === null) close(); return null; });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDialogSearch]);

    const options = picker === "group" ? groupOptions : familyOptions;
    const selected: Set<string> = picker === "group" ? groups : families;
    const shownCount = hasFilters ? results.length : birds_default.length;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter birds"
            inert={!showDialogSearch}
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
            style={{
                transition: "all 0.3s ease-in-out",
            }}
            className={"absolute left-0 w-full p-3 z-50 overflow-hidden pixel-corners-4" + (showDialogSearch ? " top-0 h-full opacity-100 backdrop-blur-xs bg-neutral-800/20 " : "  top-[50%] h-0 opacity-0")}
        >
            <div className="bg-gradient-to-br from-neutral-800 to-neutral-500 h-full w-full p-2 pixel-corners-12 shadow-lg">
                <div className="flex flex-col bg-gradient-to-bl from-neutral-800 to-neutral-900 pixel-corners-10 w-full h-full overflow-hidden">

                    {/* banner */}
                    <div className="shrink-0 bg-white border-b-2 border-neutral-900 after:border-b-1 after:border-neutral-400 after:content-[''] after:block after:w-full">
                        <div style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                            <h2
                                style={{
                                    clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                    WebkitMaskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                    maskImage: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)",
                                }}
                                className={`bg-neutral-700 uppercase font-pokemon relative py-1 px-2 border-b border-yellow-400 shadow-sm`}
                            >
                                <span style={{ content: "" }} className="bg-yellow-400 w-[2px] h-3 inline-block mx-1"></span>
                                {picker === "group" ? "Groups" : picker === "family" ? "Families" : "Filter birds"}
                                <span className="absolute bottom-0 left-0 w-[70%] h-[1px] bg-yellow-400 block" />
                            </h2>
                        </div>
                        <div className="text-black text-sm -mt-3 text-right uppercase font-pokemon">
                            <span className="mx-2">{shownCount} birds</span>
                        </div>
                    </div>

                    {/* filter chips */}
                    <div className="shrink-0 flex flex-col gap-1.5 px-2 pt-2">
                        <div className="flex flex-wrap items-center gap-1">
                            {REGIONS.map(r => (
                                <Chip key={r.key} title={r.title} on={regions.has(r.key)} onClass={r.on}
                                    onClick={() => setRegions(toggle(regions, r.key))}>{r.label}</Chip>
                            ))}
                            <span className="mx-0.5 h-3 w-[2px] bg-neutral-600" aria-hidden />
                            {STATUSES.map(s => (
                                <Chip key={s.key} on={status === s.key} onClick={() => setStatus(s.key)}>{s.label}</Chip>
                            ))}
                            <span className="mx-0.5 h-3 w-[2px] bg-neutral-600" aria-hidden />
                            <Chip title="SEO rarities (R1 / R2)" on={rareOnly} onClass="bg-red-300 text-neutral-900"
                                onClick={() => setRareOnly(!rareOnly)}>Rare</Chip>
                        </div>
                        <div className="flex items-center gap-1">
                            <Chip on={picker === "group" || groups.size > 0} onClick={() => setPicker(picker === "group" ? null : "group")}>
                                Group{groups.size > 0 && ` · ${groups.size}`} ▾
                            </Chip>
                            <Chip on={picker === "family" || families.size > 0} onClick={() => setPicker(picker === "family" ? null : "family")}>
                                Family{families.size > 0 && ` · ${families.size}`} ▾
                            </Chip>
                            {hasFilters && (
                                <button type="button" onClick={reset}
                                    className="ml-auto font-pokemon text-xs uppercase text-neutral-400 underline decoration-dotted underline-offset-2 hover:text-neutral-200">
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* body: picker or results */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                        {picker ? (
                            <ul className="flex flex-col gap-1">
                                {options.map(o => {
                                    const on = selected.has(o.key);
                                    const empty = o.count === 0 && !on;
                                    return (
                                        <li key={o.key}>
                                            <button type="button"
                                                onClick={() => picker === "group" ? toggleGroup(o.key) : setFamilies(toggle(families, o.key))}
                                                className={`pixel-corners-4 flex h-7 w-full items-center gap-2 px-2 text-left transition-colors ${on ? "bg-neutral-300 text-neutral-900" : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"} ${empty ? "opacity-40" : ""}`}
                                            >
                                                <span className={`h-3 w-3 shrink-0 border-2 ${on ? "border-neutral-900 bg-yellow-400" : "border-neutral-400"}`} aria-hidden />
                                                <span className="min-w-0 truncate font-pokemon text-sm uppercase leading-none">{o.label}</span>
                                                {o.sub && (
                                                    <span className={`min-w-0 truncate font-pokemon text-[10px] uppercase leading-none ${on ? "text-neutral-600" : "text-neutral-500"}`}>{o.sub}</span>
                                                )}
                                                <span className={`ml-auto shrink-0 font-pokemon text-xs leading-none ${on ? "text-neutral-700" : "text-neutral-400"}`}>{o.count}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : !hasFilters ? (
                            <div className="flex h-full items-center justify-center text-center font-pokemon text-sm uppercase text-neutral-500">
                                Type a name or pick filters
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-center font-pokemon text-sm uppercase text-neutral-400">
                                No birds match
                                <Chip on={false} onClick={reset}>Reset filters</Chip>
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-1">
                                {results.slice(0, RESULT_LIMIT).map(bird => {
                                    const seen = seenIds.has(bird.id);
                                    return (
                                        <li key={bird.id} className={`pixel-corners-4 flex h-7 w-full items-center gap-2 px-3 ${seen ? "bg-neutral-200" : "bg-neutral-400"}`}>
                                            {seen && <span className="h-1.5 w-1.5 shrink-0 bg-yellow-500" title="Seen" />}
                                            <span className="min-w-0 truncate font-pokemon text-sm leading-none text-black">{bird.scientificName}</span>
                                            <span className="ml-auto min-w-0 max-w-[45%] shrink-0 truncate font-pokemon text-xs uppercase leading-none text-neutral-700">{bird.name}</span>
                                        </li>
                                    );
                                })}
                                {results.length > RESULT_LIMIT && (
                                    <li className="py-1 text-center font-pokemon text-xs uppercase text-neutral-500">
                                        +{results.length - RESULT_LIMIT} more — narrow it down
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>

                    {/* input + apply */}
                    <div className="shrink-0 flex items-center gap-2 px-3 pb-3 pt-1">
                        <div className="min-w-0 flex-1" style={{ filter: "drop-shadow(2px 2px 0px #fff4)" }}>
                            <div className="pixel-corners-6-border--wrapper relative h-fit w-full">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    placeholder="Search birds..."
                                    onChange={(e) => { setQuery(e.target.value); setPicker(null); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
                                    className="pixel-corners-6-border w-full outline-0 text-black bg-neutral-200 focus:bg-neutral-100 text-lg pointer-events-auto h-9 pl-4 pr-8"
                                />
                                {query && (
                                    <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 font-pokemon text-lg leading-none text-neutral-500 hover:text-neutral-900">
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ filter: "drop-shadow(2px 2px 0px #fff4)" }}>
                            <button
                                type="button"
                                aria-label={hasFilters ? `Show ${results.length} birds` : "Show all birds"}
                                disabled={hasFilters && results.length === 0}
                                onClick={apply}
                                className="h-9 w-9 p-1 bg-neutral-200 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-300 pixel-corners-6-border text-black"
                            >
                                {searchSvg}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
