"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { IdentifyCandidate } from "@/app/api/identify/route";
import type { BirdInfo } from "@/app/api/bird_info/route";
import { pushBird } from "@/lib/actions";
import { loadBirdDescription, peekBirdDescription } from "@/lib/birdDescription";
import { REGION_NAMES, regionAt, type RegionCode } from "@/lib/regions";
import { ClockSvg, PinSvg } from "@/components/imageSvg";
import { formatSeenDate } from "@/components/home/headCard";
import IucnScale from "@/components/bird/iucnScale";
import DexNotice from "@/components/ui/dexNotice";
import DateTimePicker from "./datetimePicker";

const MapWithNoSSR = dynamic(() => import("@/components/identify/map"), { ssr: false });

// Uncertainty rules for opening "Could it be…?" by default
const CONFIDENT = 0.7;
const CLOSE_SECOND = 0.25;
const MIN_ALTERNATIVE = 0.01;

const REGION_CHIPS: { key: RegionCode; label: string; on: string }[] = [
    { key: "pb", label: "PB", on: "bg-yellow-200 text-neutral-900" },
    { key: "na", label: "NA", on: "bg-blue-200 text-neutral-900" },
    { key: "ca", label: "CA", on: "bg-green-200 text-neutral-900" },
];

type RegionCheck = "ok" | "unlikely" | "outside" | "no_location" | "not_listed";

function regionCheck(candidate: IdentifyCandidate, location: [number, number] | null): RegionCheck {
    if (!candidate.bird) return "not_listed";
    if (!location) return "no_location";
    const region = regionAt(location[0], location[1]);
    if (!region) return "outside";
    return candidate.bird[region] ? "ok" : "unlikely";
}

function confidenceLevel(confidence: number) {
    if (confidence >= CONFIDENT) return { label: "High", cell: "bg-green-400", text: "text-green-400" };
    if (confidence >= 0.4) return { label: "Medium", cell: "bg-yellow-400", text: "text-yellow-400" };
    return { label: "Low", cell: "bg-red-400", text: "text-red-400" };
}

const displayName = (c: IdentifyCandidate) => c.bird?.name ?? c.scientificName;

