"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import LateralLeft from "@/components/nav/lateralLeft";
import LateralRight from "@/components/nav/lateralRight";
import PokeballRotation, { PokeballRotationHandle } from "@/components/pokeballRotation";
import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import DexNotice from "@/components/ui/dexNotice";
import { DeviceHintsSetter } from "@/components/device/deviceContext";
import { arrowBoxLeftSvg, homeSvg, logoutSvg, userSvg } from "@/components/imageSvg";
import { formatSeenDate } from "@/components/pokedex/headCard";
import type { PageProgress, RecentSighting } from "@/lib/profile";
import type { Stamp, StampId } from "@/lib/stamps";

const DEGREES_PER_ITEM = 18; // same detent as the dex wheel

// 8x8 pixel icons for the stamps, drawn as rects so they stay crisp at any size
const ICONS: Record<StampId, { rows: string[]; color: string }> = {
    first: { color: "text-amber-500", rows: ["...##...", "..####..", ".######.", ".######.", "########", "########", ".######.", "..####.."] },
    ten: { color: "text-pink-500", rows: [".##..##.", "########", "########", "########", ".######.", "..####..", "...##...", "........"] },
    fifty: { color: "text-yellow-500", rows: ["...##...", "...##...", "########", ".######.", "..####..", ".##..##.", ".#....#.", "........"] },
    early: { color: "text-orange-500", rows: ["...##...", "#.####.#", ".######.", "########", "########", ".######.", "#.####.#", "...##..."] },
    owl: { color: "text-amber-700", rows: ["#.####.#", "########", "##.##.##", "########", "###..###", "########", ".######.", "..#..#.."] },
    wader: { color: "text-sky-600", rows: ["....##..", "....###.", "....#...", "...##...", ".#####..", ".####...", "...#.#..", "...#.#.."] },
    shutter: { color: "text-neutral-700", rows: ["........", "..###...", "########", "##....##", "##.##.##", "##.##.##", "##....##", "########"] },
    old: { color: "text-emerald-600", rows: ["#.####.#", "########", "#......#", "#.#.#.##", "#......#", "#.#.#.##", "#......#", "########"] },
};

function StampIcon({ id }: { id: StampId }) {
    return (
        <svg viewBox="0 0 8 8" shapeRendering="crispEdges" fill="currentColor" className="h-8 w-8" aria-hidden>
            {ICONS[id].rows.flatMap((row, y) =>
                [...row].map((cell, x) => cell === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)
            )}
        </svg>
    );
}

// block bar, same idea as the pixel-art progress in the concept: slots filling up, never a score
function Blocks({ value, total, blocks, className = "" }: { value: number; total: number; blocks: number; className?: string }) {
    const filled = value <= 0 || total <= 0 ? 0 : Math.min(blocks, Math.max(1, Math.round((value / total) * blocks)));
    return (
        <div className={`flex gap-[2px] ${className}`} role="img" aria-label={`${value} of ${total}`}>
            {Array.from({ length: blocks }, (_, i) => (
                <span key={i} className={`h-full flex-1 ${i < filled ? "bg-yellow-400" : "bg-neutral-700"}`} />
            ))}
        </div>
    );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <h3 className="mb-2 mt-5 flex items-center gap-2 font-pokemon text-sm uppercase text-yellow-400">
            <span className="inline-block h-3 w-[2px] bg-yellow-400" aria-hidden />
            {children}
            <span className="h-px flex-1 bg-neutral-600" aria-hidden />
            {right && <span className="text-neutral-400">{right}</span>}
        </h3>
    );
}

type Stop = { kind: "recent"; item: RecentSighting } | { kind: "stamp"; item: Stamp };

export type ProfileProps = {
    name: string;
    email: string;
    image: string | null;
    userId: number;
    species: number;
    totalSpecies: number;
    sightings: number;
    photos: number;
    daysOut: number;
    firstSeenAt: number | null;
    recent: RecentSighting[];
    stamps: Stamp[];
    pages: PageProgress[];
    // false for the Android app's default account: signing out would just sign straight back in
    canLogout?: boolean;
};

