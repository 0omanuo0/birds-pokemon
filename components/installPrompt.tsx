"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "a2hs_dismissed_at";
const HIDE_FOR_MS = 30 * 24 * 60 * 60 * 1000; // after "Got it", ask again in a month
const SHOW_AFTER_MS = 4000; // let the page settle before interrupting

function isIOS() {
    const ua = navigator.userAgent;
    // iPadOS 13+ reports itself as a Mac, the touch points give it away
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
    // navigator.standalone is the iOS-only flag; display-mode covers other browsers
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
        || window.matchMedia("(display-mode: standalone)").matches
        || window.matchMedia("(display-mode: fullscreen)").matches;
}

function recentlyDismissed() {
    try {
        const at = Number(localStorage.getItem(DISMISSED_KEY));
        return at > 0 && Date.now() - at < HIDE_FOR_MS;
    } catch {
        return false; // storage blocked: just show it
    }
}

// iOS can't install a web app by itself, the only way is Share → Add to Home Screen, so this explains it.
// Shown once the page has loaded, only on iOS, only in the browser (not once installed, not inside the Android
// app) and not again for a month after it's dismissed.
export default function InstallPrompt() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (document.documentElement.hasAttribute("data-app")) return;
        if (!isIOS() || isInstalled() || recentlyDismissed()) return;
        const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
        return () => clearTimeout(timer);
    }, []);

    function dismiss() {
        setVisible(false);
        try {
            localStorage.setItem(DISMISSED_KEY, String(Date.now()));
        } catch { /* nothing to remember it with */ }
    }

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-label="Install Birds Pokédex"
            className="fixed inset-x-3 z-[100] animate-[device-screen-in_300ms_ease-out]"
            style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
            <div className="pixel-corners-4 bg-neutral-800 p-4 text-neutral-200 shadow-2xl">
                <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 [image-rendering:pixelated]" />
                    <div className="min-w-0 flex-1">
                        <p className="font-pokemon text-lg leading-tight text-white">Install Birds Pokédex</p>
                        <p className="mt-1 text-sm text-neutral-300">
                            Add it to your home screen to open it full screen, like an app.
                        </p>
                    </div>
                </div>

                <ol className="mt-3 space-y-2 text-sm text-neutral-200">
                    <li className="flex items-center gap-2">
                        <span className="font-pokemon text-amber-400">1</span>
                        Tap the Share button
                        {/* the iOS share glyph: a box with an arrow leaving it */}
                        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 3v12M8 7l4-4 4 4" />
                            <path d="M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                        </svg>
                        in the browser bar
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="font-pokemon text-amber-400">2</span>
                        Choose <b className="text-white">Add to Home Screen</b>
                        {/* the iOS "add" glyph: a rounded square with a plus */}
                        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                            <path d="M12 8v8M8 12h8" />
                        </svg>
                    </li>
                </ol>

                <button
                    onClick={dismiss}
                    className="font-pokemon mt-4 w-full cursor-pointer bg-neutral-600 py-2 text-base tracking-wider text-white active:bg-neutral-500"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
