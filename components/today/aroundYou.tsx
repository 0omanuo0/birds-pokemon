"use client";

import { useEffect, useState } from "react";
import { Stop } from "@/components/device/cursor";
import type { Around } from "@/lib/around";
import type { TodayFacts } from "@/lib/today";
import { groupOf } from "@/lib/birdGroups";
import Buddy from "./buddy";
import MonthPage from "./monthPage";
import SeasonShift from "./seasonShift";
import LastTrip from "./lastTrip";
import FooterLine from "./footerLine";
import { Heading, Slot, SlotSkeleton } from "./parts";
import { GROUP_WHERE, UI, useLang } from "./lines";

// Today, top to bottom: the bird of the day (a talking buddy), your page of this month's regulars, who you may meet
// near you, who is arriving and leaving, your last trip, and a memory plus the day's mission.
// The area part asks for your location once and remembers the last place, so a refusal still shows something;
// the personal part (/api/today) needs no location and loads alongside.
type Ready = Extract<Around, { status: "ready" }>;
type State =
    | { kind: "asking" }
    | { kind: "waiting" }
    | { kind: "denied" }
    | { kind: "filling" }
    | { kind: "stillFilling" }
    | { kind: "unsupported" }
    | { kind: "error" }
    | { kind: "ready"; data: Ready };

const LAST_KEY = "birds.lastPosition";

const readLast = (): { lat: number; lng: number } | null => {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch { return null; }
};

// The last answer for the last place, shown at once while the fresh one is fetched. Only used for the same place,
// and only in the current shape (the key changed when the bird of the day moved to the server).
const CACHE_KEY = "birds.aroundCache.v2";
const readCache = (at: { lat: number; lng: number }): Ready | null => {
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        return c && c.lat === at.lat && c.lng === at.lng && c.data?.status === "ready" && "dayBird" in c.data ? c.data : null;
    } catch { return null; }
};

function useTodayFacts(nonce: number) {
    const [facts, setFacts] = useState<TodayFacts | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetch("/api/today")
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (!cancelled && d) setFacts(d); })
            .catch(() => { /* the area part still shows */ });
        return () => { cancelled = true; };
    }, [nonce]);
    return facts;
}

export default function AroundYou() {
    const lang = useLang();
    const t = UI[lang];
    const [state, setState] = useState<State>({ kind: "asking" });
    const [nonce, setNonce] = useState(0); // bumped by "retry"
    const facts = useTodayFacts(nonce);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        async function load(lat: number, lng: number, attempt = 0) {
            try {
                const res = await fetch(`/api/around?lat=${lat}&lng=${lng}`, { cache: "no-store" });
                if (!res.ok) throw new Error(String(res.status));
                const data: Around = await res.json();
                if (cancelled) return;
                if (data.status === "ready") {
                    setState({ kind: "ready", data });
                    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lng, data })); } catch { /* optional */ }
                } else if (data.status === "unsupported") setState({ kind: "unsupported" });
                else if (attempt < 30) {
                    // a new cell is being filled in the background: ask again shortly, for about a minute
                    setState(s => s.kind === "ready" ? s : { kind: "filling" });
                    timer = setTimeout(() => load(lat, lng, attempt + 1), 2000);
                } else setState(s => s.kind === "ready" ? s : { kind: "stillFilling" });
            } catch {
                // a failed refresh must not wipe what is already on screen; otherwise say what happened (not "allow your location")
                if (!cancelled) setState(s => s.kind === "ready" ? s : { kind: "error" });
            }
        }

        // Show something at once from the last known place. Firefox never calls either geolocation callback while its permission prompt
        // is ignored or dismissed ("Not now"), and its timeout option only starts counting after the user answers, so waiting for the
        // callback would leave the page on "Looking around…" forever.
        const last = readLast();
        if (last) {
            const cached = readCache(last);
            if (cached) setState({ kind: "ready", data: cached });
            void load(last.lat, last.lng);
        }
        let answered = false;
        const watchdog = setTimeout(() => { if (!answered && !last && !cancelled) setState({ kind: "waiting" }); }, 6000);
        const fallback = () => { answered = true; if (!last && !cancelled) setState({ kind: "denied" }); };
        if (!("geolocation" in navigator)) fallback();
        else navigator.geolocation.getCurrentPosition(
            pos => {
                answered = true;
                const here = { lat: Number(pos.coords.latitude.toFixed(3)), lng: Number(pos.coords.longitude.toFixed(3)) };
                try { localStorage.setItem(LAST_KEY, JSON.stringify(here)); } catch { /* optional */ }
                // the same place as the remembered one is already on screen
                if (!last || Math.abs(last.lat - here.lat) > 0.02 || Math.abs(last.lng - here.lng) > 0.02) void load(here.lat, here.lng);
            },
            fallback,
            { maximumAge: 10 * 60 * 1000, timeout: 8000 },
        );
        return () => { cancelled = true; clearTimeout(watchdog); if (timer) clearTimeout(timer); };
    }, [nonce]);

    const personal = (
        <>
            {facts?.trip && <LastTrip trip={facts.trip} lang={lang} />}
            <FooterLine facts={facts} lang={lang} />
        </>
    );

    if (state.kind === "ready") {
        const { dayBird, regulars, maybe, arriving, leaving, month } = state.data;
        const lately = maybe.some(b => b.fresh);
        return (
            <>
                {dayBird && (
                    <>
                        <Heading first note={dayBird.special ? <span className="text-yellow-400">★ {t.special}</span> : undefined}>{t.dayBird}</Heading>
                        <Buddy key={dayBird.id} bird={dayBird} />
                    </>
                )}
                {regulars.length > 0 && <MonthPage birds={regulars} month={month} lang={lang} />}
                {maybe.length > 0 && (
                    <>
                        <Heading note={lately ? t.maybeNote : t.maybeNoteSeason}>{t.maybe}</Heading>
                        <ul className="grid grid-cols-4 gap-2">
                            {maybe.map(b => (
                                <li key={b.id} className="min-w-0">
                                    <Slot
                                        bird={b}
                                        sub={`${b.seen ? "✓ " : ""}${GROUP_WHERE[groupOf(b.family)]?.[lang] ?? ""}`}
                                        subTone={b.fresh ? "text-green-300" : "text-neutral-400"}
                                        mystery
                                    />
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {(arriving.length > 0 || leaving.length > 0) && (
                    <>
                        <Heading>{lang === "es" ? "La temporada" : "The season"}</Heading>
                        <SeasonShift arriving={arriving} leaving={leaving} lang={lang} />
                    </>
                )}
                {personal}
            </>
        );
    }

    const loading = state.kind === "asking" || state.kind === "filling";
    const canRetry = state.kind === "error" || state.kind === "stillFilling";
    const message = (
        <p className="pixel-corners-4 bg-[#3e3e40] px-3 py-2 font-pokemon text-sm text-neutral-300">
            {t[state.kind]}
            {canRetry && <span className="ml-2 text-yellow-400">▶ {t.retry}</span>}
        </p>
    );
    return (
        <>
            <Heading first>{t.maybe}</Heading>
            {canRetry ? <Stop hint="Retry" onPress={() => setNonce(n => n + 1)}>{message}</Stop> : message}
            {loading && (
                <ul className="mt-2 grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }, (_, i) => <li key={i}><SlotSkeleton /></li>)}
                </ul>
            )}
            {personal}
        </>
    );
}
