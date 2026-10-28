"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stop } from "@/components/device/cursor";
import { PixelBird, pixelBirdDesignFor } from "@/components/pixelBirds";
import type { DayBird } from "@/lib/around";
import { groupOf } from "@/lib/birdGroups";
import type { BirdFact } from "@/app/api/bird/facts/route";

// The bird of the day as a talking buddy (docs/mockup.html, "Today"): it stands on a small stage in full
// colour, idles and blinks, and talks in a Pokémon-style box. Press shows the next line (or finishes the
// one being typed); after the last line, press opens its card. Lines are its generated fun facts.

const EMOTES = ["!", "♪", "♥", "?"];
const TYPE_MS = 22;
const MAX_FACTS = 4;

const T = {
    en: {
        helloMet: (n: string) => `Hi again! It's me, ${n}. I'm around today.`,
        helloNew: (n: string) => `Psst! I'm ${n}, and I'm around here today. Can you find me?`,
        lately: "Someone saw one of us near here lately!",
        special: "I don't come around every day. Today's a rare chance!",
        bye: "Press again to see my card.",
        says: (n: string) => `${n} says`,
    },
    es: {
        helloMet: (n: string) => `¡Hola otra vez! Soy yo, ${n}. Hoy ando por aquí.`,
        helloNew: (n: string) => `¡Psst! Soy ${n} y hoy ando por aquí. ¿Me encuentras?`,
        lately: "¡Hace poco vieron a uno de los nuestros cerca!",
        special: "No me dejo ver todos los días. ¡Hoy es una ocasión rara!",
        bye: "Pulsa otra vez para ver mi ficha.",
        says: (n: string) => `${n} dice`,
    },
};
type Lang = keyof typeof T;

// one line per group (lib/birdGroups.ts), so every buddy has something of its own to say even before its
// fun facts exist (docs/mockup-v3.html: "one line per family, shared")
const GROUP_LINE: Record<string, { en: string; es: string }> = {
    "Waterfowl": { en: "Dabble, waddle, repeat.", es: "Chapotear, andar de lado, repetir." },
    "Gamebirds": { en: "I'd rather run than fly. Much less fuss.", es: "Prefiero correr que volar. Mucho menos lío." },
    "Grebes & divers": { en: "Now you see me... and now I'm underwater.", es: "Ahora me ves... y ahora estoy bajo el agua." },
    "Seabirds": { en: "Land is just where I park.", es: "La tierra es solo donde aparco." },
    "Herons & storks": { en: "Shh. Fishing in progress.", es: "Chsss. Pescando." },
    "Raptors": { en: "Patience. Then sky.", es: "Paciencia. Y después, cielo." },
    "Owls": { en: "Day shift? Not my thing.", es: "¿Turno de día? No es lo mío." },
    "Cranes & rails": { en: "Long legs, short temper. Mostly kidding.", es: "Patas largas, poca paciencia. Casi siempre es broma." },
    "Waders": { en: "Mud is my favourite restaurant.", es: "El barro es mi restaurante favorito." },
    "Gulls & terns": { en: "Is that a chip? That's my chip.", es: "¿Eso es una patata? Es mía." },
    "Pigeons & cuckoos": { en: "Coo. We were here before the benches.", es: "Cu-cu. Estábamos aquí antes que los bancos." },
    "Swifts & nightjars": { en: "Don't wait for me to land.", es: "No esperes a que me pose." },
    "Kingfishers & kin": { en: "Colour is not optional.", es: "El color no es opcional." },
    "Larks & swallows": { en: "I sing best with the sky as my stage.", es: "Canto mejor con el cielo de escenario." },
    "Thrushes & chats": { en: "We sing first at dawn and last at dusk.", es: "Somos los primeros en cantar al alba y los últimos al anochecer." },
    "Warblers": { en: "Small, quick, and always in the next bush.", es: "Pequeño, rápido y siempre en el siguiente arbusto." },
    "Tits & creepers": { en: "Upside down is a perfectly good way to eat.", es: "Bocabajo también se come muy bien." },
    "Shrikes & crows": { en: "Clever, noisy, and we remember faces.", es: "Listos, ruidosos y nos acordamos de las caras." },
    "Sparrows & finches": { en: "Wherever there are crumbs, there's one of us.", es: "Donde hay migas, hay uno de los nuestros." },
};

// funny and plain facts take turns, funny first
function pickFacts(facts: BirdFact[], lang: Lang): string[] {
    const text = (f: BirdFact) => (lang === "en" && f.en ? f.en : f.es);
    const funny = facts.filter(f => f.kind === "funny").map(text);
    const plain = facts.filter(f => f.kind === "fact").map(text);
    const out: string[] = [];
    for (let i = 0; out.length < MAX_FACTS && (i < funny.length || i < plain.length); i++) {
        if (funny[i]) out.push(funny[i]);
        if (plain[i] && out.length < MAX_FACTS) out.push(plain[i]);
    }
    return out;
}

