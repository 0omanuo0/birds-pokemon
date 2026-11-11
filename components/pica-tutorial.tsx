"use client"
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Animator, Curve, Moment, Step } from "@/lib/animator";
import { useScreenReady } from "@/components/device/deviceContext";

// Pica the magpie shows you around the Home screen: she flies in from outside the screen, says hello, then
// perches next to each control (side tabs, pokeball) and explains it while a "ghost finger" demonstrates it.
//
// Two Animators run in parallel from the same timeline: the bird (plus her speech bubbles) and the demo layer
// (finger, tap ripple, hold ring). Every scene gives both the same total duration so they stay in sync.
// There's no bird art yet: .pica-body is a placeholder box, and everything about the flight is on it
// (flapping bob, banking, turning around), so swapping in a sprite later doesn't touch the choreography.
//
// Nothing fades: opacity is only ever 0 or 1 and switches with SNAP. Turning around is an instant flip too.

const BIRD = 80;       // px, the bird's box (size-20)
const BODY = ".pica-body";
const TOUCH = ".pica-touch";

// On a moment: hold the previous value for the whole segment, then jump to this one (no tween)
const SNAP = "steps(1, end)";

const BUBBLE_IDS = ["hello", "cam", "user", "pokedex", "spin", "press", "hold", "bye"] as const;
type BubbleId = (typeof BUBBLE_IDS)[number];

type Lang = "es" | "ca" | "pt" | "eu" | "en";
type Texts = Record<BubbleId | "skip" | "peek", string>;

// Pica is a magpie, so the running joke is that she loves shiny things. Written per language, not translated
// word for word, so each one keeps its own tone. The browser's language picks (see useLang).
const TEXTS: Record<Lang, Texts> = {
    en: {
        hello: "Hi there! I'm Pica the magpie. Hide your shiny things, I'll show you around!",
        cam: "Pull the side tabs to travel. This one is the Camera: say cheese, birds!",
        user: "This one is you! Relax, I won't judge your life list.",
        pokedex: "The Pokédex! Every screen has its own tabs, I checked. Twice.",
        spin: "Spin the ball to scroll. Wheee!",
        press: "Press the middle to pick. Just a poke, it's not a doorbell.",
        hold: "Hold it to throw a ball and catch a bird. Not me, I'm too fast!",
        bye: "That's all! Happy birding. I'm off to steal something shiny.",
        skip: "Skip",
        peek: "Whoa, easy, button masher! Need a hand? Tap me and I'll show you around again.",
    },
    es: {
        hello: "¡Ey, hola! Soy Pica, la urraca. Esconde lo brillante y te enseño todo.",
        cam: "Tira de las pestañas laterales para moverte. Esta es la Cámara: ¡patata, pajarillos!",
        user: "¡Este eres tú! Tranqui, no juzgo tu lista de aves.",
        pokedex: "¡La Pokédex! Cada pantalla tiene sus pestañas, lo he comprobado. Dos veces.",
        spin: "Gira la bola para desplazarte. ¡Wiii!",
        press: "Pulsa el centro para elegir. Un toquecito, que no es un timbre.",
        hold: "Mantén para lanzar una bola y cazar un pájaro. ¡A mí no, que soy muy rápida!",
        bye: "¡Eso es todo! Feliz pajareo. Me voy a robar algo brillante.",
        skip: "Saltar",
        peek: "¡Eh, eh, tranqui, que lo rompes! ¿Te echo un ala? Tócame y te lo explico otra vez.",
    },
    ca: {
        hello: "Ei, hola! Sóc la Pica, la garsa. Amaga el que brilla i t'ho ensenyo tot!",
        cam: "Estira les pestanyes laterals per moure't. Aquesta és la Càmera: somriu, ocellets!",
        user: "Aquest ets tu! Tranqui, no jutjo la teva llista d'ocells.",
        pokedex: "La Pokédex! Cada pantalla té les seves pestanyes, ho he comprovat. Dues vegades.",
        spin: "Gira la bola per desplaçar-te. Iujuuu!",
        press: "Prem el centre per triar. Un toquet, que no és un timbre.",
        hold: "Mantén premut per llançar una bola i caçar un ocell. A mi no, que sóc molt ràpida!",
        bye: "Això és tot! Bon ocellament. Me'n vaig a robar alguna cosa brillant.",
        skip: "Omet",
        peek: "Ei, ei, tranqui, que ho trencaràs! Et dono un cop d'ala? Toca'm i t'ho torno a explicar.",
    },
    pt: {
        hello: "Olá! Sou a Pica, a pega. Guarda o que brilha que já te mostro tudo!",
        cam: "Puxa as abas laterais para navegar. Esta é a Câmara: sorriam, passarinhos!",
        user: "Este és tu! Calma, não julgo a tua lista de aves.",
        pokedex: "A Pokédex! Cada ecrã tem as suas abas, já verifiquei. Duas vezes.",
        spin: "Roda a bola para deslizar. Uiii!",
        press: "Carrega no centro para escolher. Um toquezinho, não é campainha.",
        hold: "Mantém para lançar uma bola e apanhar uma ave. A mim não, sou rápida!",
        bye: "É tudo! Boas observações. Vou roubar algo que brilhe.",
        skip: "Saltar",
        peek: "Calma, calma, que ainda partes isso! Precisas de uma asa? Toca-me e explico tudo outra vez.",
    },
    eu: {
        hello: "Kaixo! Pica naiz, mika. Gorde distiratsu guztia, dena erakutsiko dizut!",
        cam: "Tira egin alboko fitxei mugitzeko. Hau Kamera da: irribarre, txoriak!",
        user: "Hau zu zara! Lasai, ez dut zure txori-zerrenda epaitzen.",
        pokedex: "Pokedex-a! Pantaila bakoitzak bere fitxak ditu, begiratu dut. Birritan.",
        spin: "Biratu bola korritzeko. Iuju!",
        press: "Sakatu erdian aukeratzeko. Ukitu bat, ez da txirrina.",
        hold: "Mantendu bola bat jaurtitzeko eta txori bat harrapatzeko. Ni ez, azkarregia naiz!",
        bye: "Hori da dena! Txori-ikustaldi on. Distiratsuren bat lapurtzera noa.",
        skip: "Saltatu",
        peek: "Lasai, lasai, apurtuko duzu! Laguntzarik behar? Ukitu nazazu eta berriro erakutsiko dizut.",
    },
};

