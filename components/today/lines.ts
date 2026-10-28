"use client";

import { useEffect, useState } from "react";

// Text for Today in the two languages the buddy already speaks. The browser's language picks; read after mount
// so the server render and the first client render agree.
export type Lang = "en" | "es";

export function useLang(): Lang {
    const [lang, setLang] = useState<Lang>("en");
    useEffect(() => { if (navigator.language?.toLowerCase().startsWith("es")) setLang("es"); }, []);
    return lang;
}

// Where to look, one short tag per group (lib/birdGroups.ts names): what to do with a name you don't know yet.
export const GROUP_WHERE: Record<string, { en: string; es: string }> = {
    "Waterfowl": { en: "on the water", es: "en el agua" },
    "Gamebirds": { en: "in fields", es: "en el campo" },
    "Grebes & divers": { en: "out on the water", es: "agua adentro" },
    "Seabirds": { en: "at sea", es: "en el mar" },
    "Herons & storks": { en: "at the water's edge", es: "en la orilla" },
    "Raptors": { en: "look up", es: "mira arriba" },
    "Owls": { en: "at dusk", es: "al anochecer" },
    "Cranes & rails": { en: "in reeds and fields", es: "en carrizos y campos" },
    "Waders": { en: "on mud and shore", es: "en barro y orilla" },
    "Gulls & terns": { en: "by water", es: "junto al agua" },
    "Pigeons & cuckoos": { en: "parks and trees", es: "parques y árboles" },
    "Swifts & nightjars": { en: "in the sky", es: "en el cielo" },
    "Kingfishers & kin": { en: "rivers and trunks", es: "ríos y troncos" },
    "Larks & swallows": { en: "open ground, sky", es: "campo abierto, cielo" },
    "Thrushes & chats": { en: "lawns and bushes", es: "césped y arbustos" },
    "Warblers": { en: "in bushes", es: "en arbustos" },
    "Tits & creepers": { en: "in trees", es: "en los árboles" },
    "Shrikes & crows": { en: "on wires and tops", es: "en cables y copas" },
    "Sparrows & finches": { en: "near people", es: "cerca de la gente" },
};

// One small mission a day, picked by the date. No data needed, nothing to fail: it trains the eye.
export const LOOK_FOR: { en: string; es: string }[] = [
    { en: "Look for a bird with something red on it.", es: "Busca un pájaro con algo rojo." },
    { en: "Find a bird smaller than your hand.", es: "Encuentra un pájaro más pequeño que tu mano." },
    { en: "Spot a bird standing in water.", es: "Descubre un pájaro de pie en el agua." },
    { en: "Listen for a bird singing from a rooftop.", es: "Escucha un pájaro cantando desde un tejado." },
    { en: "Find a bird with a long tail.", es: "Encuentra un pájaro de cola larga." },
    { en: "Look for a bird walking, not hopping.", es: "Busca un pájaro que camine en vez de saltar." },
    { en: "Spot a bird in flight and follow it.", es: "Sigue con la vista un pájaro en vuelo." },
    { en: "Find two different birds on one tree.", es: "Encuentra dos pájaros distintos en un árbol." },
    { en: "Look for a bird with something yellow.", es: "Busca un pájaro con algo amarillo." },
    { en: "Find a bird that is all black.", es: "Encuentra un pájaro totalmente negro." },
    { en: "Count the birds on a wire.", es: "Cuenta los pájaros de un cable." },
    { en: "Look for a bird eating something.", es: "Busca un pájaro comiendo algo." },
    { en: "Find a bird bigger than a pigeon.", es: "Encuentra un pájaro más grande que una paloma." },
    { en: "Listen for the first bird you hear outside.", es: "Escucha el primer pájaro que oigas al salir." },
    { en: "Spot a bird with white on its wings.", es: "Descubre un pájaro con blanco en las alas." },
    { en: "Find a bird taking a bath.", es: "Encuentra un pájaro bañándose." },
    { en: "Look for a bird with a crest.", es: "Busca un pájaro con cresta." },
    { en: "Spot a bird circling high up.", es: "Descubre un pájaro dando vueltas muy alto." },
    { en: "Find a bird on the ground in a park.", es: "Encuentra un pájaro en el suelo de un parque." },
    { en: "Look for a bird with a curved beak.", es: "Busca un pájaro de pico curvo." },
    { en: "Find a bird with something blue.", es: "Encuentra un pájaro con algo azul." },
    { en: "Watch one bird for a whole minute.", es: "Observa un mismo pájaro durante un minuto." },
    { en: "Find a bird on a chimney or antenna.", es: "Encuentra un pájaro en una chimenea o antena." },
    { en: "Look for a bird with a striped head.", es: "Busca un pájaro con la cabeza a rayas." },
    { en: "Find a bird near water you haven't met.", es: "Encuentra junto al agua uno que aún no conozcas." },
    { en: "Spot a group of the same birds together.", es: "Descubre un grupo de pájaros iguales juntos." },
    { en: "Look for a bird with long legs.", es: "Busca un pájaro de patas largas." },
    { en: "Find a bird hiding in a bush.", es: "Encuentra un pájaro escondido en un arbusto." },
    { en: "Listen for a bird that repeats its song.", es: "Escucha un pájaro que repita su canto." },
    { en: "Find a bird you can name without the app.", es: "Encuentra uno que sepas nombrar sin la app." },
];

