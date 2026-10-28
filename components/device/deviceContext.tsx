"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// What the legend above the ball shows. A page sets it with <DeviceHintsSetter/> (or the cursor does it for its
// stops); null hides that control's entry. Hold defaults to Catch on every page.
// press and hold are the two the ball always has; a page with more to say (a double tap, say) adds entries in `more`.
export type LegendEntry = { symbol: string; verb: string; label: string };

export type DeviceHints = {
    press?: string | null;
    hold?: string | null;
    more?: LegendEntry[];
};

const DEFAULT_HINTS: DeviceHints = { press: null, hold: "Catch" };

type DeviceContextValue = {
    hints: DeviceHints;
    setHints: (hints: DeviceHints) => void;
    goBack: () => void;
    // the default for holding the ball: throw it, i.e. open the catch flow
    holdCatch: () => void;
    // how many pages are keeping the boot cover shut (see useScreenHold)
    screenHolds: number;
    holdScreen: () => () => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

// null outside the device shell (routes like /prueba render without it), so callers can degrade.
export const useDevice = () => useContext(DeviceContext);

// Sets the legend while the calling page is mounted, and puts the defaults back after.
export function useDeviceHints(hints: DeviceHints) {
    const device = useDevice();
    const setHints = device?.setHints;
    const { press, hold } = hints;
    // an array literal is a new object every render; compare it by value so the effect doesn't re-run each time
    const moreKey = JSON.stringify(hints.more ?? []);
    useEffect(() => {
        setHints?.({ ...DEFAULT_HINTS, press, hold: hold === undefined ? DEFAULT_HINTS.hold : hold, more: JSON.parse(moreKey) });
        return () => setHints?.(DEFAULT_HINTS);
    }, [setHints, press, hold, moreKey]);
}

export function DeviceHintsSetter(props: DeviceHints) {
    useDeviceHints(props);
    return null;
}

// Keeps the boot cover (ScreenCover) shut while `active`, e.g. until a page has its first data. Only matters on the
// first load; the cover opens anyway after a few seconds.
export function useScreenHold(active: boolean) {
    const holdScreen = useDevice()?.holdScreen;
    useEffect(() => {
        if (active && holdScreen) return holdScreen();
    }, [active, holdScreen]);
}

function isEditable(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

// Lives in DeviceShell, so it survives navigation between device pages.
export function DeviceProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [hints, setHintsState] = useState<DeviceHints>(DEFAULT_HINTS);
    const setHints = useCallback((h: DeviceHints) => setHintsState(h), []);
    const [screenHolds, setScreenHolds] = useState(0);
    const holdScreen = useCallback(() => {
        setScreenHolds(n => n + 1);
        return () => setScreenHolds(n => n - 1);
    }, []);

    const goBack = useCallback(() => {
        // a page opened directly (no history to go back to) falls back to Home
        if (window.history.length > 1) router.back();
        else router.push("/");
    }, [router]);

    const holdCatch = useCallback(() => {
        // already in the catch flow: holding does nothing
        if (pathname.startsWith("/identify") || pathname === "/add") return;
        router.push("/identify");
    }, [pathname, router]);

    // Esc / Backspace = Back. Typing, modifier combos and open dialogs are left alone.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
            if (e.key !== "Escape" && e.key !== "Backspace") return;
            // an open dialog closes itself on Escape; don't also navigate away. The Dex filter stays mounted when closed, but inert.
            if (document.querySelector('[aria-modal="true"]:not([inert])')) return;
            if (pathname === "/") return;
            e.preventDefault();
            goBack();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [goBack, pathname]);

    const value = useMemo<DeviceContextValue>(
        () => ({ hints, setHints, goBack, holdCatch, screenHolds, holdScreen }),
        [hints, setHints, goBack, holdCatch, screenHolds, holdScreen],
    );

    return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}