// The first of the browser's preferred languages that we have text for (English otherwise). Read after mount,
// like the other pages, so the server render and the first client render agree.
function useLang(): Lang {
    const [lang, setLang] = useState<Lang>("en");
    useEffect(() => {
        for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
            const base = tag?.toLowerCase().split("-")[0] as Lang;
            if (base in TEXTS) {
                setLang(base);
                return;
            }
        }
    }, []);
    return lang;
}

type Dir = 1 | -1; // 1 faces right, -1 faces left

const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// The body's transform always has the same three functions in the same order, so the browser can interpolate
// between any two poses. Positive rotation is always nose-down, whichever way she faces.
const tf = (dir: number, rot: number, y: number) => `scaleX(${dir}) rotate(${rot}deg) translateY(${y}px)`;

// ───────────── Layout measurements ─────────────

interface Metrics {
    W: number;
    H: number;
    camera: { x: number; y: number };
    user: { x: number; y: number };
    pokedex: { x: number; y: number };
    ball: { x: number; y: number };
    wheelTop: number;
}

// Where the real controls are, relative to the overlay (which covers the whole device). Measured instead of
// hard-coded because the tabs and the wheel are positioned with viewport units that differ on phone and desktop.
function measure(root: HTMLElement): Metrics {
    const box = root.getBoundingClientRect();
    const W = box.width;
    const H = box.height;

    const find = (sel: string) => document.querySelector<HTMLElement>(sel);
    // tabs sit mostly off-screen: aim at the visible handle, ~20px in from the screen edge
    const tab = (label: string, side: "left" | "right", fb: { x: number; y: number }) => {
        const el = find(`[role="button"][aria-label="${label}"]`);
        if (!el) return fb;
        const r = el.getBoundingClientRect();
        return { x: (side === "left" ? r.right - 20 : r.left + 20) - box.left, y: r.top + r.height / 2 - box.top };
    };

    const ballEl = find('[data-tutorial="ball"]');
    const wheelEl = find('[data-tutorial="wheel"]');
    const b = ballEl?.getBoundingClientRect();
    const ball = b
        ? { x: b.left + b.width / 2 - box.left, y: b.top + b.height / 2 - box.top }
        : { x: W / 2, y: H - 3 };
    // offsetWidth ignores the wheel's rotation, unlike getBoundingClientRect
    const radius = wheelEl ? wheelEl.offsetWidth / 2 : W / 2;

    return {
        W,
        H,
        camera: tab("Camera", "left", { x: 20, y: H * 0.5 }),
        user: tab("User", "left", { x: 20, y: H * 0.5 + 72 }),
        pokedex: tab("Pokedex", "right", { x: W - 20, y: H * 0.5 }),
        ball,
        wheelTop: ball.y - radius,
    };
}

