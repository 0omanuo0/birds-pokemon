"use client";

import { useRouter } from "next/navigation";
import { Stop } from "@/components/device/cursor";
import type { AroundBird } from "@/lib/around";
import BirdPic from "./birdPic";
import { UI, type Lang } from "./lines";

// Who is arriving and who is leaving around you this month: the season, made local and a little urgent, with no timer.
function Row({ label, birds, tone }: { label: string; birds: AroundBird[]; tone: string }) {
    const router = useRouter();
    if (birds.length === 0) return null;
    return (
        <div className="flex items-start gap-2">
            <span className={`mt-[13px] w-[64px] shrink-0 font-pokemon text-xs uppercase ${tone}`}>{label}</span>
            <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {birds.map(b => (
                    <li key={b.id}>
                        <Stop hint="Open" onPress={() => router.push(`/bird/${b.id}`)}>
                            <div className="pixel-corners-1 flex items-center gap-1.5 bg-[#3a3a3e] py-1 pl-1 pr-2">
                                <BirdPic bird={b} className="h-[30px] w-[30px]" mark="text-sm" />
                                <span className="font-pokemon text-[13px] leading-tight text-neutral-100">{b.name}</span>
                            </div>
                        </Stop>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function SeasonShift({ arriving, leaving, lang }: { arriving: AroundBird[]; leaving: AroundBird[]; lang: Lang }) {
    const t = UI[lang];
    return (
        <div className="flex flex-col gap-2">
            <Row label={t.arriving} birds={arriving} tone="text-green-300" />
            <Row label={t.leaving} birds={leaving} tone="text-orange-300" />
        </div>
    );
}
