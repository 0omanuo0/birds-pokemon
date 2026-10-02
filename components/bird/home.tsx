"use client";

import LateralLeft from "@/components/nav/lateralLeft";
import LateralRight from "@/components/nav/lateralRight";
import PokeballRotation, { PokeballRotationHandle } from "@/components/pokeballRotation";
import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import { addSvg, homeSvg, PinSvg, trashSvg } from "@/components/imageSvg";
import type { Bird, Sighting } from "@/lib/types";
import type { BirdInfo } from "@/app/api/bird_info/route";
import { EMPTY_BIRD_INFO, loadBirdDescription, peekBirdDescription } from "@/lib/birdDescription";
import { useEffect, useMemo, useRef, useState } from "react";
import HeadCard, { formatSeenDate } from "../home/headCard";
import { useRouter } from "next/navigation";
import { deleteSighting } from "@/lib/actions";
import DexNotice from "@/components/ui/dexNotice";
import AddSightingsDialog from "./addSightingsDialog";
import BirdDescription from "./description";


export default function BirdHome({ bird, sightings }: { bird: Bird, sightings: Sighting[] }) {
    const widthImg = 130 - 8 * 2;
    const degrees_per_item = 18; // 360 / 20
    const [selectedImg, setSelectedImg] = useState(0);

    // pad with empty "+" slots up to 10, and always keep at least one so you can add past 10 sightings;
    // memoized so it isn't rebuilt on every wheel tick
    const sightingss: Sighting[] = useMemo(() => [
        ...sightings,
        ...Array.from({ length: Math.max(1, 10 - sightings.length) }, () => ({ photo_url: "" }))
    ] as Sighting[], [sightings]);

    const router = useRouter();
    // files picked from a "+" slot; non-null opens the batch add dialog
    const [addFiles, setAddFiles] = useState<File[] | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Sighting | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState<null | { tone: "success" | "error"; title: string; message: string }>(null);

    // the file picker has to open from the tap itself (browsers block it from effects)
    function pickPhotos() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = event => {
            const files = Array.from((event.target as HTMLInputElement).files ?? []);
            if (files.length) setAddFiles(files);
        };
        input.click();
    }

    async function removeSighting(sighting: Sighting) {
        setDeleting(true);
        const result = await deleteSighting(sighting.sighting_id);
        setDeleting(false);
        setConfirmDelete(null);
        if (!result.success) {
            setNotice({ tone: "error", title: "Delete failed", message: result.error });
            return;
        }
        setSelectedImg(index => Math.max(0, Math.min(index, sightings.length - 2)));
        router.refresh();
    }

    // Photos keep their EXIF date, so new sightings are often older than existing ones and land at the
    // end of the strip, out of view, which looked like the upload had failed. After a save, move the
    // selection (and the wheel) to the first new sighting once the refreshed list arrives.
    const pokeballRef = useRef<PokeballRotationHandle | null>(null);
    const focusImageIds = useRef<string[] | null>(null);
    useEffect(() => {
        const ids = focusImageIds.current;
        if (!ids) return;
        const index = sightings.findIndex(s => ids.some(id => s.photo_url?.includes(id)));
        if (index === -1) return; // refreshed data not here yet
        focusImageIds.current = null;
        setSelectedImg(index);
        pokeballRef.current?.rotateTo(index * degrees_per_item);
    }, [sightings]);

    function onSightingsSaved(imageIds: string[], partial: boolean) {
        focusImageIds.current = imageIds;
        router.refresh();
        // partial save: the dialog stays open showing the failed photos
        if (partial) return;
        setAddFiles(null);
        setNotice({ tone: "success", title: "Registered!", message: `${imageIds.length} sighting${imageIds.length === 1 ? "" : "s"} added to ${bird.name}.` });
    }

    const overlays = (
        <>
            {addFiles && (
                <AddSightingsDialog
                    birdId={bird.id}
                    birdName={bird.name}
                    initialFiles={addFiles}
                    onClose={() => setAddFiles(null)}
                    onSaved={onSightingsSaved}
                />
            )}
            <DexNotice
                open={!!confirmDelete}
                tone="error"
                title="Delete sighting?"
                onClose={() => !deleting && setConfirmDelete(null)}
                actions={[
                    { label: "Cancel", onClick: () => !deleting && setConfirmDelete(null) },
                    { label: deleting ? "Deleting…" : "Delete", primary: true, onClick: () => confirmDelete && !deleting && removeSighting(confirmDelete) },
                ]}
            >
                {confirmDelete?.seen_at
                    ? <>The sighting from <span className="font-pokemon text-yellow-400">{formatSeenDate(Number(confirmDelete.seen_at))}</span> and its photo will be deleted.</>
                    : <>This sighting and its photo will be deleted.</>}
                {sightings.length === 1 && (
                    <span className="mt-2 block text-amber-400">
                        It's your only sighting of {bird.name}: it will go back to unseen in your Pokédex.
                    </span>
                )}
            </DexNotice>
            <DexNotice
                open={!!notice}
                tone={notice?.tone}
                title={notice?.title ?? ""}
                onClose={() => setNotice(null)}
                actions={[{ label: "OK", primary: true, onClick: () => setNotice(null) }]}
            >
                {notice?.message}
            </DexNotice>
        </>
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.offsetWidth || 0);
        }
        // Escuchar resize del navegador
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth || 0);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // null = still loading. Parsed on the server (/api/bird_info) and cached on the client; Home usually
    // prefetched it while the bird was selected, in which case it's there on the first render.
    const [description, setDescription] = useState<BirdInfo | null>(
        () => peekBirdDescription(bird.scientificName) ?? null
    );

    useEffect(() => {
        let cancelled = false;
        const cached = peekBirdDescription(bird.scientificName);
        if (cached) {
            setDescription(cached);
            return;
        }
        setDescription(null);
        loadBirdDescription(bird.scientificName)
            .then(sections => { if (!cancelled) setDescription(sections); })
            .catch(error => {
                console.error("Error fetching bird description:", error);
                if (!cancelled) setDescription(EMPTY_BIRD_INFO);
            });
        return () => { cancelled = true; };
    }, [bird.scientificName]);

    // no sightings: keep the device on screen (it used to render nothing, so the whole shell vanished)
    if (!sightings || sightings.length === 0) {
        return (
            <>
                <DeviceScreen>
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center font-pokemon uppercase text-neutral-400">
                        <span className="text-3xl text-neutral-500">???</span>
                        No sightings yet
                        <button
                            type="button"
                            onClick={pickPhotos}
                            className="pixel-corners-4 h-9 cursor-pointer bg-yellow-400 px-4 text-sm text-neutral-900 hover:bg-yellow-300"
                        >
                            + Add sightings
                        </button>
                    </div>
                    {overlays}
                </DeviceScreen>
                <DeviceControls>
                    <LateralLeft target='/' label="Home">{homeSvg}</LateralLeft>
                    <LateralRight target={`/bird/${bird.id}/map`} label="Map">{PinSvg}</LateralRight>
                </DeviceControls>
            </>
        );
    }

    // frame, bezel and screen height live in DeviceShell (root layout); this only fills the two cells
    return (
        <>
            <DeviceScreen>
                    <div
                        ref={containerRef}
                        className="relative h-full w-full"
                    >
                        <HeadCard selectedBird={{
                            ...bird as any,
                            // HeadCard formats seen_at (unix seconds) itself
                            seen_at: sightingss[selectedImg].seen_at || undefined,
                            location: sightingss[selectedImg].location || undefined
                        }} known_bird={true} />
                        <ul className="flex w-fit select-none items-center h-[150px] mt-4 mb-4"
                            style={{
                                transform: `translateX(${(selectedImg * widthImg - (containerWidth / 2) + (widthImg / 2) + 8) * -1}px)`,
                                transition: "transform 0.3s ease-in-out"
                            }}
                        >
                            {
                                sightingss.map((sighting, index) => (
                                    <li key={index}
                                        style={{
                                            width: `${selectedImg == index ? 150 : 130}px`,
                                            height: `${selectedImg == index ? 150 : 130}px`,
                                            transition: "width 0.3s ease-in-out, height 0.3s ease-in-out",
                                            zIndex: selectedImg == index ? 10 : 1,
                                        }}
                                        className={"flex-shrink-0 -mx-2 overflow-hidden relative " + (selectedImg == index ? "pixel-corners-6-border--wrapper" : "")}
                                    >
                                        {
                                            // only real sightings can be deleted, not the empty "+" slots
                                            selectedImg == index && index < sightings.length &&
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDelete(sighting)}
                                                aria-label="Delete sighting"
                                                className="text-red-700/80 text-xl h-6 w-6 absolute top-2 right-2 z-50 bg-neutral-100 p-1 pixel-corners-4 cursor-pointer"
                                            >
                                                {trashSvg}
                                            </button>
                                        }
                                        {index < sightings.length && !sighting.photo_url ? (
                                            // a real sighting saved without a photo (older data has photo_url null):
                                            // the old fallback pointed at an image that doesn't exist and showed as broken
                                            <div className={"flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-700 font-pokemon text-xs uppercase text-neutral-400" + (selectedImg == index ? " pixel-corners-6-border" : "")}>
                                                <span className="text-2xl text-neutral-500">?</span>
                                                No photo
                                            </div>
                                        ) : sighting.photo_url ?
                                            <img
                                                src={sighting.photo_url}
                                                alt={"" + sighting.sighting_id || "Unknown Bird"}
                                                className={"aspect-square object-cover shadow-md" + (selectedImg == index ? " pixel-corners-6-border" : "")}
                                                width={200}
                                                height={200}
                                                loading="lazy"
                                                decoding="async"
                                                style={{
                                                    // no blur(): a blur filter on every unselected photo was expensive while the strip slides
                                                    filter: selectedImg == index ? "none" : "brightness(0.55) opacity(0.8)",
                                                }}
                                            />
                                            :
                                            <button
                                                type="button"
                                                onClick={pickPhotos}
                                                aria-label="Add sightings"
                                                className="flex items-center justify-center h-full w-full cursor-pointer hover:brightness-125"
                                                style={{
                                                    // background color is descending from #555 to #333 depending of the index
                                                    backgroundColor: `rgba(85, 85, 85, ${1 - (index / sightingss.length)})`
                                                }}
                                            >
                                                <span className="text-neutral-300 h-8 w-8">
                                                    {addSvg}
                                                </span>
                                            </button>
                                        }
                                    </li>
                                ))
                            }
                        </ul>
                        <BirdDescription description={description} />
                    </div>
                    {overlays}
            </DeviceScreen>
            <DeviceControls>
                <LateralLeft target='/' label="Home">{homeSvg}</LateralLeft>
                <LateralRight target={`/bird/${bird.id}/map`} label="Map">{PinSvg}</LateralRight>
                <PokeballRotation
                    ref={pokeballRef}
                    startScroll={0}
                    endScroll={(sightings.length - 1) * degrees_per_item}
                    onWheel={(rotation) => {
                        const id = Math.round(rotation / degrees_per_item);
                        if (id < sightings.length && id >= 0) {
                            setSelectedImg(id);
                        }
                    }}
                />
            </DeviceControls>
        </>
    );
}
