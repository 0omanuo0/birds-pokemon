import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import LateralLeft from "@/components/nav/lateralLeft";
import { homeSvg } from "@/components/imageSvg";
import { PixelBird, PIXEL_BIRDS, pixelBirdGroups } from "@/components/pixelBirds";

// Style check for the pixel birds: every group's 4 designs in their standard colours, with the
// silhouette an unmet bird gets below. Swatches follow the palette order: body, wing, belly, bill, legs, accent.
const PART_NAMES = ["body", "wing", "belly", "bill", "legs", "accent"];

// graph paper, as behind the sprites in docs/mockup-v3.html
const PAPER: React.CSSProperties = {
    backgroundColor: "#f4efe0",
    backgroundImage:
        "linear-gradient(to right, #0000001a 1px, transparent 1px), linear-gradient(to bottom, #0000001a 1px, transparent 1px)",
    backgroundSize: "8px 8px",
};

export default function TestPage() {
    return (
        <>
            <DeviceScreen>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <h2 className="mb-3 flex items-center gap-1.5 font-pokemon text-base uppercase text-neutral-500">
                        <span className="inline-block h-2.5 w-[2px] bg-yellow-500" aria-hidden />
                        Pixel birds
                    </h2>
                    <ul className="flex flex-col gap-5">
                        {pixelBirdGroups().map(group => (
                            <li key={group}>
                                <span className="mb-1 block font-pokemon text-sm uppercase leading-none text-white">{group}</span>
                                <div className="grid grid-cols-4 gap-1">
                                    {PIXEL_BIRDS[group].map(d => (
                                        <div key={d.id} className="flex min-w-0 flex-col gap-0.5">
                                            <div className="aspect-square p-0.5" style={PAPER}>
                                                <PixelBird group={group} design={d.id} title={d.name} />
                                            </div>
                                            <div className="aspect-[2/1] p-0.5" style={PAPER}>
                                                <PixelBird group={group} design={d.id} silhouette className="mx-auto" />
                                            </div>
                                            <span className="flex">
                                                {d.colors.map((color, i) => (
                                                    <span
                                                        key={i}
                                                        title={`${PART_NAMES[i]} ${color}`}
                                                        className="h-2 flex-1 border border-black/60"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </span>
                                            <span className="truncate text-[10px] leading-tight text-neutral-300">{d.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </DeviceScreen>
            <DeviceControls legend={false}>
                <LateralLeft offsetY={16} n={1} positionIDX={0} target="/" label="Home">{homeSvg}</LateralLeft>
            </DeviceControls>
        </>
    );
}
