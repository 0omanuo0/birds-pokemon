import PhotoWindow from "@/components/photoWindow";
import { PixelBird, pixelBirdDesignFor } from "@/components/pixelBirds";
import { mosaicTileFor } from "@/lib/mosaicAtlas";

// graph paper behind a sprite, as in docs/mockup-v3.html
export const PAPER: React.CSSProperties = {
    backgroundColor: "#f4efe0",
    backgroundImage:
        "linear-gradient(to right, #0000001a 1px, transparent 1px), linear-gradient(to bottom, #0000001a 1px, transparent 1px)",
    backgroundSize: "8px 8px",
};

type PicBird = { name: string; scientificName: string; family: string; seen?: boolean; photo?: string | null };

// A bird's picture on Today:
// - met, with a photo: your own photo in the photo window
// - not met and `mystery`: a grey mosaic of its reference photo (prebuilt atlas), a shape without giving it away.
//   Only where a little mystery helps (maybe today): a wall of grey squares elsewhere just reads as gloomy.
// - otherwise: its pixel sprite in colour, on paper. Never a black shadow: pixel birds are drawn per group, so a
//   shadow can't tell a robin from a sparrow and teaches nothing.
export default function BirdPic({ bird, className, mark = "text-2xl", mystery = false }: { bird: PicBird; className: string; mark?: string; mystery?: boolean }) {
    const sprite = (
        <div className="flex h-full w-full items-center justify-center" style={PAPER}>
            <div className="h-[82%] w-[82%]">
                <PixelBird family={bird.family} design={pixelBirdDesignFor(bird.family, bird.scientificName)} />
            </div>
        </div>
    );
    if (bird.seen && bird.photo) return <PhotoWindow className={className} src={bird.photo} fallback={sprite} alt={bird.name} />;
    if (!bird.seen && mystery) {
        const tile = mosaicTileFor(bird.scientificName);
        if (tile) return <PhotoWindow className={className} locked tile={tile} fallback={sprite} markClassName={mark} alt={`${bird.name}, not met yet`} />;
    }
    return <PhotoWindow className={className} fallback={sprite} alt={bird.name} />;
}