export default function Buddy({ bird }: { bird: DayBird }) {
    const router = useRouter();
    const [lang, setLang] = useState<Lang>("en");
    const [facts, setFacts] = useState<BirdFact[]>([]);
    const [line, setLine] = useState(0);
    const [typed, setTyped] = useState(0);
    const [blink, setBlink] = useState(false);

    // the browser's language, read after mount so the server render and the first client render agree
    useEffect(() => { if (navigator.language?.toLowerCase().startsWith("es")) setLang("es"); }, []);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/bird/facts?id=${bird.id}`)
            .then(r => (r.ok ? r.json() : { facts: [] }))
            .then(d => { if (!cancelled) setFacts(d.facts ?? []); })
            .catch(() => { /* the buddy still says hello */ });
        return () => { cancelled = true; };
    }, [bird.id]);

    const t = T[lang];
    // Once you start reading, the lines are frozen: facts arriving later would otherwise shift the dialogue under
    // the line being typed and cut it. They still make it in if they arrive before the first press.
    const [started, setStarted] = useState(false);
    const [frozen, setFrozen] = useState<string[] | null>(null);
    const live = useMemo(() => {
        const groupLine = GROUP_LINE[groupOf(bird.family)]?.[lang];
        return [
            bird.seen ? t.helloMet(bird.name) : t.helloNew(bird.name),
            ...(bird.special ? [t.special] : []),
            ...(groupLine ? [groupLine] : []),
            ...(bird.fresh ? [t.lately] : []),
            ...pickFacts(facts, lang),
            t.bye,
        ];
    }, [bird, facts, lang, t]);
    const lines = frozen ?? live;

    const current = lines[Math.min(line, lines.length - 1)];
    const done = typed >= current.length;
    const last = line >= lines.length - 1;

    // typewriter; with reduced motion the whole line appears at once
    useEffect(() => {
        if (done) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setTyped(current.length); return; }
        const id = setTimeout(() => setTyped(n => n + 1), TYPE_MS);
        return () => clearTimeout(id);
    }, [typed, done, current]);

    // a blink every few seconds
    useEffect(() => {
        let off: ReturnType<typeof setTimeout>;
        const id = setInterval(() => { setBlink(true); off = setTimeout(() => setBlink(false), 140); }, 2600);
        return () => { clearInterval(id); clearTimeout(off); };
    }, []);

    const press = () => {
        if (!started) { setStarted(true); setFrozen(live); }
        if (!done) setTyped(current.length);
        else if (!last) { setLine(l => l + 1); setTyped(0); }
        else router.push(`/bird/${bird.id}`);
    };

    return (
        <Stop hint={done && last ? "Open" : "Talk"} onPress={press}>
            {/* the stage: sky, a dotted glow, stepped ground */}
            <div
                className="pixel-corners-4 relative flex h-[96px] items-end justify-center overflow-hidden"
                style={{ background: "linear-gradient(#1c2833, #2b3b2c 70%, #3a4a30)" }}
            >
                <div className="absolute inset-0" style={{ background: "radial-gradient(#ffffff14 1px, transparent 1.3px)", backgroundSize: "6px 6px" }} aria-hidden />
                <div className="absolute inset-x-0 bottom-0 h-[22px]" style={{ background: "repeating-linear-gradient(90deg, #3e5a2e 0 6px, #34502a 6px 12px)" }} aria-hidden />
                <div className="relative z-[1] mb-[2px] h-[84px] w-[84px] animate-[sprite-bob_1.2s_steps(1)_infinite]">
                    <PixelBird family={bird.family} design={pixelBirdDesignFor(bird.family, bird.scientificName)} blink={blink} title={bird.name} />
                    <span
                        key={line}
                        className="absolute -right-5 -top-2 flex h-[24px] w-[24px] items-center justify-center bg-white font-pokemon text-sm leading-none text-neutral-900 shadow-[0_0_0_2px_#171717] animate-[emote-pop_0.3s_steps(3)_both]"
                        aria-hidden
                    >
                        {EMOTES[line % EMOTES.length]}
                    </span>
                </div>
            </div>

            {/* the dialogue box, with a tail up to the stage */}
            <div className="pixel-classic relative mt-[10px] min-h-[68px] border-[3px] border-neutral-900 bg-[#f8f8f8] px-2.5 py-2 pr-6 text-neutral-900 shadow-[inset_0_0_0_2px_#fff,0_0_0_2px_#fff]">
                <span className="absolute -top-[11px] left-6 border-x-[6px] border-b-[8px] border-x-transparent border-b-neutral-900" aria-hidden />
                {line === 0 && <small className="mb-1 block font-pokemon text-xs uppercase leading-none text-neutral-500">{t.says(bird.name)}</small>}
                <p className="font-pokemon text-sm leading-snug" aria-live="polite">
                    {current.slice(0, typed)}
                    {/* the rest keeps the box at its final size while typing */}
                    <span className="invisible">{current.slice(typed)}</span>
                </p>
                <span className={`absolute bottom-1.5 right-2 font-pokemon text-xs ${done ? "animate-[more-bob_0.7s_steps(2)_infinite]" : "opacity-0"}`} aria-hidden>
                    {last ? "▶" : "▼"}
                </span>
            </div>
        </Stop>
    );
}
