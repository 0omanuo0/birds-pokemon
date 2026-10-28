"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PixelBird, pixelBirdDesignFor } from "@/components/pixelBirds";
import PhotoWindow from "@/components/photoWindow";
import { loadReferencePhoto, peekReferencePhoto } from "@/lib/referencePhoto";
import { mosaicTileFor } from "@/lib/mosaicAtlas";

// graph paper behind a sprite, as in docs/mockup-v3.html
const PAPER: React.CSSProperties = {
    backgroundColor: "#f4efe0",
    backgroundImage:
        "linear-gradient(to right, #0000001a 1px, transparent 1px), linear-gradient(to bottom, #0000001a 1px, transparent 1px)",
    backgroundSize: "10px 10px",
};

export default function BirdCard(
    { selectedBird, selectedBirdSeenD, known_bird }
        : { selectedBird: any, selectedBirdSeenD: any, known_bird: boolean }
) {
    const router = useRouter();
    const ownPhoto: string | undefined = known_bird ? selectedBirdSeenD?.photo_url || undefined : undefined;
    const sci: string | undefined = selectedBird?.scientificName;

    // the species' reference photo (lib/referencePhoto): the mosaic for a bird not met yet, or the
    // picture of a met bird that has no photo of its own
    const [reference, setReference] = useState<{ sci: string; src: string | null } | null>(null);
    // a bird not met yet with a tile in the prebuilt atlas needs no photo at all
    const tile = !known_bird ? mosaicTileFor(sci) : null;
    const hasTile = !!tile;
    useEffect(() => {
        if (!sci || ownPhoto || hasTile) return;
        let cancelled = false;
        loadReferencePhoto(sci).then(src => { if (!cancelled) setReference({ sci, src }); });
        return () => { cancelled = true; };
    }, [sci, ownPhoto, hasTile]);
    const peeked = sci ? peekReferencePhoto(sci) : undefined;
    const referenceKnown = !!sci && (reference?.sci === sci || peeked !== undefined);
    const referenceSrc = sci ? (reference?.sci === sci ? reference.src : peeked ?? null) : null;

    const design = selectedBird ? pixelBirdDesignFor(selectedBird.family, selectedBird.scientificName) : 0;
    // no photo at all: the family sprite on paper, black while the bird is unknown
    const sprite = selectedBird && (
        <div className="flex h-full w-full items-center justify-center" style={PAPER}>
            <div className="h-[84px] w-[84px]">
                <PixelBird family={selectedBird.family} design={design} silhouette={!known_bird} />
            </div>
        </div>
    );

    return (
        <div className="m-2 mt-4" onClick={() => {
            if (known_bird) {

                router.push(`/bird/${selectedBird?.bird_id || selectedBird?.id}`);
            }
        }}>
            <div className="bg-main-image px-2 pt-5 pb-2">
                {selectedBird ? (
                    <PhotoWindow
                        key={sci}
                        className="h-[200px] w-[200px]"
                        src={ownPhoto ?? referenceSrc}
                        locked={!known_bird}
                        tile={tile}
                        alt={known_bird ? selectedBird.name : "Unknown bird"}
                        fallback={sprite}
                        placeholder={selectedBird && (
                            <div className="relative flex h-full w-full items-center justify-center" style={PAPER}>
                                <div className="h-[84px] w-[84px] animate-[sprite-bob_0.8s_steps(1)_infinite]">
                                    <PixelBird family={selectedBird.family} design={design} />
                                </div>
                                {/* three pixel dots hopping in turn */}
                                <span className="absolute inset-x-0 bottom-4 flex justify-center gap-[6px]" aria-label="Loading">
                                    {[0, 1, 2].map(i => (
                                        <span
                                            key={i}
                                            className="h-[6px] w-[6px] bg-neutral-700 animate-[dot-hop_0.9s_steps(1)_infinite]"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </span>
                            </div>
                        )}
                        pending={!ownPhoto && !referenceKnown}
                    />
                ) : (
                    <div className="w-[200px] h-[200px] aspect-square border details-bg border-neutral-500 bg-white flex items-center justify-center">
                        <span className="font-pokemon text-black text-6xl select-none">?</span>
                    </div>
                )}
            </div>
            <div
                style={{
                    backgroundImage: "url('/img/container_info.svg')",
                    backgroundSize: "cover",
                }}
                className="min-w-[150px] max-w-[180px] min-h-[120px] absolute -mt-12 ml-4 px-2 pt-3 pb-2 select-none"
            >
                <ul
                    style={{
                        lineHeight: 0.8,
                    }}
                    className="details-bg bg-white min-h-[90px] rounded-xs w-full mt-[7px] p-1 text-black mr-3 text-sm font-pokemon-smaller leading-tight space-y-0.5"
                >
                    <li>
                        <span className="text-gray-500 mr-1">SCI</span> <i>{selectedBird?.scientificName || "???"}</i>
                    </li>
                    <li>
                        <span className="text-gray-500 mr-1">FAM</span> <i>{selectedBird?.family || "???"}</i>
                    </li>
                    <li className="flex items-center">
                        <span className="text-gray-500 mr-1">HAB</span>
                        {selectedBird?.pb && <span className="ml-1 h-[14px] px-1 leading-[14px] bg-yellow-200 text-[10px] pixel-corners-1 uppercase">pb</span>}
                        {selectedBird?.na && <span className="ml-1 h-[14px] px-1 leading-[14px] bg-blue-200 text-[10px] pixel-corners-1 uppercase">na</span>}
                        {selectedBird?.ca && <span className="ml-1 h-[14px] px-1 leading-[14px] bg-green-200 text-[10px] pixel-corners-1 uppercase">ca</span>}
                    </li>
                    <li>
                        <span className="font-bold">DESC</span> {selectedBird?.description || "???"}
                    </li>
                </ul>

            </div>
        </div>
    )
}