// animator.ts

type Easing =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | (string & {}); // also accepts cubic-bezier(...) and steps(...)

type CSSValues = Partial<CSSStyleDeclaration>;
type Visual = Omit<CSSValues, "top" | "left">; // movement is controlled by style/arc/curve

export interface Point {
  top: string;
  left: string;
}

export interface Curve {
  c1: Point;  // control point 1
  c2?: Point; // with c2 the curve is cubic; without it, quadratic
}

/** A style change at a point within a step. */
export interface Moment<S = CSSValues> {
  at?: number;     // 0-100: % of the step's progress (default 100)
  style: S;        // values the target should have at that point
  easing?: Easing; // easing of the segment leading to this moment (default linear)
}

export interface Step {
  duration: number;  // step length in ms
  style: CSSValues;  // destination: top, left and any other CSS property
  easing?: Easing;   // easing of this step (falls back to the class default)
  arc?: number;      // shortcut for a simple arc in px (positive goes up, negative down)
  curve?: Curve;     // Bézier curve (takes priority over arc)

  moments?: Moment<Visual>[];                   // changes to the element itself mid-step
  children?: Record<string, Moment | Moment[]>; // CSS selector -> changes to children
}

export interface AnimatorOptions {
  loop?: boolean;                              // repeat when finished
  initial?: CSSValues;                         // starting styles for the element
  initialChildren?: Record<string, CSSValues>; // starting styles per child selector
  easing?: Easing;                             // default easing (defaults to "ease-in-out")
}

const SAMPLES = 32; // keyframes used to approximate curves

const toList = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

// Blends CSS values with weights: calc((a) * 0.25 + (b) * 0.5 + ...)
const mix = (terms: [string, number][]): string =>
  `calc(${terms.map(([v, k]) => `(${v}) * ${+k.toFixed(5)}`).join(" + ")})`;

// Current value of a property: inline if present, otherwise computed
function read(el: HTMLElement, cs: CSSStyleDeclaration, key: string): string {
  const v = (el.style as any)[key] || (cs as any)[key];
  return !v || v === "auto" ? "0px" : v;
}

interface Track {
  frames: Keyframe[];
  final: Record<string, string>; // state it ends in
}

/**
 * Turns a list of moments into WAAPI keyframes for one element.
 * - There is always an explicit keyframe at 0 (current value) and at 1 (last value),
 *   so the last value holds until the end of the step.
 * - A moment's easing is placed on the previous keyframe (the segment leading to it).
 */
function buildTrack(el: HTMLElement, moments: Moment[]): Track | null {
  if (!moments.length) return null;

  const list = moments
    .map((m) => ({
      at: Math.min(Math.max(m.at ?? 100, 0), 100) / 100,
      style: { ...m.style } as Record<string, string>,
      easing: m.easing,
    }))
    .sort((a, b) => a.at - b.at);

  // Last value of each property
  const final: Record<string, string> = {};
  list.forEach((m) => Object.assign(final, m.style));
  const keys = Object.keys(final);

  const cs = getComputedStyle(el);
  const frames: { at: number; style: Record<string, string>; easing?: Easing }[] = [
    { at: 0, style: Object.fromEntries(keys.map((k) => [k, read(el, cs, k)])) },
  ];

  for (const m of list) {
    const last = frames[frames.length - 1];
    if (m.at === last.at) {
      Object.assign(last.style, m.style); // same point: merge
      last.easing = m.easing ?? last.easing;
    } else {
      frames.push({ at: m.at, style: { ...m.style }, easing: m.easing });
    }
  }

  const end = frames[frames.length - 1];
  if (end.at < 1) frames.push({ at: 1, style: { ...final } });
  else Object.assign(end.style, final);

  const keyframes = frames.map((f, i) => ({
    offset: f.at,
    ...f.style,
    ...(frames[i + 1]?.easing ? { easing: frames[i + 1].easing } : {}),
  })) as Keyframe[];

  return { frames: keyframes, final };
}

interface Snapshot {
  original: Record<string, string>; // inline style before touching anything
  baseline: Record<string, string>; // starting state of each loop iteration
}

export class Animator {
  private el: HTMLElement;
  private steps: Step[];
  private loop: boolean;
  private easing: Easing;

  private snaps = new Map<HTMLElement, Snapshot>();  // element + children
  private groups = new Map<string, HTMLElement[]>(); // selector -> children
  private home: Point;                               // starting position
  private pos: Point;                                // current position

  private runId = 0;
  private anims: Animation[] = [];

