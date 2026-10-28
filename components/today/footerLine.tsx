"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stop } from "@/components/device/cursor";
import type { TodayFacts } from "@/lib/today";
import BirdPic from "./birdPic";
import { Heading } from "./parts";
import { LOOK_FOR, UI, todayIndex, type Lang } from "./lines";

// The small lines at the end of Today: a memory (one year ago today, or your last catch) and the day's look-for mission.
// The mission is only for you: press ticks it, and the tick is remembered for the day on this device.

const MISSION_KEY = "birds.missionDone";

function Mission({ lang }: { lang: Lang }) {
    const day = todayIndex();
    const mission = LOOK_FOR[day % LOOK_FOR.length][lang];
    const [done, setDone] = useState(false);
    useEffect(() => { try { setDone(localStorage.getItem(MISSION_KEY) === String(day)); } catch { /* optional */ } }, [day]);
    const toggle = () => {
        const next = !done;
        setDone(next);
        try { if (next) localStorage.setItem(MISSION_KEY, String(day)); else localStorage.removeItem(MISSION_KEY); } catch { /* optional */ }
    };
    return (
        <Stop hint={done ? "Undo" : "Done"} onPress={toggle}>
            <div className="pixel-corners-4 flex items-center gap-2.5 bg-[#3a3a3e] px-2.5 py-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center font-pokemon text-sm ${done ? "bg-yellow-400 text-neutral-900" : "border-2 border-neutral-500 text-transparent"}`} aria-hidden>✓</span>
                <span className="min-w-0">
                    <span className="block font-pokemon text-xs uppercase text-neutral-400">{UI[lang].mission}</span>
                    <span className={`block font-pokemon text-[14px] leading-snug ${done ? "text-neutral-400 line-through" : "text-neutral-100"}`}>{mission}</span>
                </span>
            </div>
        </Stop>
    );
}

export default function FooterLine({ facts, lang }: { facts: TodayFacts | null; lang: Lang }) {
    const router = useRouter();
    const t = UI[lang];
    const memory = facts?.onThisDay
        ? { label: t.onThisDay(facts.onThisDay.yearsAgo), moment: facts.onThisDay }
        : facts?.lastCatch
            ? { label: `${t.lastCatch} · ${t.ago(Math.max(0, Math.floor((Date.now() / 1000 - facts.lastCatch.at) / 86400)))}`, moment: facts.lastCatch }
            : null;
    return (
        <>
            <Heading>{lang === "es" ? "Y además" : "Also"}</Heading>
            <div className="flex flex-col gap-2">
                {memory && (
                    <Stop hint="Open" onPress={() => router.push(`/bird/${memory.moment.bird.id}`)}>
                        <div className="pixel-corners-4 flex items-center gap-2.5 bg-[#3a3a3e] p-1.5 pr-2.5">
                            <BirdPic bird={{ ...memory.moment.bird, seen: true }} className="h-[40px] w-[40px]" />
                            <span className="min-w-0">
                                <span className="block font-pokemon text-xs uppercase text-neutral-400">{memory.label}</span>
                                <span className="block truncate font-pokemon text-[14px] text-neutral-100">{memory.moment.bird.name}</span>
                            </span>
                        </div>
                    </Stop>
                )}
                <Mission lang={lang} />
            </div>
        </>
    );
}