// ───────────── Bird choreography ─────────────

// Flapping while the bird travels or hovers: a vertical bob (up on the upstroke, down on the downstroke) that
// lands back at 0, and a pitch that goes start -> mid -> end. She faces `dir` from the very first frame (an
// instant flip, no turning animation). Each moment is one half-beat; ends exactly at (dir, rots[2], 0) so the
// next step starts from where this one stops.
function flap(ms: number, dir: Dir, rots: [number, number, number], period: number, amp: number): Moment[] {
    const n = Math.max(2, Math.round(ms / period));
    return [
        { at: 0, style: { transform: tf(dir, rots[0], 0) } },
        ...Array.from({ length: n }, (_, i): Moment => {
            const t = (i + 1) / n;
            const rot = t < 0.5 ? lerp(rots[0], rots[1], t * 2) : lerp(rots[1], rots[2], (t - 0.5) * 2);
            const y = i === n - 1 ? 0 : i % 2 === 0 ? -amp : amp;
            return { at: t * 100, style: { transform: tf(dir, rot, y) }, easing: "ease-in-out" };
        }),
    ];
}

type Place = "above" | "right" | "left";

// Each bubble is said from one spot only, so its side (and the tail's) is fixed
const BUBBLE_PLACE: Record<BubbleId, Place> = {
    hello: "above", cam: "right", user: "right", pokedex: "left",
    spin: "above", press: "above", hold: "above", bye: "above",
};

// Where a bubble sits relative to the bird. translateY does the vertical anchoring, so bubbles can be any height.
const PLACES: Record<Place, { left: string; top: string; ty: string }> = {
    above: { left: "calc(40px - 6rem)", top: "-14px", ty: "translateY(-100%)" },
    right: { left: `${BIRD + 12}px`, top: "40px", ty: "translateY(-50%)" },
    left: { left: "calc(-12rem - 12px)", top: "40px", ty: "translateY(-50%)" },
};

// Shows up at once and pops to size with a little overshoot, stays, and disappears at the end of the scene
// (so flights always start clean). Opacity is in every moment so it can't tween in between.
const bubble = (place: Place): Moment[] => {
    const { left, top, ty } = PLACES[place];
    return [
        { at: 0, style: { left, top, opacity: "1", transform: `${ty} scale(0.7)` } },
        { at: 10, style: { opacity: "1", transform: `${ty} scale(1)` }, easing: "cubic-bezier(.3,1.6,.5,1)" },
        { at: 100, style: { opacity: "0" }, easing: SNAP },
    ];
};

// ───────────── Pixel sprites for the demo ─────────────

// Every sprite is drawn on the same 3px grid and never scaled: animation is swapping sprites on and off,
// like an old handheld, so the pixels stay the same size on every frame.
const CELL = 3;

type Cell = [number, number];
const cellsPath = (cells: Cell[]) => cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("");

// Cells of an n-cell circle, split in layers by distance from the edge: 0 is the outermost ring of cells
function circleCells(n: number) {
    const r = n / 2;
    const out: { cell: Cell; depth: number; dx: number; dy: number }[] = [];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const dx = x + 0.5 - r;
            const dy = y + 0.5 - r;
            const dist = Math.hypot(dx, dy);
            if (dist < r) out.push({ cell: [x, y], depth: Math.floor(r - dist), dx, dy });
        }
    }
    return out;
}

// Colours from the device itself: the pokeball's dark outline, the light grey of its lower half, the legend's
// amber and the real hold ring's yellow
const INK = "#2e2728";
const LIGHT = "#e5e5e5";
const SHADE = "#a3a3a3";
const AMBER = "#fbbf24";
const YELLOW = "#facc15";