// a number for today, local time: the mission stays the same all day
export function todayIndex(): number {
    const d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export const MONTHS = {
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};

export const UI = {
    en: {
        dayBird: "Bird of the day", special: "rare chance",
        page: (m: string) => `Your ${m} page`, pageNote: "regulars near you",
        pageEmpty: "Empty for now. Your first catch goes here.",
        maybe: "Maybe today", maybeNote: "seen near you this week", maybeNoteSeason: "near you this season",
        met: "met", notMet: "not met",
        arriving: "Arriving", leaving: "Leaving",
        trip: "Last trip", tripNew: (n: number) => (n === 1 ? "1 new" : `${n} new`), tripBirds: (n: number) => (n === 1 ? "1 bird" : `${n} birds`),
        lastCatch: "Last catch", onThisDay: (y: number) => (y === 1 ? "One year ago today" : `${y} years ago today`),
        mission: "Today's mission",
        ago: (d: number) => (d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`),
        asking: "Looking around…",
        waiting: "Waiting for your OK to use your location. Choose Allow in the browser's question to see the birds around you.",
        filling: "Listening to your corner of the world. First time here, one moment…",
        stillFilling: "Still listening. Press to try again in a moment.",
        denied: "Allow your location to see the birds around you.",
        unsupported: "Around you only covers Europe and Africa for now.",
        error: "Couldn't reach the dex. Press to try again.",
        retry: "Retry",
    },
    es: {
        dayBird: "Ave del día", special: "ocasión rara",
        page: (m: string) => `Tu página de ${m}`, pageNote: "habituales cerca de ti",
        pageEmpty: "Vacía por ahora. Tu primera captura va aquí.",
        maybe: "Quizá hoy", maybeNote: "vistas cerca esta semana", maybeNoteSeason: "cerca de ti esta temporada",
        met: "visto", notMet: "por ver",
        arriving: "Llegan", leaving: "Se van",
        trip: "Última salida", tripNew: (n: number) => (n === 1 ? "1 nueva" : `${n} nuevas`), tripBirds: (n: number) => (n === 1 ? "1 ave" : `${n} aves`),
        lastCatch: "Última captura", onThisDay: (y: number) => (y === 1 ? "Hoy hace un año" : `Hoy hace ${y} años`),
        mission: "Misión de hoy",
        ago: (d: number) => (d === 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`),
        asking: "Mirando alrededor…",
        waiting: "Esperando tu permiso para usar la ubicación. Elige Permitir en la pregunta del navegador para ver las aves de tu zona.",
        filling: "Escuchando tu rincón del mundo. Primera vez aquí, un momento…",
        stillFilling: "Sigo escuchando. Pulsa para intentarlo de nuevo en un momento.",
        denied: "Permite la ubicación para ver las aves de tu zona.",
        unsupported: "Por ahora solo cubrimos Europa y África.",
        error: "No se pudo conectar con la dex. Pulsa para reintentar.",
        retry: "Reintentar",
    },
};
