"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import PokeballRotation, { PokeballRotationHandle } from "@/components/pokeballRotation";
import { useDevice } from "./deviceContext";

// One navigation model for list-like pages: every <Stop> is somewhere the ▶ cursor can rest.
// Spin the ball to move it, press to act on it, tap a stop to move there and act. Stops are ordered by
// their position in the DOM, so a page only has to render them in reading order.
//
//   <CursorProvider>
//     <DeviceScreen><StopScroll>…<Stop hint="Open" onPress={…}>…</Stop>…</StopScroll></DeviceScreen>
//     <DeviceControls><CursorBall /></DeviceControls>
//   </CursorProvider>

const STEP = 18; // degrees of ball per stop, the same detent the Dex list uses

type StopRecord = { id: string; el: HTMLElement; onPress: () => void; hint: string };

type CursorContextValue = {
    currentId: string | null;
    count: number;
    ballRef: React.RefObject<PokeballRotationHandle | null>;
    register: (stop: StopRecord) => () => void;
    activate: (id: string) => void;
    setIndex: (i: number) => void;
    press: () => void;
};

const CursorContext = createContext<CursorContextValue | null>(null);

function inReadingOrder(a: StopRecord, b: StopRecord) {
    return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function CursorProvider({ children }: { children: ReactNode }) {
    const device = useDevice();
    const setHints = device?.setHints;
    const stops = useRef(new Map<string, StopRecord>());
    const ballRef = useRef<PokeballRotationHandle | null>(null);
    const [count, setCount] = useState(0);
    const [index, setIndexState] = useState(0);
    const [currentId, setCurrentId] = useState<string | null>(null);

    const ordered = useCallback(() => [...stops.current.values()].sort(inReadingOrder), []);

    const register = useCallback((stop: StopRecord) => {
        stops.current.set(stop.id, stop);
        setCount(stops.current.size);
        return () => {
            stops.current.delete(stop.id);
            setCount(stops.current.size);
        };
    }, []);

    const setIndex = useCallback((i: number) => setIndexState(Math.max(0, i)), []);

    // the cursor follows the stops: clamp when some disappear, then publish who is current, scroll it into view and update the hints
    useEffect(() => {
        const list = ordered();
        if (list.length === 0) {
            setCurrentId(null);
            return;
        }
        const i = Math.min(index, list.length - 1);
        const cur = list[i];
        setCurrentId(cur.id);
        // the first stop shows its heading too: go to the top of the scroll area instead of just "nearest"
        const scroller = cur.el.closest<HTMLElement>("[data-stop-scroll]");
        if (i === 0 && scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
        else cur.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setHints?.({ press: cur.hint, hold: "Catch" });
        return () => setHints?.({ press: null, hold: "Catch" });
    }, [index, count, ordered, setHints]);

    const press = useCallback(() => {
        const list = ordered();
        list[Math.min(index, list.length - 1)]?.onPress();
    }, [index, ordered]);

    const activate = useCallback((id: string) => {
        const list = ordered();
        const i = list.findIndex(s => s.id === id);
        if (i < 0) return;
        setIndexState(i);
        ballRef.current?.rotateTo(i * STEP);
        list[i].onPress();
    }, [ordered]);

    const value = useMemo(
        () => ({ currentId, count, ballRef, register, activate, setIndex, press }),
        [currentId, count, register, activate, setIndex, press],
    );
    return <CursorContext.Provider value={value}>{children}</CursorContext.Provider>;
}

function useCursor() {
    const ctx = useContext(CursorContext);
    if (!ctx) throw new Error("Stop and CursorBall must be inside a CursorProvider");
    return ctx;
}

// A resting place for the cursor. Don't give it pixel-corners: the clip-path would cut the outline and the ▶.
export function Stop({ onPress, hint = "Open", className = "", children }: { onPress: () => void; hint?: string; className?: string; children: ReactNode }) {
    const { currentId, register, activate } = useCursor();
    const id = useId();
    const ref = useRef<HTMLDivElement>(null);
    const onPressRef = useRef(onPress);
    onPressRef.current = onPress;

    useEffect(() => {
        if (!ref.current) return;
        return register({ id, el: ref.current, onPress: () => onPressRef.current(), hint });
    }, [id, hint, register]);

    return (
        <div ref={ref} role="button" tabIndex={-1} data-cur={currentId === id} className={`stop cursor-pointer ${className}`} onClick={() => activate(id)}>
            {children}
        </div>
    );
}

// The scrolling column the stops live in. Leaves room on the left for the ▶.
export function StopScroll({ className = "", children }: { className?: string; children: ReactNode }) {
    return (
        <div data-stop-scroll className={`min-h-0 flex-1 overflow-y-auto py-3 pl-5 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
            {children}
        </div>
    );
}

// The ball wired to the cursor: one detent per stop.
export function CursorBall() {
    const { ballRef, count, setIndex, press } = useCursor();
    return (
        <PokeballRotation
            ref={ballRef}
            snapStep={STEP}
            startScroll={0}
            endScroll={Math.max(0, count - 1) * STEP}
            onWheel={rotation => setIndex(Math.round(rotation / STEP))}
            onPress={press}
        />
    );
}
