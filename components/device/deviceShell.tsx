"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Noise from "@/components/turbulenceNoise";
import { DeviceProvider } from "./deviceContext";
import ScreenCover from "./screenCover";

type ScreenSize = "standard" | "tall";

// Row 1 = screen, row 2 = controls (pokeball, tabs). Full class strings so Tailwind can see them.
// Keep each SCREEN_ROWS entry and its BEZEL_HEIGHT entry at the same values.
// --shell-h is the viewport height (100dvh); in the Android app it's the height measured before the keyboard
// opened, so the layout doesn't squash when the keyboard shrinks the WebView (see globals.css, AppViewportHeight).
const SCREEN_ROWS: Record<ScreenSize, string> = {
    standard: "grid-rows-[calc(var(--shell-h)_-_50dvw_-_80px)_minmax(0,1fr)] md:grid-rows-[450px_minmax(0,1fr)]",
    tall: "grid-rows-[calc(var(--shell-h)_-_50dvw_-_24px)_minmax(0,1fr)] md:grid-rows-[510px_minmax(0,1fr)]",
};

const BEZEL_HEIGHT: Record<ScreenSize, string> = {
    standard: "h-[calc(var(--shell-h)_-_50dvw_-_80px)] md:h-[450px]",
    tall: "h-[calc(var(--shell-h)_-_50dvw_-_24px)] md:h-[510px]",
};

function sizeFor(pathname: string): ScreenSize | null {
    if (pathname === "/" || pathname === "/pokedex" || pathname === "/identify" || pathname === "/identify-sound"  || pathname === "/add") return "standard";
    if (pathname.startsWith("/bird/") || pathname === "/user") return "tall";
    return null;
}

// Lives in the root layout so it never unmounts between device pages: the frame and bezel stay,
// only the bezel height animates and the page content inside changes.
export default function DeviceShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const size = sizeFor(pathname);

    // non-device routes (e.g. /prueba) render without the shell
    if (!size) return <>{children}</>;

    return (
        <DeviceProvider>
        <div
            // pb: the Android app's bottom bar (0 elsewhere), see --app-bottom-bar in globals.css; everything
            // below the screen is bottom-anchored, so the pokeball and tabs rise with it
            className="h-[var(--shell-h)] pb-[var(--app-bottom-bar)] md:py-4 2xl:py-8 w-full 2xl:flex 2xl:items-center"
            style={{ backgroundImage: "linear-gradient(45deg,#000 10%, #333 60%)" }}
        >
            <div className="text-white md:w-[420px] md:h-[740px] 2xl:w-[500px] 2xl:h-[885px] h-full mx-auto md:rounded-3xl overflow-hidden md:p-2 md:bg-neutral-700">
                {/* grid rows switch instantly (animating grid-template-rows re-laid out every page element
                    each frame, which is what made navigation lag); tabs and pokeball are bottom-anchored,
                    so the controls row changing height doesn't move them */}
                <main
                    className={`relative grid h-full grid-cols-1 overflow-hidden bg-neutral-600 md:rounded-2xl ${SCREEN_ROWS[size]}`}
                >
                    {/* bezel: persistent layer behind the page's screen and the only part that animates. It's out of
                        the grid and holds nothing that reflows, so animating its height is cheap.
                        Notch inset padded so that strip is device-dark. */}
                    <div className={`absolute inset-x-0 top-0 flex flex-col bg-neutral-900 px-3 pb-3 pt-[env(safe-area-inset-top)] transition-[height] duration-250 ease-out ${BEZEL_HEIGHT[size]}`} aria-hidden>
                        <Noise />
                        <nav className="my-2 flex h-8 w-full flex-row items-center justify-between">
                            <div className="h-2 w-2 rounded-full bg-green-400"></div>
                            <span className="font-pokemon text-sm font-medium text-neutral-300">Birds Pokedex</span>
                        </nav>
                    </div>
                    {children}
                    <ScreenCover className={BEZEL_HEIGHT[size]} />
                </main>
            </div>
        </div>
        </DeviceProvider>
    );
}