export default function Profile(p: ProfileProps) {
    const router = useRouter();
    const stops: Stop[] = [
        ...p.recent.map(item => ({ kind: "recent", item }) as Stop),
        ...p.stamps.map(item => ({ kind: "stamp", item }) as Stop),
    ];
    const stampOffset = p.recent.length;

    // the ▶ cursor: spin moves it through the stops, press (or a tap) acts on it
    const [selected, setSelected] = useState(0);
    const selectedRef = useRef(0);
    const [openStamp, setOpenStamp] = useState<Stamp | null>(null);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const stopRefs = useRef<(HTMLElement | null)[]>([]);
    const pokeballRef = useRef<PokeballRotationHandle | null>(null);

    function reveal(index: number) {
        const box = scrollRef.current;
        const el = stopRefs.current[index];
        if (!box || !el) return;
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        // first stop: show the whole top of the card with it
        if (index === 0 && p.recent.length > 0) { box.scrollTo({ top: 0, behavior }); return; }
        const pad = 12;
        const b = box.getBoundingClientRect();
        const e = el.getBoundingClientRect();
        if (e.top < b.top + pad) box.scrollBy({ top: e.top - b.top - pad, behavior });
        else if (e.bottom > b.bottom - pad) box.scrollBy({ top: e.bottom - b.bottom + pad, behavior });
    }

    function select(index: number) {
        if (index === selectedRef.current) return;
        selectedRef.current = index;
        setSelected(index);
        reveal(index);
    }

    function activate(index: number) {
        const stop = stops[index];
        if (!stop) return;
        if (stop.kind === "recent") router.push(`/bird/${stop.item.birdId}`);
        else setOpenStamp(stop.item);
    }

    function tap(index: number) {
        pokeballRef.current?.rotateTo(index * DEGREES_PER_ITEM);
        select(index);
        activate(index);
    }

    const stampsEarned = p.stamps.filter(s => s.earned).length;
    const lastSeen = p.recent[0]?.seenAt;

    const frame = (index: number) => `pixel-corners-4 p-[2px] ${selected === index ? "bg-yellow-400" : "bg-transparent"}`;

    return (
        <>
            <DeviceScreen>
                {/* notched banner, same shape as the dex head card: trainer number + name, then the white strip */}
                <div className="shrink-0 select-none border-b-2 border-neutral-900 bg-white text-sm">
                    <div style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                        <h2
                            style={{ clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)" }}
                            className="flex items-center border-b border-yellow-400 bg-neutral-700 px-2 py-1 font-pokemon uppercase shadow-sm"
                        >
                            <span className="mx-1 mb-[1px] inline-block h-3 w-[2px] bg-yellow-400" />
                            <span className="mr-2 text-yellow-400">Nº{String(p.userId).padStart(4, "0")}</span>
                            <span className="min-w-0 truncate">{p.name}</span>
                        </h2>
                    </div>
                    <div className="mx-2 flex w-fit min-w-[40%] max-w-[calc(100%-1rem)] justify-between gap-x-3 pt-1 text-right font-pokemon text-base uppercase text-black">
                        <span className="shrink-0 whitespace-nowrap">
                            <span className="font-pokemon-ns text-gray-500">Since </span>
                            {p.firstSeenAt ? formatSeenDate(p.firstSeenAt) : "???"}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">
                            <span className="font-pokemon-ns text-gray-500">Days out </span>
                            {p.daysOut}
                        </span>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    style={{ maskImage: "linear-gradient(to bottom, #000 calc(100% - 28px), transparent)" }}
                    className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {/* identity: photo + the card's facts on graph paper */}
                    <div className="flex items-stretch gap-3">
                        <div className="pixel-corners-6-border--wrapper shrink-0" style={{ "--border-color": "#f90" } as React.CSSProperties}>
                            {p.image ? (
                                <img src={p.image} alt="" className="pixel-corners-6-border h-20 w-20 object-cover" />
                            ) : (
                                <div className="pixel-corners-6-border flex h-20 w-20 items-center justify-center bg-neutral-700 p-5 text-neutral-400">{userSvg}</div>
                            )}
                        </div>
                        <ul
                            style={{ lineHeight: 0.8 }}
                            className="details-bg pixel-corners-4 min-w-0 flex-1 space-y-1 bg-white px-2 py-1.5 font-pokemon-smaller text-base leading-tight text-black"
                        >
                            <li className="flex min-w-0 gap-1"><span className="shrink-0 text-gray-500">MAIL</span><span className="truncate font-mono text-xs leading-[1.1]">{p.email}</span></li>
                            <li><span className="mr-1 text-gray-500">SIGHTINGS</span>{p.sightings}</li>
                            <li><span className="mr-1 text-gray-500">PHOTOS</span>{p.photos}</li>
                            <li><span className="mr-1 text-gray-500">LAST</span>{lastSeen ? formatSeenDate(lastSeen) : "???"}</li>
                        </ul>
                    </div>

                    <SectionTitle right={`${p.species}/${p.totalSpecies}`}>Found</SectionTitle>
                    <Blocks value={p.species} total={p.totalSpecies} blocks={30} className="h-3" />

                    <SectionTitle>Recently met</SectionTitle>
                    {p.recent.length === 0 ? (
                        <div className="pixel-corners-4 border-2 border-dashed border-neutral-600 px-3 py-4 text-center font-pokemon text-sm uppercase text-neutral-400">
                            No birds yet.<br />
                            <span className="text-neutral-500">Take a photo and meet the first one.</span>
                        </div>
                    ) : (
                        <ul className="grid grid-cols-3 gap-2">
                            {p.recent.map((s, i) => (
                                <li key={s.sightingId} ref={el => { stopRefs.current[i] = el; }}>
                                    <button type="button" onClick={() => tap(i)} className="block w-full cursor-pointer touch-manipulation text-left">
                                        <div className={frame(i)}>
                                            <div className="pixel-corners-4 bg-white p-1 pb-1.5">
                                                <div className="aspect-square w-full overflow-hidden bg-neutral-700">
                                                    {s.photoUrl ? (
                                                        <img src={s.photoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center font-pokemon text-xs uppercase text-neutral-400">No photo</div>
                                                    )}
                                                </div>
                                                <p className="mt-1 truncate font-pokemon-smaller text-sm uppercase leading-none text-black">{s.name}</p>
                                                <p className="mt-0.5 truncate font-pokemon-ns text-xs uppercase leading-none text-gray-500">{formatSeenDate(s.seenAt)}</p>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <SectionTitle right={`${stampsEarned}/${p.stamps.length}`}>Stamps</SectionTitle>
                    <ul className="grid grid-cols-4 gap-2">
                        {p.stamps.map((stamp, i) => {
                            const index = stampOffset + i;
                            return (
                                <li key={stamp.id} ref={el => { stopRefs.current[index] = el; }}>
                                    <button
                                        type="button"
                                        onClick={() => tap(index)}
                                        aria-label={`${stamp.name}${stamp.earned ? "" : " (not yet)"}`}
                                        className="block w-full cursor-pointer touch-manipulation"
                                    >
                                        <div className={frame(index)}>
                                            <div
                                                style={stamp.earned ? { transform: `rotate(${i % 2 ? 2 : -2}deg)` } : undefined}
                                                className={`pixel-corners-4 flex h-[72px] flex-col items-center justify-between px-1 pb-1.5 pt-2 ${stamp.earned ? "bg-white" : "bg-neutral-900"}`}
                                            >
                                                <span className={stamp.earned ? ICONS[stamp.id].color : "text-neutral-600"}><StampIcon id={stamp.id} /></span>
                                                <span className={`text-center font-pokemon-smaller text-[11px] uppercase leading-[1.05] ${stamp.earned ? "text-neutral-800" : "text-neutral-400"}`}>{stamp.name}</span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {/* one page per bird group, like the sticker pages in the concept */}
                    <SectionTitle>Pages</SectionTitle>
                    <ul className="space-y-1.5">
                        {p.pages.map(page => (
                            <li key={page.name} className={`flex items-center gap-2 font-pokemon text-xs uppercase ${page.found > 0 ? "text-neutral-200" : "text-neutral-400"}`}>
                                <span className="w-[116px] shrink-0 truncate">{page.name}</span>
                                <Blocks value={page.found} total={page.total} blocks={12} className="h-2 flex-1" />
                                <span className="w-11 shrink-0 text-right">{page.found}/{page.total}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <DexNotice
                    open={!!openStamp}
                    tone={openStamp?.earned ? "success" : "info"}
                    title={openStamp?.name ?? ""}
                    onClose={() => setOpenStamp(null)}
                    actions={[{ label: "OK", primary: true, onClick: () => setOpenStamp(null) }]}
                >
                    {openStamp?.how}
                    {openStamp?.progress && !openStamp.earned && (
                        <span className="mt-2 block font-pokemon text-yellow-400">{openStamp.progress.have} / {openStamp.progress.need}</span>
                    )}
                </DexNotice>
                <DexNotice
                    open={confirmLogout}
                    title="Log out?"
                    onClose={() => setConfirmLogout(false)}
                    actions={[
                        { label: "Stay", onClick: () => setConfirmLogout(false) },
                        { label: "Log out", primary: true, onClick: () => signOut() },
                    ]}
                >
                    You can sign back in any time. Nothing is lost.
                </DexNotice>
            </DeviceScreen>
            <DeviceControls>
                <LateralLeft target="/" label="Home">{homeSvg}</LateralLeft>
                {p.canLogout !== false && (
                    <LateralRight label="Logout" onAction={() => setConfirmLogout(true)}><div className="rotate-180">{arrowBoxLeftSvg}</div></LateralRight>
                )}
                <DeviceHintsSetter press="OPEN" />
                <PokeballRotation
                    ref={pokeballRef}
                    snapStep={DEGREES_PER_ITEM}
                    startScroll={0}
                    endScroll={Math.max(0, stops.length - 1) * DEGREES_PER_ITEM}
                    onWheel={rotation => {
                        const index = Math.round(rotation / DEGREES_PER_ITEM);
                        if (index >= 0 && index < stops.length) select(index);
                    }}
                    onPress={() => {
                        // a dialog is open: press closes it instead of acting underneath
                        if (openStamp || confirmLogout) { setOpenStamp(null); setConfirmLogout(false); return; }
                        activate(selectedRef.current);
                    }}
                    onLongPress={() => router.push("/identify")}
                />
            </DeviceControls>
        </>
    );
}
