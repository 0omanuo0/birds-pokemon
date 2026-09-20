import type { BirdInfo, IucnCode } from "@/app/api/bird_info/route";

// The seven assessed IUCN categories, worst → best, in the standard IUCN colours.
const SCALE: { code: IucnCode; color: string; ink: string }[] = [
    { code: "EX", color: "#000000", ink: "#ffffff" },
    { code: "EW", color: "#542344", ink: "#ffffff" },
    { code: "CR", color: "#d81e05", ink: "#ffffff" },
    { code: "EN", color: "#fc7f3f", ink: "#171717" },
    { code: "VU", color: "#f9e814", ink: "#171717" },
    { code: "NT", color: "#cce226", ink: "#171717" },
    { code: "LC", color: "#60c659", ink: "#171717" },
];

// Pixel-style IUCN scale with the bird's category lit. Falls back to Wikipedia's own status image
// (lazy) when the category isn't one of the seven (e.g. DD/NE) or couldn't be read.
export default function IucnScale({ status, showText=true }: { status: BirdInfo["status"], showText? : boolean  }) {
    const onScale = status.code && SCALE.some(s => s.code === status.code);

    if (!onScale) {
        if (!status.image) return null;
        return (
            <figure className="flex flex-col items-start gap-1">
                <img src={status.image} alt={status.label ?? "Estado de conservación"} loading="lazy" decoding="async"
                    width={200} height={53} className="h-auto max-w-[200px]" />
                {status.label && <figcaption className="text-xs text-neutral-600">{status.label}</figcaption>}
            </figure>
        );
    }

    return (
        <div className="flex flex-col gap-1" role="img" aria-label={`Estado de conservación: ${status.label ?? status.code}`}>
            <div className="flex items-end gap-[3px]">
                {SCALE.map(({ code, color, ink }) => {
                    const active = code === status.code;
                    return (
                        <div key={code} className="flex flex-col items-center">
                            {/* pixel marker above the lit cell */}
                            <svg width="6" height="4" viewBox="0 0 3 2" shapeRendering="crispEdges" aria-hidden
                                className={active ? "mb-[2px]" : "invisible mb-[2px]"}>
                                <path d="M0 0h3v1H0zM1 1h1v1H1z" fill="#171717" />
                            </svg>
                            <span
                                className={`pixel-corners-4 flex items-center justify-center font-pokemon leading-none transition-opacity ${active ? "h-6 w-8 text-xs" : "h-5 w-7 text-[10px] opacity-35"}`}
                                style={{ backgroundColor: color, color: ink }}
                            >
                                {code}
                            </span>
                        </div>
                    );
                })}
            </div>
            {status.label && showText && <span className="font-pokemon text-xs uppercase text-neutral-700">{status.label}</span>}
        </div>
    );
}
