import { ReactNode } from "react";
import DeviceLegend from "./deviceLegend";

// Top grid cell of DeviceShell. The top padding clears the bezel's LED/title row (my-2 + h-8 = 3rem).
// The page content remounts on navigation, so the fade-in plays while the shell's bezel animates.
export default function DeviceScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <section className="relative col-start-1 row-start-1 min-h-0 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+3rem)]">
            <div className={`relative flex h-full w-full flex-col overflow-hidden bg-neutral-800 pixel-corners-4 noise-effect ${className}`}>
                {/* the fade is on this wrapper, not the panel: the panel's noise-effect uses an SVG turbulence
                    filter that would be re-rasterized every frame if the panel's opacity animated */}
                <div className="relative flex h-full w-full flex-col animate-[device-screen-in_220ms_ease-out] will-change-[opacity]">
                    {children}
                </div>
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_6px_1px_#171717]" aria-hidden />
            </div>
        </section>
    );
}

// Bottom grid cell. Relative so tabs and the pokeball keep positioning against the device's bottom edge.
// The legend (Spin / Press / Hold) sits at the top of it, fed by the page through <DeviceHintsSetter/>.
export function DeviceControls({ children, className = "", legend = true }: { children: ReactNode; className?: string; legend?: boolean }) {
    return (
        <div className={`relative col-start-1 row-start-2 flex min-h-0 flex-col items-center ${className}`}>
            {legend && <DeviceLegend />}
            {children}
        </div>
    );
}
