"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import type { BirdHeatmap } from "@/lib/data";
import type { EbirdSighting } from "@/lib/ebird";
import LateralLeft from "@/components/nav/lateralLeft";
import LateralRight from "@/components/nav/lateralRight";
import PokeballRotation, { PokeballRotationHandle } from "@/components/pokeballRotation";
import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import { DeviceHintsSetter } from "@/components/device/deviceContext";
import { arrowBoxLeftSvg, homeSvg } from "@/components/imageSvg";
import { formatStamp, HEAT_STEPS } from "./heatSteps";

// Leaflet touches window, so the map only renders on the client
const SightingsHeatmap = dynamic(() => import("./sightingsHeatmap"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full items-center justify-center font-pokemon text-sm uppercase text-neutral-500 animate-pulse">
            Loading map…
        </div>
    ),
});

// The pokeball wheel zooms the map continuously (no detents, so it spins and coasts freely): 36° per zoom level,
// in quarter-level steps (the map's zoomSnap). Zoom limits match sightingsHeatmap (minZoom / MAX_ZOOM / zoomSnap).
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;
const ZOOM_SNAP = 0.25;
const DEGREES_PER_ZOOM = 36;
// the wheel has to be still this long before the map really zooms
const ZOOM_SETTLE_MS = 180;
// the CSS preview covers at most this many zoom levels away from the real zoom (scale 1/4 .. 4)
const MAX_PREVIEW_LEVELS = 2;
const zoomToRotation = (zoom: number) => (zoom - MIN_ZOOM) * DEGREES_PER_ZOOM;

