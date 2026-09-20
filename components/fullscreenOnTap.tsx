"use client";

import { useEffect } from "react";

// Enters browser fullscreen on the first tap, on touch devices only.
// Browsers only allow requestFullscreen inside a user gesture, so it can't happen on load.
// touchend (not touchstart/pointerdown) because only the end of a touch counts as a gesture.
// Not supported by iPhone Safari (no-op there); skipped when already running as an installed app.
export default function FullscreenOnTap() {
    useEffect(() => {
        const touchDevice = window.matchMedia("(pointer: coarse)").matches;
        const installed = window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
        if (!touchDevice || installed || !document.fullscreenEnabled) return;

        const enter = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => { });
            }
        };
        window.addEventListener("touchend", enter, { once: true, capture: true });
        return () => window.removeEventListener("touchend", enter, { capture: true });
    }, []);

    return null;
}
