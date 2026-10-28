import { memo } from "react";
import { PixelBird, pixelBirdDesignFor } from "@/components/pixelBirds";

function BirdCardScroll(
    { bird, setSelectedBird, known, selected, indent }
        : { bird: any, setSelectedBird: (bird: any) => void, known: boolean, selected: boolean, indent: number }
) {
    const tone = selected
        ? "bg-[#202023] text-yellow-500"
        : known
            ? "bg-[#525258] text-white"
            : "bg-[#3e3e40] text-neutral-500";

    const sciTone = selected
        ? "text-yellow-500/60"
        : known
            ? "text-neutral-300"
            : "text-neutral-500";

    return (
        <li
            style={{ marginLeft: indent }}
            className={`relative flex h-[32px] shrink-0 cursor-pointer select-none items-center gap-2 overflow-hidden pl-3 pr-4 -mr-2 pixel-corners-4 transition-[margin-left,background-color,color] duration-150 hover:brightness-110 ${tone}`}
            onClick={() => setSelectedBird(bird)}
        >
            {/* pixel cursor, like the Gen 4/5 dex list; drawn 2x on a 3×5 grid so it stays crisp */}
            {selected && (
                <svg width="6" height="10" viewBox="0 0 3 5" shapeRendering="crispEdges" className="-mr-0.5 shrink-0" aria-hidden>
                    <path d="M0 0h1v1H0zM0 1h2v1H0zM0 2h3v1H0zM0 3h2v1H0zM0 4h1v1H0z" fill="currentColor" />
                </svg>
            )}

            {/* the family sprite: a black shadow until the bird is found, then in colour */}
            <span className="h-[24px] w-[24px] shrink-0">
                <PixelBird
                    family={bird.family}
                    design={pixelBirdDesignFor(bird.family, bird.scientificName)}
                    silhouette={!known}
                />
            </span>

            {/* name keeps priority; the scientific name gives way first */}
            <span className="min-w-0 max-w-full shrink-0 truncate font-pokemon text-base leading-none">
                {known ? bird.name : "???"}
            </span>
            <span className={`mt-[2px] min-w-0 truncate font-pokemon text-xs leading-none ${sciTone}`}>
                {bird.scientificName || "???"}
            </span>
        </li>
    )
}

// Rows far from the selection all get the same saturated indent, so memo lets them
// skip re-rendering while the wheel moves.
export default memo(BirdCardScroll);