// Every user's sightings of one bird: bubbles on the map, latest observers underneath.
export default function BirdMap({ bird, heatmap, ebirdSightings: initialEbirdSightings }: {
    bird: { id: number; name: string };
    heatmap: BirdHeatmap;
    ebirdSightings: EbirdSighting[];
}) {
    const [map, setMap] = useState<LeafletMap | null>(null);
    // dates are formatted in the viewer's locale and timezone, which the server doesn't know
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // server sent eBird sightings for our own sightings' centroid; refetched below for whatever
    // area the map actually shows once the user pans/zooms
    const [ebirdSightings, setEbirdSightings] = useState(initialEbirdSightings);
    const [ebirdLoading, setEbirdLoading] = useState(false);
    const [ebirdCapped, setEbirdCapped] = useState(false);

    useEffect(() => {
        if (!map) return;
        let currentRequest: AbortController | null = null;

        async function refetchVisibleArea() {
            const bounds = map!.getBounds();
            const center = bounds.getCenter();
            // eBird only takes a radius, not a bbox, so approximate the visible area with the
            // distance to a corner — capped at eBird's own 50km limit for the request itself
            const distKm = center.distanceTo(bounds.getNorthEast()) / 1000;
            const dist = Math.min(50, Math.max(1, Math.round(distKm)));

            currentRequest?.abort();
            const request = new AbortController();
            currentRequest = request;
            setEbirdLoading(true);
            try {
                const res = await fetch(
                    `/api/ebird/nearby?birdId=${bird.id}&lat=${center.lat}&lng=${center.lng}&dist=${dist}`,
                    { signal: request.signal }
                );
                if (res.ok) {
                    const data = await res.json();
                    setEbirdSightings(data.sightings);
                    setEbirdCapped(distKm > 50);
                }
            } catch (err) {
                if ((err as Error)?.name !== "AbortError") console.error("eBird refetch failed:", err);
            } finally {
                if (currentRequest === request) setEbirdLoading(false);
            }
        }

        map.on("moveend", refetchVisibleArea);
        return () => {
            map.off("moveend", refetchVisibleArea);
            currentRequest?.abort();
        };
    }, [map, bird.id]);

    // Wheel <-> map zoom. The wheel drives the map through onWheel; the map drives the wheel back when it zooms
    // some other way (+/- buttons, pinch, a bubble tap, FIT). lastWheelZoom stops the second from fighting the
    // first: a zoom the wheel just asked for must not re-set the wheel, which would cut its spin short.
    const wheelRef = useRef<PokeballRotationHandle | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const lastWheelZoom = useRef<number | null>(null);
    mapRef.current = map;

    // While the wheel spins the map is only scaled with CSS (cheap); the real zoom (tiles, bubbles, eBird refetch)
    // is applied once the wheel has been still for ZOOM_SETTLE_MS, or when the preview has strayed too far.
    const scaleRef = useRef<HTMLDivElement>(null);
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingZoom = useRef<number | null>(null);

    function clearPreview() {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = null;
        pendingZoom.current = null;
        const el = scaleRef.current;
        if (el) {
            el.style.transform = "";
            delete el.dataset.zooming;
        }
    }

    function commitZoom(zoom: number) {
        clearPreview();
        const target = mapRef.current;
        if (target && target.getZoom() !== zoom) target.setZoom(zoom, { animate: false });
    }

    function onWheelZoom(rotation: number) {
        const zoom = MIN_ZOOM + Math.round(rotation / DEGREES_PER_ZOOM / ZOOM_SNAP) * ZOOM_SNAP;
        if (zoom === lastWheelZoom.current) return;
        lastWheelZoom.current = zoom;
        const target = mapRef.current;
        const el = scaleRef.current;
        if (!target || !el) return;

        const delta = zoom - target.getZoom();
        // a long spin: apply what we have so the scale preview never gets huge or tiny
        if (Math.abs(delta) > MAX_PREVIEW_LEVELS) {
            commitZoom(zoom);
            return;
        }
        pendingZoom.current = zoom;
        el.dataset.zooming = "1";
        el.style.transform = `scale(${2 ** delta})`;
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => commitZoom(zoom), ZOOM_SETTLE_MS);
    }

    useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

    useEffect(() => {
        if (!map) return;
        const syncWheel = () => {
            const zoom = map.getZoom();
            if (zoom === lastWheelZoom.current) return;
            // zoomed some other way: drop any half-finished wheel preview
            clearPreview();
            lastWheelZoom.current = zoom;
            wheelRef.current?.rotateTo(zoomToRotation(zoom));
        };
        syncWheel(); // the map starts at its own zoom, not at the wheel's 0
        map.on("zoomend", syncWheel);
        return () => { map.off("zoomend", syncWheel); };
    }, [map]);

    function fitAll() {
        const points: [number, number][] = [
            ...heatmap.cells.map(c => [c.lat, c.lng] as [number, number]),
            ...ebirdSightings.map(s => [s.lat, s.lng] as [number, number]),
        ];
        if (!map || points.length === 0) return;
        map.fitBounds(points, { padding: [50, 50], maxZoom: 11 });
    }

    return (
        <>
            <DeviceScreen>
                {/* banner, same notch as the other dex screens */}
                <div className="relative shrink-0 bg-white" style={{ filter: "drop-shadow(0px 3px 1px #0006)" }}>
                    <h1
                        style={{ clipPath: "polygon(100% 0, 0% 0%, 0% 100%, 70% 100%, 76% 50%, 100% 50%)" }}
                        className="relative flex items-center gap-2 bg-neutral-700 py-1 pl-2 pr-[28%] font-pokemon uppercase"
                    >
                        <span className="mx-1 inline-block h-3 w-[2px] bg-yellow-400" aria-hidden />
                        <span className="truncate">{bird.name}</span>
                        <span className="absolute bottom-0 left-0 h-px w-[70%] bg-yellow-400" aria-hidden />
                    </h1>
                    <div className="flex items-center justify-between gap-2 px-2 py-1 font-pokemon text-sm uppercase text-neutral-800">
                        <span className="truncate">Sightings map</span>
                        <span className="shrink-0 text-neutral-500">
                            {heatmap.total} seen · {heatmap.observers} birder{heatmap.observers === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {/* map */}
                <div className="relative isolate mx-3 mt-3 min-h-0 flex-1 overflow-hidden pixel-corners-4 bg-neutral-900">
                    {heatmap.cells.length > 0 || ebirdSightings.length > 0 ? (
                        <>
                            {/* scaled while the wheel spins; the map's own controls hide meanwhile so they don't grow with it */}
                            <div ref={scaleRef} className="h-full w-full will-change-transform [&[data-zooming]_.leaflet-control-container]:invisible">
                                <SightingsHeatmap cells={heatmap.cells} ebirdSightings={ebirdSightings} onReady={setMap} />
                            </div>
                            <div className="pointer-events-none absolute bottom-1 left-1 z-[1000] flex flex-col gap-1 bg-neutral-900/80 px-1.5 py-1 font-pokemon text-[10px] uppercase text-neutral-300">
                                <div className="flex items-center gap-1.5">
                                    Few
                                    <span className="flex gap-[2px]">
                                        {HEAT_STEPS.map(color => <span key={color} className="h-2 w-2 rounded-full" style={{ background: color }} />)}
                                    </span>
                                    Many
                                </div>
                                {ebirdSightings.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-sky-400" />
                                        eBird
                                    </div>
                                )}
                            </div>
                            {ebirdLoading && (
                                <div className="pointer-events-none absolute right-1 top-1 z-[1000] bg-neutral-900/80 px-1.5 py-0.5 font-pokemon text-[10px] uppercase text-sky-300 animate-pulse">
                                    Searching eBird…
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center font-pokemon text-sm uppercase text-neutral-500">
                            <span className="text-3xl">?</span>
                            No sightings with a location yet
                        </div>
                    )}
                </div>
                <div className="mx-3 mt-1 flex justify-between font-pokemon text-[10px] uppercase text-neutral-500">
                    <span>{heatmap.located} of {heatmap.total} on the map</span>
                    <span>
                        {ebirdSightings.length} from eBird{ebirdCapped ? " (50km max)" : " nearby"}
                    </span>
                </div>

                {/* latest sightings, from everyone */}
                <div className="mx-3 mb-3 mt-2 shrink-0">
                    <div className="mb-1 font-pokemon text-xs uppercase text-yellow-400">Latest sightings</div>
                    {heatmap.latest.length === 0 ? (
                        <div className="font-pokemon text-xs uppercase text-neutral-500">Nobody has seen it yet</div>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {heatmap.latest.map((s, i) => (
                                <li key={i} className="flex items-center justify-between gap-3 bg-neutral-700/60 px-2 py-1 pixel-corners-4">
                                    <span className="truncate text-sm text-neutral-100">{s.name}</span>
                                    <span className="shrink-0 font-pokemon text-xs text-neutral-300" suppressHydrationWarning>
                                        {mounted ? formatStamp(s.seenAt) : " "}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DeviceScreen>
            <DeviceControls>
                <LateralLeft target={`/bird/${bird.id}`} label="Back">{arrowBoxLeftSvg}</LateralLeft>
                <LateralRight target="/" label="Home">{homeSvg}</LateralRight>
                {/* spin: zoom; press: frame every sighting again */}
                <DeviceHintsSetter press="FIT" />
                <PokeballRotation
                    ref={wheelRef}
                    startScroll={0}
                    endScroll={zoomToRotation(MAX_ZOOM)}
                    onWheel={onWheelZoom}
                    onPress={fitAll}
                />
            </DeviceControls>
        </>
    );
}
