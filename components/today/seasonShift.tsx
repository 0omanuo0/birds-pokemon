"use client";

import type { ShiftBird } from "@/lib/around";
import { Heading, Slot } from "./parts";
import { MONTHS, UI, type Lang } from "./lines";

// Who is arriving and who is leaving around you this month: the season, made local and a little urgent, with no timer.
// Two blocks in the same slot grid as the rest of Today, each with the size of the change on the slot ("x3").
function Block({ title, note, glyph, tone, birds, lang }: {
    title: string; note: string; glyph: string; tone: string; birds: ShiftBird[]; lang: Lang;
}) {
    const t = UI[lang];
    if (birds.length === 0) return null;
    return (
        <>
            <Heading note={note}><span className={tone}>{glyph}</span> {title}</Heading>
            <ul className="grid grid-cols-4 gap-2">
                {birds.map(b => (
                    <li key={b.id} className="min-w-0">
                        <Slot
                            bird={b}
                            sub={`${b.trend ? `×${b.trend >= 9.5 ? "9+" : Math.max(2, Math.round(b.trend))}` : ""}${b.seen ? " ✓" : ""}`.trim() || (b.seen ? t.met : t.notMet)}
                            subTone={tone}
                        />
                    </li>
                ))}
            </ul>
        </>
    );
}

export default function SeasonShift({ arriving, leaving, month, lang }: { arriving: ShiftBird[]; leaving: ShiftBird[]; month: number; lang: Lang }) {
    const t = UI[lang];
    const prev = MONTHS[lang][(month + 10) % 12], next = MONTHS[lang][month % 12];
    return (
        <>
            <Block title={t.arriving} note={t.moreThan(prev)} glyph="▲" tone="text-green-300" birds={arriving} lang={lang} />
            <Block title={t.leaving} note={t.fewerIn(next)} glyph="▼" tone="text-orange-300" birds={leaving} lang={lang} />
        </>
    );
}