// The finger: a dark-outlined light dot with a grey shade on its lower right
const TOUCH_N = 11;
const touchCells = circleCells(TOUCH_N);
const TOUCH_SPRITE = {
    outline: cellsPath(touchCells.filter(c => c.depth === 0).map(c => c.cell)),
    shade: cellsPath(touchCells.filter(c => c.depth > 0 && c.dx + c.dy > 2.2).map(c => c.cell)),
    fill: cellsPath(touchCells.filter(c => c.depth > 0 && c.dx + c.dy <= 2.2).map(c => c.cell)),
};

// Tap ripple: three rings of growing size, a dark outer line around an amber one so they read on any background
const RIPPLE_N = [15, 21, 27];
const ringSprite = (n: number) => {
    const cells = circleCells(n);
    return {
        dark: cellsPath(cells.filter(c => c.depth === 0).map(c => c.cell)),
        light: cellsPath(cells.filter(c => c.depth === 1).map(c => c.cell)),
    };
};
const RIPPLE_SPRITES = RIPPLE_N.map(ringSprite);

// Hold ring: the size of the real one (35 x 3 = 105px), a dark outer line around two yellow cells, cut in
// 8 segments clockwise from the top so it can fill up a segment at a time
const HOLD_N = 35;
const HOLD_SEGMENTS = 8;
const holdCells = circleCells(HOLD_N).filter(c => c.depth <= 2);
const segmentOf = (c: { dx: number; dy: number }) =>
    Math.floor(((Math.atan2(c.dx, -c.dy) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / HOLD_SEGMENTS));
const HOLD_SPRITES = Array.from({ length: HOLD_SEGMENTS }, (_, i) => {
    const cells = holdCells.filter(c => segmentOf(c) === i);
    return {
        dark: cellsPath(cells.filter(c => c.depth === 0).map(c => c.cell)),
        light: cellsPath(cells.filter(c => c.depth > 0).map(c => c.cell)),
    };
});

// An n-cell sprite centred on the demo layer's origin, on whole pixels
function Sprite({ n, className, children }: { n: number; className: string; children: React.ReactNode }) {
    const size = n * CELL;
    const offset = -Math.floor(size / 2);
    return (
        <svg
            viewBox={`0 0 ${n} ${n}`}
            shapeRendering="crispEdges"
            className={`absolute opacity-0 ${className}`}
            style={{ width: size, height: size, left: offset, top: offset }}
            aria-hidden
        >
            {children}
        </svg>
    );
}

// ───────────── Demo layer ─────────────

// The demo layer's own element is the finger's position; every sprite rides along as a child and is only ever
// switched on or off (SNAP), never scaled or faded. All steps run linear so a moment's `at` is real time.
const LINEAR = "linear";
const RIPPLES = RIPPLE_N.map((_, i) => `.pica-ripple-${i}`);
const SEGMENTS = HOLD_SPRITES.map((_, i) => `.pica-hold-${i}`);
const ALL_SPRITES = [TOUCH, ...RIPPLES, ...SEGMENTS];

const on = (at: number): Moment => ({ at, style: { opacity: "1" }, easing: SNAP });
const off = (at: number): Moment => ({ at, style: { opacity: "0" }, easing: SNAP });

// The three ripple rings one after another, each on for a third of the step (between `from` and `to` %)
const rippleFrames = (from = 0, to = 100): Record<string, Moment[]> => {
    const span = (to - from) / RIPPLES.length;
    return Object.fromEntries(RIPPLES.map((sel, i) => [sel, [on(from + span * i), off(from + span * (i + 1))]]));
};

// Jump to a spot with everything hidden
const place = (x: number, y: number): Step => ({
    duration: 1,
    style: { top: px(y), left: px(x) },
    easing: LINEAR,
    children: Object.fromEntries(ALL_SPRITES.map(sel => [sel, off(100)])),
});

// Finger appears, then sinks 1 pixel cell (pressed) while the ripple rings pop out
const down = (ms: number): Step => ({
    duration: ms,
    style: {},
    easing: LINEAR,
    children: {
        [TOUCH]: [
            { at: 0, style: { opacity: "1", transform: "translateY(0px)" } },
            { at: 30, style: { transform: `translateY(${CELL}px)` }, easing: SNAP },
        ],
        ...rippleFrames(),
    },
});

// Finger pops back up, then disappears (and so does the hold ring, if it was showing)
const up = (ms: number): Step => ({
    duration: ms,
    style: {},
    easing: LINEAR,
    children: {
        [TOUCH]: [
            { at: 30, style: { transform: "translateY(0px)" }, easing: SNAP },
            off(100),
        ],
        ...Object.fromEntries(SEGMENTS.map(sel => [sel, off(100)])),
    },
});

// Sliding: a smooth ease-in-out, so the swipe reads as one quick deliberate gesture
const drag = (ms: number, x: number, y: number, arc?: number): Step => ({
    duration: ms,
    style: { top: px(y), left: px(x) },
    easing: "ease-in-out",
    arc,
});

const idle = (ms: number): Step => ({ duration: ms, style: {}, easing: LINEAR });

// Held: the ring fills one segment at a time, clockwise from the top, like the real hold ring
const charge = (ms: number): Step => ({
    duration: ms,
    style: {},
    easing: LINEAR,
    children: Object.fromEntries(SEGMENTS.map((sel, i) => [sel, on((i / SEGMENTS.length) * 100)])),
});

// It fires: the full ring blinks twice and the ripple rings pop out
const burst = (ms: number): Step => ({
    duration: ms,
    style: {},
    easing: LINEAR,
    children: {
        ...Object.fromEntries(SEGMENTS.map(sel => [sel, [off(20), on(40), off(60), on(80)]])),
        ...rippleFrames(),
    },
});

const sum = (steps: Step[]) => steps.reduce((t, s) => t + s.duration, 0);

// ───────────── Timeline ─────────────

interface Timeline {
    bird: Step[];
    demo: Step[];
    start: { left: number; top: number };
    total: number;
}

function buildTimeline(m: Metrics): Timeline {
    const { W, H } = m;

    const start = { left: -BIRD - 30, top: H * 0.14 };
    let cur = { ...start };
    let pose: { dir: Dir; rot: number } = { dir: 1, rot: 0 };

    const bird: Step[] = [];
    const demo: Step[] = [];

    // Adds a scene: the bird steps and the demo steps must last the same, so the demo is padded with idle time
    const scene = (birdSteps: Step[], demoSteps: Step[]) => {
        const total = sum(birdSteps);
        const pad = total - sum(demoSteps);
        if (pad < 0) console.warn(`[PicaTutorial] demo steps (${sum(demoSteps)}ms) outlast the scene (${total}ms)`);
        bird.push(...birdSteps);
        demo.push(...demoSteps, ...(pad > 0 ? [idle(pad)] : []));
    };

    // Flight to a spot: a cubic swoop that rises, then drops onto the target with the nose up (landing flare).
    // The pitch follows the climb (nose up going up, nose down going down) and the wings beat the whole way.
    const fly = (to: { left: number; top: number }, ms: number, dir: Dir, opts: { lift?: number; easing?: string; curve?: Curve; flare?: number } = {}): Step => {
        const dx = to.left - cur.left;
        const dy = to.top - cur.top;
        const lift = opts.lift ?? Math.min(Math.abs(dx) * 0.2, 90);
        const curve: Curve | undefined = opts.curve ?? (Math.abs(dx) < 30
            ? undefined // a short vertical glide stays straight
            : {
                c1: { left: px(cur.left + dx * 0.3), top: px(cur.top + dy * 0.05 - lift) },
                c2: { left: px(to.left - dx * 0.2), top: px(to.top - lift * 0.5) },
            });
        const mid = dy < -30 ? -14 : dy > 30 ? 12 : 0;
        const flare = opts.flare ?? -10;
        const step: Step = {
            duration: ms,
            easing: opts.easing ?? "ease-in-out",
            curve,
            style: { top: px(to.top), left: px(to.left) },
            children: { [BODY]: flap(ms, dir, [pose.rot, mid, flare], 240, 6) },
        };
        cur = { ...to };
        pose = { dir, rot: flare };
        return step;
    };

    // Hovering in place while she talks: quick small wing beats, levels out of the landing flare
    const talk = (ms: number, id: BubbleId): Step => {
        const step: Step = {
            duration: ms,
            style: {},
            children: {
                [BODY]: flap(ms, pose.dir, [pose.rot, 0, 0], 320, 3),
                [`.pica-b-${id}`]: bubble(BUBBLE_PLACE[id]),
            },
        };
        pose = { ...pose, rot: 0 };
        return step;
    };

    // Demo helpers: a lead-in so the bubble gets read before the finger starts
    const swipe = (x: number, y: number, dx: number, arc?: number): Step[] => [
        idle(500), place(x, y), down(450), drag(800, x + dx, y, arc), up(400),
    ];
    const tap = (x: number, y: number): Step[] => [
        idle(400), place(x, y), down(300), up(300), down(300), up(300),
    ];
    const holdBall = (x: number, y: number): Step[] => [
        idle(400), place(x, y), down(300), charge(700), burst(350), up(400),
    ];

    // Positions next to the controls: beside a left tab, beside the right tab, above the ball
    const beside = (side: "left" | "right", y: number) => ({
        left: side === "left" ? 54 : W - 54 - BIRD,
        top: y - BIRD / 2,
    });
    const centre = { left: W / 2 - BIRD / 2, top: Math.max(H * 0.32, 170) };
    const aboveBall = { left: m.ball.x - BIRD / 2, top: m.wheelTop - BIRD - 28 };

    // 1. flies in from outside the screen, swooping down and rising to centre
    const enter = fly(centre, 2800, 1, {
        easing: "cubic-bezier(.2,.6,.3,1)",
        curve: {
            c1: { left: px(W * 0.18), top: px(start.top + 130) },
            c2: { left: px(W * 0.5), top: px(centre.top - 110) },
        },
        flare: -14,
    });
    scene([enter], [idle(sum([enter]))]);

    // 2. hello
    scene([talk(2800, "hello")], []);

    // 3. to the left tabs: Camera (upper), then User (lower)
    const toCamera = fly(beside("left", m.camera.y), 2000, -1);
    scene([toCamera], []);
    scene([talk(3400, "cam")], swipe(m.camera.x, m.camera.y, 70));

    const toUser = fly(beside("left", m.user.y), 900, -1, { flare: -4 });
    scene([toUser], []);
    scene([talk(3000, "user")], swipe(m.user.x, m.user.y, 70));

    // 4. across to the right tab (turning to face it on the way)
    const toPokedex = fly(beside("right", m.pokedex.y), 2400, 1);
    scene([toPokedex], []);
    scene([talk(3400, "pokedex")], swipe(m.pokedex.x, m.pokedex.y, -70));

    // 5. down to the pokeball: spin, press, hold
    const toBall = fly(aboveBall, 2200, -1);
    scene([toBall], []);
    const spinY = m.wheelTop + 30;
    scene([talk(3600, "spin")], swipe(m.ball.x - 90, spinY, 180, 14));
    scene([talk(3000, "press")], tap(m.ball.x, m.ball.y));
    scene([talk(3800, "hold")], holdBall(m.ball.x, m.ball.y));

    // 6. goodbye, then out of the screen again, accelerating away
    scene([talk(2400, "bye")], []);
    scene([fly({ left: -BIRD - 60, top: -BIRD - 20 }, 2200, -1, { easing: "ease-in", lift: 60, flare: -8 })], []);

    return { bird, demo, start, total: sum(bird) };
}

// ───────────── Component ─────────────

const BUBBLE_INITIAL = { left: "0px", top: "0px", opacity: "0", transform: "translateY(-100%) scale(0.85)" };

const BUBBLE_CLASS = "absolute w-48 opacity-0 border-2 border-black bg-white p-2 font-pokemon-ns text-lg leading-tight text-neutral-900 outline-2 outline-white";

// "1" once the tour has been watched or skipped, so it doesn't play again. Storage can be unavailable
// (private mode, blocked site data): then it simply plays once per page load.
const STORAGE_KEY = "pica-tutorial-done";
const REPLAY_EVENT = "pica:replay";

function readDone(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function writeDone(done: boolean) {
    try {
        if (done) localStorage.setItem(STORAGE_KEY, "1");
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        // nothing to remember it in
    }
}

// Plays the tour again from anywhere (e.g. the profile's "replay" button): forgets it was seen and goes Home
export function replayTutorial() {
    window.dispatchEvent(new Event(REPLAY_EVENT));
}

export default function PicaTutorial() {
    const pathname = usePathname();
    const router = useRouter();
    const ready = useScreenReady();
    const text = TEXTS[useLang()];
    // null until localStorage has been read (after mount, so server and client renders agree)
    const [done, setDone] = useState<boolean | null>(null);
    useEffect(() => setDone(readDone()), []);

    const pathRef = useRef(pathname);
    useEffect(() => {
        pathRef.current = pathname;
    }, [pathname]);

    const finish = useCallback(() => {
        writeDone(true);
        setDone(true);
    }, []);

    const replay = useCallback(() => {
        writeDone(false);
        setDone(false);
        if (pathRef.current !== "/") router.push("/"); // the tour points at Home's controls
    }, [router]);

    useEffect(() => {
        window.addEventListener(REPLAY_EVENT, replay);
        return () => window.removeEventListener(REPLAY_EVENT, replay);
    }, [replay]);

    const touring = pathname === "/" && done === false;

    if (done === null) return null;
    return touring
        ? <Tour text={text} ready={ready} onFinish={finish} />
        : <PicaPeek text={text} onHelp={replay} />;
}

// ───────────── The tour ─────────────

function Tour({ text, ready, onFinish }: { text: Texts; ready: boolean; onFinish: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const birdRef = useRef<HTMLDivElement>(null);
    const demoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        const birdEl = birdRef.current;
        const demoEl = demoRef.current;
        if (!ready || !root || !birdEl || !demoEl) return; // wait for the boot cover to finish
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            onFinish();
            return;
        }

        let birdAnim: Animator | null = null;
        let demoAnim: Animator | null = null;
        let end: ReturnType<typeof setTimeout> | undefined;

        // a beat before measuring: after a replay from another page, Home (and its tabs) may still be rendering
        const begin = setTimeout(() => {
            const timeline = buildTimeline(measure(root));

            birdAnim = new Animator(birdEl, timeline.bird, {
                initial: { left: px(timeline.start.left), top: px(timeline.start.top) },
                initialChildren: {
                    [BODY]: { transform: tf(1, 0, 0) },
                    ...Object.fromEntries(BUBBLE_IDS.map(id => [`.pica-b-${id}`, BUBBLE_INITIAL])),
                },
            });
            demoAnim = new Animator(demoEl, timeline.demo, {
                initial: { left: "0px", top: "0px" },
                initialChildren: {
                    ...Object.fromEntries(ALL_SPRITES.map(sel => [sel, { opacity: "0" }])),
                    [TOUCH]: { opacity: "0", transform: "translateY(0px)" },
                },
            });

            birdAnim.start();
            demoAnim.start();
            end = setTimeout(onFinish, timeline.total + 600);
        }, 400);

        return () => {
            clearTimeout(begin);
            clearTimeout(end);
            birdAnim?.destroy();
            demoAnim?.destroy();
        };
    }, [ready, onFinish]);

    return (
        <div ref={rootRef} className="absolute inset-0 z-[100] pointer-events-none">
            {/* the bird: this box flies (top/left); the body and the bubbles inside it are animated separately */}
            <div ref={birdRef} className="absolute -left-[200px] -top-[200px] size-20">
                <div className="pica-body absolute inset-0 bg-red-500/50" />
                {BUBBLE_IDS.map(id => (
                    <div key={id} className={`pica-b-${id} ${BUBBLE_CLASS}`}>
                        {text[id]}
                    </div>
                ))}
            </div>

            {/* the demo layer: its origin is the ghost finger's centre. Pixel sprites, all on the same 3px grid.
                The sprites only switch between 0 and 1; the layer's own 70% lets the page show through */}
            <div ref={demoRef} className="absolute -left-[200px] -top-[200px] size-0 opacity-70">
                {HOLD_SPRITES.map((s, i) => (
                    <Sprite key={i} n={HOLD_N} className={`pica-hold-${i}`}>
                        <path d={s.dark} fill={INK} />
                        <path d={s.light} fill={YELLOW} />
                    </Sprite>
                ))}
                {RIPPLE_SPRITES.map((s, i) => (
                    <Sprite key={i} n={RIPPLE_N[i]} className={`pica-ripple-${i}`}>
                        <path d={s.dark} fill={INK} />
                        <path d={s.light} fill={AMBER} />
                    </Sprite>
                ))}
                <Sprite n={TOUCH_N} className="pica-touch">
                    <path d={TOUCH_SPRITE.outline} fill={INK} />
                    <path d={TOUCH_SPRITE.fill} fill={LIGHT} />
                    <path d={TOUCH_SPRITE.shade} fill={SHADE} />
                </Sprite>
            </div>

            <button
                onClick={onFinish}
                className="pointer-events-auto absolute right-4 top-[calc(env(safe-area-inset-top)+3.25rem)] font-pokemon-ns text-sm uppercase text-neutral-300 hover:text-white"
            >
                {text.skip} ›
            </button>
        </div>
    );
}