// Wikipedia info (photo, IUCN status) per species, from the shared client cache
function useBirdInfo(scientificName: string, enabled = true): BirdInfo | null {
    const [info, setInfo] = useState<BirdInfo | null>(() => peekBirdDescription(scientificName) ?? null);
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const cached = peekBirdDescription(scientificName);
        if (cached) { setInfo(cached); return; }
        setInfo(null);
        loadBirdDescription(scientificName)
            .then(result => { if (!cancelled) setInfo(result); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [scientificName, enabled]);
    return info;
}

// Wikimedia thumbnails are ".../250px-File.jpg": ask for a wider rendition for the full-size viewer
// (the viewer falls back to the original thumbnail if that size can't be served).
function largerWikimediaUrl(src: string, width = 1280): string {
    return /\/\d+px-[^/]+$/.test(src) ? src.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`) : src;
}

type ViewerImage = { src: string; fallback?: string; alt: string };

// small corner hint that the photo opens full size
function ZoomHint() {
    return (
        <span className="pixel-corners-1 pointer-events-none absolute bottom-1 right-1 bg-neutral-900/70 px-1 font-pokemon text-[10px] leading-4 text-neutral-200" aria-hidden>
            ⤢
        </span>
    );
}

// Full-size photo over the result: fitted by default, tap the photo to toggle 2× (scroll to pan),
// tap the backdrop, the × or press Escape to close.
function PhotoViewer({ image, onClose }: { image: ViewerImage; onClose: () => void }) {
    const [zoomed, setZoomed] = useState(false);
    const [src, setSrc] = useState(image.src);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={image.alt}
            className="absolute inset-0 z-[60] flex flex-col bg-black/90 animate-[device-screen-in_150ms_ease-out]"
            onClick={onClose}
        >
            <div className="flex shrink-0 items-center justify-between px-3 py-2">
                <PixelLabel>{zoomed ? "Tap photo to fit" : "Tap photo to zoom"}</PixelLabel>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="pixel-corners-4 h-8 w-8 cursor-pointer bg-neutral-700 font-pokemon text-lg leading-none text-red-400 hover:bg-neutral-600"
                >
                    x
                </button>
            </div>
            <div className={`min-h-0 flex-1 ${zoomed ? "overflow-auto" : "flex items-center justify-center overflow-hidden p-2"}`}>
                <img
                    src={src}
                    alt={image.alt}
                    decoding="async"
                    onError={() => { if (image.fallback && src !== image.fallback) setSrc(image.fallback); }}
                    onClick={e => { e.stopPropagation(); setZoomed(z => !z); }}
                    className={zoomed ? "max-w-none w-[200%] cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}
                />
            </div>
        </div>
    );
}

function PixelLabel({ children }: { children: React.ReactNode }) {
    return <span className="font-pokemon text-[11px] uppercase tracking-wide text-neutral-400">{children}</span>;
}

function SeenBadge({ candidate }: { candidate: IdentifyCandidate }) {
    if (!candidate.bird) return <span className="pixel-corners-4 bg-neutral-600 px-2 py-0.5 font-pokemon text-xs uppercase text-neutral-300">Not listed</span>;
    const count = candidate.seen?.count ?? 0;
    return count > 0
        ? <span className="pixel-corners-4 bg-neutral-700 px-2 py-0.5 font-pokemon text-xs uppercase text-green-400">✓ Seen ×{count}</span>
        : <span className="pixel-corners-4 bg-yellow-400 px-2 py-0.5 font-pokemon text-xs uppercase text-neutral-900">New!</span>;
}

function AlternativeCard({ candidate, selected, isAiPick, onSelect }: {
    candidate: IdentifyCandidate; selected: boolean; isAiPick: boolean; onSelect: () => void;
}) {
    const info = useBirdInfo(candidate.scientificName);
    const seen = (candidate.seen?.count ?? 0) > 0;
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`pixel-corners-4 flex w-[104px] shrink-0 cursor-pointer touch-manipulation snap-start flex-col gap-1 p-1 text-left transition-colors ${selected ? "bg-yellow-400 text-neutral-900" : "bg-neutral-700 text-neutral-100 hover:bg-neutral-600"}`}
        >
            <div className="pixel-corners-4 relative aspect-square w-full overflow-hidden bg-neutral-800">
                {info?.photo ? (
                    <img src={info.photo.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                    <div className={`flex h-full w-full items-center justify-center font-pokemon text-xl text-neutral-500 ${info ? "" : "animate-pulse"}`}>?</div>
                )}
                {isAiPick && <span className="pixel-corners-4 absolute left-1 top-1 bg-neutral-900/80 px-1 font-pokemon text-[10px] text-yellow-400">AI</span>}
                {candidate.bird && (
                    <span
                        className={`absolute right-1 top-1 h-2 w-2 ${seen ? "bg-green-400" : "bg-yellow-400"}`}
                        title={seen ? "Already seen" : "New"}
                    />
                )}
            </div>
            <span className="truncate font-pokemon text-xs leading-tight">{displayName(candidate)}</span>
            <span className="flex items-center justify-between font-pokemon text-[11px] leading-none">
                <span className={selected ? "" : "text-neutral-400"}>{(candidate.confidence * 100).toFixed(0)}%</span>
                {!candidate.bird && <span className={selected ? "" : "text-neutral-500"}>not listed</span>}
            </span>
        </button>
    );
}

export default function IdentifyResult({ candidates, photoUrl, image, userId, onClose }: {
    candidates: IdentifyCandidate[];
    photoUrl: string;
    image: Blob;
    userId: number | undefined;
    onClose: () => void;
}) {
    const router = useRouter();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selected = candidates[selectedIndex];
    const aiPick = candidates[0];
    const info = useBirdInfo(selected.scientificName);

    // sighting details
    const [location, setLocation] = useState<[number, number] | null>(null);
    const [locating, setLocating] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [date, setDate] = useState(() => new Date());
    // photo opened full size (your photo or the Wikipedia reference)
    const [viewer, setViewer] = useState<ViewerImage | null>(null);

    function locate(openMapOnFail = false) {
        if (!navigator.geolocation) {
            if (openMapOnFail) setShowMap(true);
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            position => {
                setLocation([position.coords.latitude, position.coords.longitude]);
                setLocating(false);
            },
            () => {
                // always clear the spinner, the old dialog left it spinning on error
                setLocating(false);
                if (openMapOnFail) setShowMap(true);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    // the region check needs a location, so try GPS right away
    useEffect(() => { locate(); }, []);

    const uncertain = useMemo(() => {
        const second = candidates[1];
        return aiPick.confidence < CONFIDENT
            || (!!second && aiPick.confidence - second.confidence < CLOSE_SECOND)
            || !aiPick.bird
            || regionCheck(aiPick, location) === "unlikely";
    }, [candidates, aiPick, location]);

    const [alternativesOpen, setAlternativesOpen] = useState(uncertain);
    // location can arrive later and turn a confident pick into an unlikely one for this region
    useEffect(() => { if (uncertain) setAlternativesOpen(true); }, [uncertain]);

    const alternatives = candidates
        .map((candidate, index) => ({ candidate, index }))
        // .filter(({ candidate, index }) => index !== selectedIndex && (index === 0 || candidate.confidence >= MIN_ALTERNATIVE));

    const check = regionCheck(selected, location);
    const region = location ? regionAt(location[0], location[1]) : null;
    const level = confidenceLevel(selected.confidence);
    const filledCells = Math.round(selected.confidence * 10);

    // saving
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<null | { kind: "saved" } | { kind: "error"; message: string } | { kind: "signin" }>(null);

    // set once the sighting row exists, so "Retry" after a failed photo upload doesn't insert it twice
    const [savedSighting, setSavedSighting] = useState<{ birdId: number; imageId: string } | null>(null);

    async function save() {
        if (!selected.bird || saving) return;
        if (!userId) { setNotice({ kind: "signin" }); return; }
        setSaving(true);
        try {
            let imageId: string;
            if (savedSighting?.birdId === selected.bird.id) {
                imageId = savedSighting.imageId;
            } else {
                imageId = crypto.randomUUID();
                // the server takes the user from the session; userId here only decides whether to ask for sign-in
                const result = await pushBird(
                    selected.bird.id, imageId,
                    location ? `${location[0]},${location[1]}` : undefined,
                    date.toISOString(),
                );
                if (!result.success) throw new Error("The sighting couldn't be saved.");
                setSavedSighting({ birdId: selected.bird.id, imageId });
            }

            const formData = new FormData();
            formData.append("image", image);
            formData.append("birdId", selected.bird.id.toString());
            formData.append("imageId", imageId);
            const upload = await fetch("/api/saveImage", { method: "POST", body: formData });
            if (!upload.ok) throw new Error("The sighting was saved, but the photo couldn't be uploaded.");

            router.prefetch(`/bird/${selected.bird.id}`);
            setNotice({ kind: "saved" });
        } catch (error) {
            setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unknown error." });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-neutral-900 text-neutral-100 animate-[device-screen-in_200ms_ease-out]">
            {/* ── banner ───────────────────────────────────────── */}
            <div className="relative shrink-0 bg-white" style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                <h2
                    style={{ clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)" }}
                    className="relative flex items-center gap-2 bg-neutral-700 py-1 pl-2 pr-[28%] font-pokemon uppercase"
                >
                    <span className="mx-1 inline-block h-3 w-[2px] bg-yellow-400" aria-hidden />
                    <span className="shrink-0 text-yellow-400">
                        {selected.bird ? `Nº${selected.bird.id.toString().padStart(4, "0")}` : "Nº----"}
                    </span>
                    <span className="truncate">{displayName(selected)}</span>
                    <span className="absolute bottom-0 left-0 h-px w-[70%] bg-yellow-400" aria-hidden />
                </h2>
                {/* <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-0 top-0 h-[calc(50%+2px)] cursor-pointer bg-black px-3 font-pokemon text-2xl leading-none text-red-400"
                >
                    x
                </button> */}
                <div className="flex items-center justify-between gap-2 px-2 py-1 font-pokemon text-sm uppercase text-neutral-800">
                    <span className="truncate">
                        {selected.seen?.lastSeenAt
                            ? <><span className="text-neutral-500">Last </span>{formatSeenDate(selected.seen.lastSeenAt)}</>
                            : selected.bird ? <span className="text-neutral-500">First sighting</span> : <span className="text-neutral-500">Not in the SEO list</span>}
                    </span>
                    <SeenBadge candidate={selected} />
                </div>
            </div>

            {/* ── scrollable body ──────────────────────────────── */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 pt-3">
                {/* photos */}
                <div className="grid grid-cols-2 gap-2">
                    <figure className="pixel-corners-4 bg-neutral-700 p-1">
                        <button
                            type="button"
                            onClick={() => setViewer({ src: photoUrl, alt: "Your photo" })}
                            aria-label="View your photo full size"
                            className="pixel-corners-4 relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-neutral-800"
                        >
                            <img src={photoUrl} alt="Your photo" className="h-full w-full object-cover" />
                            <ZoomHint />
                        </button>
                        <figcaption className="px-0.5 pt-1"><PixelLabel>Your photo</PixelLabel></figcaption>
                    </figure>
                    <figure className="pixel-corners-4 bg-neutral-700 p-1">
                        {info?.photo ? (
                            <button
                                type="button"
                                onClick={() => setViewer({
                                    src: largerWikimediaUrl(info.photo!.src),
                                    fallback: info.photo!.src,
                                    alt: `Reference: ${displayName(selected)}`,
                                })}
                                aria-label="View the reference photo full size"
                                className="pixel-corners-4 relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-neutral-800"
                            >
                                <img src={info.photo.src} srcSet={info.photo.srcSet} alt={`Reference: ${displayName(selected)}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                <ZoomHint />
                            </button>
                        ) : (
                            <div className="pixel-corners-4 aspect-square overflow-hidden bg-neutral-800">
                                <div className={`flex h-full w-full items-center justify-center font-pokemon text-3xl text-neutral-600 ${info ? "" : "animate-pulse"}`}>?</div>
                            </div>
                        )}
                        <figcaption className="px-0.5 pt-1"><PixelLabel>Reference</PixelLabel></figcaption>
                    </figure>
                </div>

                {/* confidence */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                        <PixelLabel>Confidence {selectedIndex === 0 ? "· AI" : "· your pick"}</PixelLabel>
                        <span className={`font-pokemon text-sm uppercase ${level.text}`}>
                            {(selected.confidence * 100).toFixed(0)}% {level.label}
                        </span>
                    </div>
                    <div className="flex h-3 gap-[2px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(selected.confidence * 100)}>
                        {Array.from({ length: 10 }, (_, i) => (
                            <span key={i} className={`h-full flex-1 ${i < filledCells ? level.cell : "bg-neutral-700"}`} />
                        ))}
                    </div>
                </div>

                {/* data card */}
                <div className="pixel-corners-6 bg-white py-2 px-3 text-sm text-neutral-800">
                    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                        <dt className="font-pokemon text-xs uppercase text-neutral-500 -mb-1 ">Sci</dt>
                        <dd className="italic -mb-1">{selected.scientificName}</dd>
                        {selected.bird && (
                            <>
                                <dt className="font-pokemon text-xs uppercase text-neutral-500">Fam</dt>
                                <dd>{selected.bird.family}</dd>
                                <dt className="font-pokemon text-xs uppercase text-neutral-500">Reg</dt>
                                <dd className="flex flex-wrap items-center gap-1">
                                    {REGION_CHIPS.map(chip => (
                                        <span
                                            key={chip.key}
                                            title={REGION_NAMES[chip.key]}
                                            className={`pixel-corners-1 px-1.5 font-pokemon text-xs ${selected.bird![chip.key] ? chip.on : "bg-neutral-200 text-neutral-400 line-through"}`}
                                        >
                                            {chip.label}
                                        </span>
                                    ))}
                                    {selected.bird.rare && <span className="pixel-corners-1 bg-red-200 px-1.5 font-pokemon text-xs text-red-900">Rare</span>}
                                </dd>
                            </>
                        )}
                    </dl>

                    {/* where you are, right under the REG chips so it reads as the check against them; tap to set it on the map */}
                    {selected.bird && (
                        <button
                            type="button"
                            onClick={() => setShowMap(true)}
                            className={`mt-1 flex w-full cursor-pointer items-start gap-1.5 border-t border-neutral-200 pt-1.5 text-left text-xs ${check === "ok" ? "text-green-700" : check === "unlikely" ? "text-amber-700" : "text-neutral-500"}`}
                        >
                            <span className="h-4 w-4 shrink-0 overflow-hidden [&>svg]:h-full [&>svg]:w-full [&_*]:!drop-shadow-none">{PinSvg}</span>
                            <span className="min-w-0 flex-1">
                                <span className="font-pokemon">{check === "ok" ? "✓ " : check === "unlikely" ? "⚠ " : ""}</span>
                                {check === "ok" && region && <>{REGION_NAMES[region]}</>}
                                {check === "unlikely" && region && <>Not recorded in {REGION_NAMES[region]}: double-check the species</>}
                                {check === "outside" && <>Your location is outside the list's area</>}
                                {check === "no_location" && (locating ? <>Finding your location…</> : <>Add a location to check the region</>)}
                            </span>
                            <span className="shrink-0 font-pokemon uppercase text-white pixel-corners-1 px-3 py-[1px] bg-neutral-500">{location ? "Edit" : "Add"}</span>
                        </button>
                    )}



                    {info && (info.status.code || info.status.image) && (
                        <div className="mt-1 border-t border-neutral-200 pt-1">
                            <IucnScale status={info.status} showText={false}/>
                        </div>
                    )}
                </div>

                {/* alternatives alternatives.length > 0 && */}
                {( 
                    <section className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => setAlternativesOpen(open => !open)}
                            aria-expanded={alternativesOpen}
                            className="flex cursor-pointer items-center justify-between text-left"
                        >
                            <span className="flex flex-col">
                                <span className="font-pokemon text-sm uppercase text-neutral-100">
                                    <span className="mr-1 inline-block w-3 text-yellow-400">{alternativesOpen ? "▾" : "▸"}</span>
                                    Could it be…?
                                </span>
                                {uncertain && <span className="pl-4 text-xs text-neutral-400">The AI isn't sure, compare the options</span>}
                            </span>
                            <span className="font-pokemon text-xs text-neutral-500">{alternatives.length}</span>
                        </button>
                        {alternativesOpen && (
                            <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1">
                                {alternatives.map(({ candidate, index }) => (
                                    <AlternativeCard
                                        key={candidate.scientificName}
                                        candidate={candidate}
                                        selected={false}
                                        isAiPick={index === 0}
                                        onSelect={() => setSelectedIndex(index)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* sighting details */}
                {selected.bird && (
                    <div className="grid grid-cols-1 gap-2">
                        <div className="pixel-corners-4 relative flex h-11 items-center gap-2 bg-neutral-700 px-2 hover:bg-neutral-600">
                            <span className="h-5 w-5 shrink-0 overflow-hidden text-neutral-300 [&>svg]:h-full [&>svg]:w-full">{ClockSvg}</span>
                            <span className="flex min-w-0 flex-col leading-tight">
                                <PixelLabel>Date</PixelLabel>
                                <span className="truncate font-pokemon text-xs text-neutral-200">
                                    {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </span>
                            <DateTimePicker selectedDate={date} setSelectedDate={setDate} fill />
                        </div>
                    </div>
                )}
            </div>

            {/* ── actions ──────────────────────────────────────── */}
            <div className="flex shrink-0 items-end justify-between gap-3 border-t-2 border-neutral-800 bg-neutral-900 px-3 pb-3 pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="pixel-corners-4 h-8 cursor-pointer bg-neutral-700 px-3 font-pokemon text-sm uppercase text-neutral-300 hover:bg-neutral-600"
                >
                    Discard
                </button>
                <div className="flex-1 flex justify-end">
                    {selected.bird ? (
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            style={{
                                background: "linear-gradient(130deg, #FCC800 15%,#FFE270 40%, #FCC800 82%)",
                            }}
                            className="pixel-corners-6-border relative h-8 w-32 cursor-pointer px-4 pt-1 font-pokemon text-base uppercase tracking-wider text-black shadow-md disabled:cursor-wait disabled:opacity-80"
                        >
                            {saving ? <span className="animate-pulse">Saving…</span> : "Register!"}
                        </button>
                    ) : (
                        <span className="flex-1 text-right text-xs text-neutral-500">Pick a listed option to register it</span>
                    )}
                </div>
            </div>

            {/* ── map to set / adjust the location ─────────────── */}
            {showMap && (
                <div className="absolute inset-0 z-50 flex flex-col bg-neutral-900">
                    <div className="relative min-h-0 flex-1">
                        <MapWithNoSSR location={location} setLocation={setLocation} />
                    </div>
                    <div className="flex gap-2 p-3">
                        <button
                            type="button"
                            onClick={() => locate()}
                            className="pixel-corners-4 h-10 flex-1 cursor-pointer bg-neutral-700 font-pokemon text-sm uppercase text-neutral-200 hover:bg-neutral-600"
                        >
                            {locating ? "Locating…" : "My location"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowMap(false)}
                            className="pixel-corners-4 h-10 flex-1 cursor-pointer bg-yellow-400 font-pokemon text-sm uppercase text-neutral-900 hover:bg-yellow-300"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* ── full-size photo ──────────────────────────────── */}
            {viewer && <PhotoViewer image={viewer} onClose={() => setViewer(null)} />}

            {/* ── custom dialogs instead of alert() ────────────── */}
            <DexNotice
                open={notice?.kind === "saved"}
                tone="success"
                title="Registered!"
                onClose={onClose}
                actions={[
                    { label: "Continue", onClick: onClose },
                    { label: "View entry", primary: true, onClick: () => selected.bird && router.push(`/bird/${selected.bird.id}`) },
                ]}
            >
                <span className="font-pokemon text-yellow-400">{displayName(selected)}</span> has been added to your Pokédex
                {selected.bird && <> as <span className="font-pokemon">Nº{selected.bird.id.toString().padStart(4, "0")}</span></>}.
            </DexNotice>
            <DexNotice
                open={notice?.kind === "error"}
                tone="error"
                title="Save failed"
                onClose={() => setNotice(null)}
                actions={[
                    { label: "Close", onClick: () => setNotice(null) },
                    { label: "Retry", primary: true, onClick: () => { setNotice(null); save(); } },
                ]}
            >
                {notice?.kind === "error" ? notice.message : null}
            </DexNotice>
            <DexNotice
                open={notice?.kind === "signin"}
                tone="info"
                title="Sign in"
                onClose={() => setNotice(null)}
                actions={[{ label: "Got it", primary: true, onClick: () => setNotice(null) }]}
            >
                You need to sign in to register sightings.
            </DexNotice>
        </div>
    );
}
