"use client";

import type { AroundBird } from "@/lib/around";
import { Blocks, Heading, Slot } from "./parts";
import { MONTHS, UI, type Lang } from "./lines";

// "Your October page": this month's regulars near you, filling in as you meet them. The one block on Today that is
// yours, and it starts again every month, so there is always a reachable page to complete.
export default function MonthPage({ birds, month, lang }: { birds: AroundBird[]; month: number; lang: Lang }) {
    const t = UI[lang];
    const found = birds.filter(b => b.seen).length;
    return (
        <>
            <Heading note={<span><span className="text-yellow-400">{found}</span> / {birds.length}</span>}>{t.page(MONTHS[lang][month - 1])}</Heading>
            <div className="mb-2"><Blocks value={found} total={birds.length} /></div>
            {found === 0 && <p className="mb-2 font-pokemon text-xs text-neutral-400">{t.pageEmpty}</p>}
            <ul className="grid grid-cols-4 gap-2">
                {birds.map(b => (
                    <li key={b.id} className="min-w-0">
                        <Slot bird={b} sub={b.seen ? t.met : t.notMet} subTone={b.seen ? "text-green-300" : "text-neutral-400"} />
                    </li>
                ))}
            </ul>
        </>
    );
}