// ───────────── Peek: "need a hand?" ─────────────

// Mashing: this many taps (or Enter/Space presses) inside the window. Arrow keys don't count, they're how
// the ball is spun from a keyboard. After she's shown up once she leaves you alone for a while.
const SPAM_HITS = 10;
const SPAM_WINDOW_MS = 3000;
const SPAM_COOLDOWN_MS = 60_000;

const PEEK_IN = 500;
const PEEK_TALK = 5500;
const PEEK_OUT = 400;

// When someone starts mashing, Pica slides in from the right edge, only half of her showing, and asks if they
// need help. Tapping her (or her bubble) replays the tour; otherwise she ducks back out after a few seconds.
function PicaPeek({ text, onHelp }: { text: Texts; onHelp: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const birdRef = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    const cooldownUntil = useRef(0);

    // count the mashing (capture phase, so pages that stop propagation still get counted)
    useEffect(() => {
        if (show) return;
        const hits: number[] = [];
        const hit = (e: Event) => {
            if (e instanceof KeyboardEvent && (e.repeat || (e.key !== "Enter" && e.key !== " "))) return;
            const now = performance.now();
            if (now < cooldownUntil.current) return;
            hits.push(now);
            while (hits.length && now - hits[0] > SPAM_WINDOW_MS) hits.shift();
            if (hits.length >= SPAM_HITS) {
                cooldownUntil.current = now + SPAM_COOLDOWN_MS;
                setShow(true);
            }
        };
        window.addEventListener("pointerdown", hit, true);
        window.addEventListener("keydown", hit, true);
        return () => {
            window.removeEventListener("pointerdown", hit, true);
            window.removeEventListener("keydown", hit, true);
        };
    }, [show]);

    useEffect(() => {
        const root = rootRef.current;
        const birdEl = birdRef.current;
        if (!show || !root || !birdEl) return;

        const { width: W, height: H } = root.getBoundingClientRect();
        const out = px(W + 10);
        // half her box past the right edge
        const peeking = px(W - BIRD / 2);

        const steps: Step[] = [
            {
                duration: PEEK_IN,
                easing: "ease-out",
                style: { left: peeking },
                children: { [BODY]: flap(PEEK_IN, -1, [-10, -6, 0], 240, 6) },
            },
            {
                duration: PEEK_TALK,
                style: {},
                children: {
                    [BODY]: flap(PEEK_TALK, -1, [0, 0, 0], 320, 3),
                    ".pica-b-peek": bubble("left"),
                },
            },
            {
                duration: PEEK_OUT,
                easing: "ease-in",
                style: { left: out },
                children: { [BODY]: flap(PEEK_OUT, 1, [0, -10, -14], 240, 6) },
            },
        ];

        const anim = new Animator(birdEl, steps, {
            initial: { left: out, top: px(H * 0.4) },
            initialChildren: {
                [BODY]: { transform: tf(-1, 0, 0) },
                ".pica-b-peek": BUBBLE_INITIAL,
            },
        });
        anim.start();
        const end = setTimeout(() => setShow(false), PEEK_IN + PEEK_TALK + PEEK_OUT + 100);

        return () => {
            clearTimeout(end);
            anim.destroy();
        };
    }, [show]);

    if (!show) return null;

    const help = () => {
        setShow(false);
        onHelp();
    };

    return (
        <div ref={rootRef} className="absolute inset-0 z-[100] pointer-events-none">
            <div ref={birdRef} className="absolute -left-[200px] -top-[200px] size-20">
                <button type="button" onClick={help} aria-label={text.peek} className="pica-body pointer-events-auto absolute inset-0 cursor-pointer bg-red-500/50" />
                <button type="button" onClick={help} className={`pica-b-peek pointer-events-auto cursor-pointer text-left ${BUBBLE_CLASS}`}>
                    {text.peek}
                </button>
            </div>
        </div>
    );
}