  constructor(
    element: HTMLElement,
    steps: Step[],
    {
      loop = false,
      initial = {},
      initialChildren = {},
      easing = "ease-in-out",
    }: AnimatorOptions = {}
  ) {
    this.el = element;
    this.steps = steps;
    this.loop = loop;
    this.easing = easing;

    // 1) Properties that will be touched on each element, and their initial values
    const keysByEl = new Map<HTMLElement, Set<string>>();
    const initialByEl = new Map<HTMLElement, CSSValues>();
    const register = (el: HTMLElement, keys: string[], init: CSSValues) => {
      const set = keysByEl.get(el) ?? new Set<string>();
      keys.forEach((k) => set.add(k));
      keysByEl.set(el, set);
      initialByEl.set(el, { ...initialByEl.get(el), ...init });
    };

    // Main element
    register(
      element,
      [
        "top",
        "left",
        ...Object.keys(initial),
        ...steps.flatMap((s) => [
          ...Object.keys(s.style),
          ...(s.moments ?? []).flatMap((m) => Object.keys(m.style)),
        ]),
      ],
      initial
    );

    // Children: resolved once, at construction
    const wanted = new Map<string, Set<string>>();
    const want = (sel: string, keys: string[]) => {
      const set = wanted.get(sel) ?? new Set<string>();
      keys.forEach((k) => set.add(k));
      wanted.set(sel, set);
    };
    steps.forEach((s) =>
      Object.entries(s.children ?? {}).forEach(([sel, def]) =>
        want(sel, toList(def).flatMap((m) => Object.keys(m.style)))
      )
    );
    Object.entries(initialChildren).forEach(([sel, st]) => want(sel, Object.keys(st)));

    wanted.forEach((keys, sel) => {
      const els = Array.from(element.querySelectorAll<HTMLElement>(sel));
      if (!els.length) console.warn(`[Animator] "${sel}" did not match any child`);
      this.groups.set(sel, els);
      els.forEach((el) => register(el, [...keys], initialChildren[sel] ?? {}));
    });

    // 2) Per element: snapshot of original inline -> initial -> baseline
    //    (initial > inline style > CSS; "auto" is treated as 0px)
    keysByEl.forEach((keys, el) => {
      const original: Record<string, string> = {};
      keys.forEach((k) => (original[k] = (el.style as any)[k] ?? ""));

      Object.assign(el.style, initialByEl.get(el));

      const cs = getComputedStyle(el);
      const baseline: Record<string, string> = {};
      keys.forEach((k) => (baseline[k] = read(el, cs, k)));

      this.snaps.set(el, { original, baseline });
    });

    const self = this.snaps.get(element)!;
    this.home = { top: self.baseline.top, left: self.baseline.left };
    this.pos = { ...this.home };
  }

  // ───────────── Public API ─────────────

  /** Starts (or restarts) the sequence from the beginning. */
  start(): this {
    this.stop();
    const id = ++this.runId;
    void this.run(id);
    return this;
  }

  /** Stops the sequence. Everything stays in the last completed state. */
  stop(): this {
    this.runId++;
    this.anims.forEach((a) => a.cancel());
    this.anims = [];
    return this;
  }

  /** Stops everything and restores the element and children to their original inline style. */
  destroy(): void {
    this.stop();
    this.snaps.forEach(({ original }, el) => Object.assign(el.style, original));
  }

  // ───────────── Execution ─────────────

  private async run(id: number): Promise<void> {
    do {
      this.reset();
      for (const step of this.steps) {
        if (id !== this.runId) return;
        await this.play(step);
      }
    } while (this.loop && id === this.runId);
  }

  private reset(): void {
    this.snaps.forEach(({ baseline }, el) => Object.assign(el.style, baseline));
    this.pos = { ...this.home };
  }

  private async play(step: Step): Promise<void> {
    const { top, left, ...rest } = step.style;

    const from: Point = { ...this.pos };
    const to: Point = {
      top: (top as string | undefined) ?? from.top,
      left: (left as string | undefined) ?? from.left,
    };

    // All animations in a step share duration and easing,
    // so "at" means the same for the element, the children and the movement
    const options: KeyframeAnimationOptions = {
      duration: step.duration,
      easing: step.easing ?? this.easing,
      fill: "forwards",
    };

    // Movement: curve (Bézier/arc) or straight line
    const curve = this.resolveCurve(from, to, step);
    const moveFrames: Keyframe[] = curve
      ? this.curveFrames(from, to, curve)
      : [{ top: to.top, left: to.left }];

    const anims: Animation[] = [this.el.animate(moveFrames, options)];
    const finals: [HTMLElement, Record<string, string>][] = [];

    const track = (el: HTMLElement, moments: Moment[]) => {
      const t = buildTrack(el, moments);
      if (!t) return;
      anims.push(el.animate(t.frames, options));
      finals.push([el, t.final]);
    };

    // Main element: its moments + the rest of style as a moment at 100%
    track(this.el, [
      ...(step.moments ?? []),
      ...(Object.keys(rest).length ? [{ at: 100, style: rest } as Moment] : []),
    ]);

    // Children
    for (const [selector, def] of Object.entries(step.children ?? {})) {
      for (const child of this.groups.get(selector) ?? []) track(child, toList(def));
    }

    this.anims = anims;

    try {
      await Promise.all(anims.map((a) => a.finished));
    } catch {
      return; // cancelled by stop()
    }

    // Write the final state as-is (keeps calc and %) and release the animations
    finals.forEach(([el, final]) => Object.assign(el.style, final));
    Object.assign(this.el.style, to);
    this.pos = to;
    anims.forEach((a) => a.cancel());
  }

  // ───────────── Curves ─────────────

  // curve takes priority over arc. arc is a quadratic Bézier with its control point
  // at the midpoint, offset by 2*arc (so the real peak is arc px high)
  private resolveCurve(from: Point, to: Point, step: Step): Curve | null {
    if (step.curve) return step.curve;
    if (step.arc) {
      return {
        c1: {
          top: `calc((${from.top}) * 0.5 + (${to.top}) * 0.5 - ${step.arc * 2}px)`,
          left: `calc((${from.left}) * 0.5 + (${to.left}) * 0.5)`,
        },
      };
    }
    return null;
  }

  // Quadratic or cubic Bézier expressed with calc(), no px conversion needed
  private curveFrames(from: Point, to: Point, curve: Curve): Keyframe[] {
    return Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const t = i / SAMPLES;
      const u = 1 - t;

      const terms = (k: keyof Point): [string, number][] =>
        curve.c2
          ? [
              [from[k], u * u * u],
              [curve.c1[k], 3 * u * u * t],
              [curve.c2[k], 3 * u * t * t],
              [to[k], t * t * t],
            ]
          : [
              [from[k], u * u],
              [curve.c1[k], 2 * u * t],
              [to[k], t * t],
            ];

      return { offset: t, top: mix(terms("top")), left: mix(terms("left")) };
    });
  }
}