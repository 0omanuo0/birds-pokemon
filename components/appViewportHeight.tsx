"use client";

import { useEffect } from "react";

const isTextField = (el: Element | null) =>
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);

// Android app only. Capacitor pads the window by the keyboard's height, so the WebView gets shorter whenever the
// keyboard opens, and everything sized from the viewport height (the device shell's grid rows) squashed with it.
// This records the full height while no text field is focused and publishes it as --app-vh; the shell is sized
// from it (--shell-h in globals.css), so the layout keeps its size, the keyboard simply covers the bottom, and
// the browser still scrolls the focused field into view.
export default function AppViewportHeight() {
    useEffect(() => {
        const root = document.documentElement;
        if (!root.hasAttribute("data-app")) return;

        const apply = () => {
            // a focused field means the keyboard is open (or was just closed with the field still focused):
            // the shorter height is the keyboard's doing, keep the last full one
            if (isTextField(document.activeElement)) return;
            root.style.setProperty("--app-vh", `${window.innerHeight}px`);
        };
        apply();
        window.addEventListener("resize", apply);
        return () => window.removeEventListener("resize", apply);
    }, []);

    return null;
}
