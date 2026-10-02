"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import exifr from "exifr";
import type { IdentifyError, IdentifyResponse } from "@/app/api/identify/route";
import { pushBird } from "@/lib/actions";
import { resizeToJpeg } from "@/lib/resizeImage";
import { REGION_NAMES, regionAt } from "@/lib/regions";
import { PinSvg } from "@/components/imageSvg";

const MapWithNoSSR = dynamic(() => import("@/components/identify/map"), { ssr: false });

type Check =
    | { status: "checking" }
    | { status: "match"; confidence: number }
    | { status: "mismatch"; guess: string; confidence: number; thisBird: number | null; keep: boolean }
    | { status: "error" };

type Item = {
    key: string;
    file: File;
    url: string;
    date: Date;
    location: [number, number] | null;
    fromExif: { date: boolean; gps: boolean };
    check: Check;
    // set once the sighting row exists, so a retry after a failed upload doesn't insert it twice
    imageId: string | null;
    save: "idle" | "saving" | "saved" | "failed";
    error?: string;
};

// value for <input type="datetime-local"> in local time
function toLocalInput(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Date + GPS from the photo's EXIF, when the camera wrote them
async function readExif(file: File): Promise<{ date: Date | null; location: [number, number] | null }> {
    try {
        const tags = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
        const date = tags?.DateTimeOriginal ?? tags?.CreateDate;
        const hasGps = typeof tags?.latitude === "number" && typeof tags?.longitude === "number";
        return {
            date: date instanceof Date && !isNaN(date.getTime()) ? date : null,
            location: hasGps ? [tags.latitude, tags.longitude] : null,
        };
    } catch {
        return { date: null, location: null };
    }
}

export default function AddSightingsDialog({ birdId, birdName, initialFiles, onClose, onSaved }: {
    birdId: number;
    birdName: string;
    initialFiles: File[];
    onClose: () => void;
    // imageIds of the sightings just saved; partial = some photos failed and the dialog stays open
    onSaved: (imageIds: string[], partial: boolean) => void;
}) {
    const [items, setItems] = useState<Item[]>([]);
    const [mapFor, setMapFor] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const mounted = useRef(true);
    const itemsRef = useRef<Item[]>([]);
    itemsRef.current = items;

    const update = (key: string, patch: Partial<Item> | ((item: Item) => Partial<Item>)) =>
        setItems(list => list.map(item => item.key === key ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) } : item));

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            itemsRef.current.forEach(item => URL.revokeObjectURL(item.url));
        };
    }, []);

    // check one photo against this bird with the identifier
    async function verify(item: Item) {
        try {
            const small = await resizeToJpeg(item.file);
            const formData = new FormData();
            formData.append("image", small, "photo.jpg");
            const response = await fetch("/api/identify", { method: "POST", body: formData });
            const data: IdentifyResponse | IdentifyError | null = await response.json().catch(() => null);
            if (!mounted.current) return;
            if (!response.ok || !data || "error" in data || data.candidates.length === 0) {
                update(item.key, { check: { status: "error" } });
                return;
            }
            const [top] = data.candidates;
            if (top.bird?.id === birdId) {
                update(item.key, { check: { status: "match", confidence: top.confidence } });
            } else {
                const thisBird = data.candidates.find(c => c.bird?.id === birdId)?.confidence ?? null;
                update(item.key, {
                    check: { status: "mismatch", guess: top.bird?.name ?? top.scientificName, confidence: top.confidence, thisBird, keep: false },
                });
            }
        } catch {
            if (mounted.current) update(item.key, { check: { status: "error" } });
        }
    }

    async function addFiles(files: File[]) {
        const created: Item[] = await Promise.all(files.map(async file => {
            const exif = await readExif(file);
            return {
                key: crypto.randomUUID(),
                file,
                url: URL.createObjectURL(file),
                date: exif.date ?? new Date(),
                location: exif.location,
                fromExif: { date: !!exif.date, gps: !!exif.location },
                check: { status: "checking" },
                imageId: null,
                save: "idle",
            } satisfies Item;
        }));
        if (!mounted.current) return;
        setItems(list => [...list, ...created]);
        // one at a time: the identifier backend handles a single request well, a burst of them badly
        for (const item of created) {
            if (!mounted.current) return;
            await verify(item);
        }
    }

    // initial selection comes from the "+" slot's file picker
    useEffect(() => {
        if (initialFiles.length) addFiles(initialFiles);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function pickMore() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = event => {
            const files = Array.from((event.target as HTMLInputElement).files ?? []);
            if (files.length) addFiles(files);
        };
        input.click();
    }

    function remove(key: string) {
        setItems(list => {
            const item = list.find(i => i.key === key);
            if (item) URL.revokeObjectURL(item.url);
            return list.filter(i => i.key !== key);
        });
    }

    function locateFor(key: string) {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            position => {
                update(key, { location: [position.coords.latitude, position.coords.longitude] });
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    const pending = items.filter(i => i.save !== "saved");
    const checking = pending.some(i => i.check.status === "checking");
    const undecided = pending.some(i => i.check.status === "mismatch" && !i.check.keep);
    const canSave = pending.length > 0 && !checking && !undecided && !saving;

    async function saveAll() {
        if (!canSave) return;
        setSaving(true);
        const savedImageIds: string[] = [];
        let failed = 0;
        for (const item of itemsRef.current.filter(i => i.save !== "saved")) {
            if (!mounted.current) return;
            update(item.key, { save: "saving", error: undefined });
            try {
                let imageId = item.imageId;
                if (!imageId) {
                    imageId = crypto.randomUUID();
                    const result = await pushBird(
                        birdId, imageId,
                        item.location ? `${item.location[0]},${item.location[1]}` : undefined,
                        item.date.toISOString(),
                    );
                    if (!result.success) throw new Error(result.error);
                    update(item.key, { imageId });
                }
                const formData = new FormData();
                formData.append("image", item.file);
                formData.append("birdId", birdId.toString());
                formData.append("imageId", imageId);
                const upload = await fetch("/api/saveImage", { method: "POST", body: formData });
                if (!upload.ok) throw new Error("Photo upload failed.");
                update(item.key, { save: "saved" });
                savedImageIds.push(imageId);
            } catch (error) {
                failed++;
                update(item.key, { save: "failed", error: error instanceof Error ? error.message : "Unknown error." });
            }
        }
        if (!mounted.current) return;
        setSaving(false);
        // counted in this loop, not read from state: state updates made during the loop aren't visible here yet
        if (savedImageIds.length > 0) onSaved(savedImageIds, failed > 0);
    }

    const mapItem = items.find(i => i.key === mapFor) ?? null;

    return (
        <div className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-neutral-900 text-neutral-100 animate-[device-screen-in_200ms_ease-out]">
            {/* banner */}
            <div className="relative shrink-0 bg-white" style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                <h2
                    style={{ clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)" }}
                    className="relative flex items-center gap-2 bg-neutral-700 py-1 pl-2 pr-[28%] font-pokemon uppercase"
                >
                    <span className="mx-1 inline-block h-3 w-[2px] bg-yellow-400" aria-hidden />
                    <span className="truncate">Add sightings</span>
                    <span className="absolute bottom-0 left-0 h-px w-[70%] bg-yellow-400" aria-hidden />
                </h2>
                <div className="flex items-center justify-between gap-2 px-2 py-1 font-pokemon text-sm uppercase text-neutral-800">
                    <span className="truncate">{birdName}</span>
                    <span className="shrink-0 text-neutral-500">{pending.length} photo{pending.length === 1 ? "" : "s"}</span>
                </div>
            </div>

            {/* list */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
                {items.length === 0 && (
                    <p className="py-8 text-center font-pokemon text-sm uppercase text-neutral-500">Reading photos…</p>
                )}
                {items.map(item => {
                    const region = item.location ? regionAt(item.location[0], item.location[1]) : null;
                    return (
                        <div key={item.key} className={`pixel-corners-4 flex gap-2 p-1.5 ${item.save === "saved" ? "bg-neutral-800/50 opacity-60" : "bg-neutral-800"}`}>
                            <img src={item.url} alt="" className="pixel-corners-4 h-20 w-20 shrink-0 object-cover" />
                            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
                                {/* identifier check */}
                                {item.check.status === "checking" && <span className="animate-pulse font-pokemon uppercase text-neutral-400">Checking…</span>}
                                {item.check.status === "match" && <span className="font-pokemon uppercase text-green-400">✓ Matches · {(item.check.confidence * 100).toFixed(0)}%</span>}
                                {item.check.status === "error" && <span className="font-pokemon uppercase text-neutral-400">· Couldn't verify</span>}
                                {item.check.status === "mismatch" && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-amber-400">
                                            <span className="font-pokemon">⚠ </span>
                                            The AI thinks it's <b>{item.check.guess}</b> ({(item.check.confidence * 100).toFixed(0)}%)
                                            {item.check.thisBird !== null ? `, ${birdName}: ${(item.check.thisBird * 100).toFixed(0)}%` : ""}
                                        </span>
                                        {item.check.keep ? (
                                            <span className="font-pokemon uppercase text-neutral-400">Kept anyway</span>
                                        ) : (
                                            <div className="flex gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => update(item.key, i => ({ check: { ...(i.check as Extract<Check, { status: "mismatch" }>), keep: true } }))}
                                                    className="pixel-corners-4 h-6 cursor-pointer bg-yellow-400 px-2 font-pokemon uppercase text-neutral-900"
                                                >
                                                    I'm sure
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(item.key)}
                                                    className="pixel-corners-4 h-6 cursor-pointer bg-neutral-700 px-2 font-pokemon uppercase text-neutral-200"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* date */}
                                <label className="flex items-center gap-1.5 text-neutral-300">
                                    <span className="w-8 shrink-0 font-pokemon uppercase text-neutral-500">Date</span>
                                    <input
                                        type="datetime-local"
                                        value={toLocalInput(item.date)}
                                        onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) update(item.key, { date: d }); }}
                                        disabled={item.save === "saved"}
                                        className="pixel-corners-1 min-w-0 flex-1 bg-neutral-700 px-1.5 py-0.5 text-neutral-100 [color-scheme:dark]"
                                    />
                                    {item.fromExif.date && <span className="font-pokemon text-[10px] uppercase text-neutral-500" title="Read from the photo">exif</span>}
                                </label>

                                {/* location */}
                                <button
                                    type="button"
                                    onClick={() => setMapFor(item.key)}
                                    disabled={item.save === "saved"}
                                    className="flex cursor-pointer items-center gap-1.5 text-left text-neutral-300"
                                >
                                    <span className="w-8 shrink-0 font-pokemon uppercase text-neutral-500">Loc</span>
                                    {/* size the svg itself: its width="100%" height="auto" attributes blow up to full width on mobile Safari */}
                                    <span className="h-3.5 w-3.5 shrink-0 overflow-hidden [&>svg]:h-full [&>svg]:w-full">{PinSvg}</span>
                                    <span className={`min-w-0 flex-1 truncate ${item.location ? "text-green-400" : "text-neutral-400"}`}>
                                        {item.location ? (region ? REGION_NAMES[region] : `${item.location[0].toFixed(3)}, ${item.location[1].toFixed(3)}`) : "Add location"}
                                    </span>
                                    {item.fromExif.gps && <span className="font-pokemon text-[10px] uppercase text-neutral-500" title="Read from the photo">exif</span>}
                                </button>

                                {item.save === "saving" && <span className="animate-pulse font-pokemon uppercase text-yellow-400">Saving…</span>}
                                {item.save === "saved" && <span className="font-pokemon uppercase text-green-400">✓ Saved</span>}
                                {item.save === "failed" && <span className="text-red-400">✕ {item.error}</span>}
                            </div>
                            {item.save !== "saved" && item.save !== "saving" && (
                                <button
                                    type="button"
                                    onClick={() => remove(item.key)}
                                    aria-label="Remove photo"
                                    className="h-6 w-6 shrink-0 cursor-pointer font-pokemon text-lg leading-none text-red-400"
                                >
                                    x
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* actions */}
            <div className="flex shrink-0 flex-col gap-1.5 border-t-2 border-neutral-800 bg-neutral-900 px-3 pb-3 pt-2">
                {undecided && <p className="text-xs text-amber-400">Confirm or remove the photos marked ⚠ to continue.</p>}
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="pixel-corners-4 h-8 cursor-pointer bg-neutral-700 px-3 font-pokemon text-sm uppercase text-neutral-300 hover:bg-neutral-600 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={pickMore}
                        disabled={saving}
                        className="pixel-corners-4 h-8 cursor-pointer bg-neutral-700 px-3 font-pokemon text-sm uppercase text-neutral-200 hover:bg-neutral-600 disabled:opacity-50"
                    >
                        + Photos
                    </button>
                    <button
                        type="button"
                        onClick={saveAll}
                        disabled={!canSave}
                        style={{ background: "linear-gradient(130deg, #FCC800 15%,#FFE270 40%, #FCC800 82%)" }}
                        className="pixel-corners-6-border h-8 cursor-pointer px-3 pt-0.5 font-pokemon text-base uppercase tracking-wider text-black shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? <span className="animate-pulse">Saving…</span> : checking ? "Checking…" : `Save ${pending.length}`}
                    </button>
                </div>
            </div>

            {/* map for one photo's location */}
            {mapItem && (
                <div className="absolute inset-0 z-50 flex flex-col bg-neutral-900">
                    <div className="relative min-h-0 flex-1">
                        <MapWithNoSSR location={mapItem.location} setLocation={location => update(mapItem.key, { location })} />
                    </div>
                    <div className="flex flex-col gap-2 p-3">
                        {mapItem.location && items.some(i => i.key !== mapItem.key && !i.location && i.save !== "saved") && (
                            <button
                                type="button"
                                onClick={() => setItems(list => list.map(i => (!i.location && i.save !== "saved") ? { ...i, location: mapItem.location } : i))}
                                className="pixel-corners-4 h-9 cursor-pointer bg-neutral-700 font-pokemon text-xs uppercase text-neutral-200 hover:bg-neutral-600"
                            >
                                Use for all photos without location
                            </button>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => locateFor(mapItem.key)}
                                className="pixel-corners-4 h-10 flex-1 cursor-pointer bg-neutral-700 font-pokemon text-sm uppercase text-neutral-200 hover:bg-neutral-600"
                            >
                                {locating ? "Locating…" : "My location"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMapFor(null)}
                                className="pixel-corners-4 h-10 flex-1 cursor-pointer bg-yellow-400 font-pokemon text-sm uppercase text-neutral-900 hover:bg-yellow-300"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
