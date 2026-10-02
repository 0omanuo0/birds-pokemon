"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HeatmapCell, SightingStamp } from "@/lib/data";
import type { EbirdSighting } from "@/lib/ebird";
import { formatStamp, HEAT_STEPS } from "./heatSteps";

const SPAIN_CENTER: [number, number] = [40.2, -3.7];
// cells whose bubbles would sit closer than this on screen are merged into one bubble
const CLUSTER_PX = 56;
const MAX_ZOOM = 17;
const EBIRD_COLOR = "#38bdf8";

// eBird gives "YYYY-MM-DD HH:mm" local to the sighting, not a timestamp — no timezone to convert from
const EBIRD_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function formatEbirdDate(obsDt: string) {
    const [datePart, timePart] = obsDt.split(" ");
    const [y, m, d] = datePart.split("-").map(Number);
    return `${d} ${EBIRD_MONTHS[m - 1]} ${y}${timePart ? ` · ${timePart}` : ""}`;
}

type Bubble = {
    key: string;
    position: L.LatLng;
    count: number;
    members: HeatmapCell[];
    latest: SightingStamp[];
};

// Groups cells by on-screen distance at the given zoom: zoomed out they collapse into a few big
// bubbles, zoomed in they split back into one bubble per ~1 km cell. Biggest cells claim first,
// and a bubble's position is the count-weighted centre of what it holds.
function clusterCells(map: L.Map, cells: HeatmapCell[], zoom: number): Bubble[] {
    const points = cells
        .map(cell => ({ cell, point: map.project([cell.lat, cell.lng], zoom) }))
        .sort((a, b) => b.cell.count - a.cell.count);

    const groups: { x: number; y: number; count: number; members: HeatmapCell[] }[] = [];
    for (const { cell, point } of points) {
        const group = groups.find(g => (g.x - point.x) ** 2 + (g.y - point.y) ** 2 < CLUSTER_PX ** 2);
        if (group) {
            const total = group.count + cell.count;
            group.x = (group.x * group.count + point.x * cell.count) / total;
            group.y = (group.y * group.count + point.y * cell.count) / total;
            group.count = total;
            group.members.push(cell);
        } else {
            groups.push({ x: point.x, y: point.y, count: cell.count, members: [cell] });
        }
    }

    return groups.map(group => ({
        key: group.members.map(m => `${m.lat},${m.lng}`).sort().join("|"),
        position: map.unproject([group.x, group.y], zoom),
        count: group.count,
        members: group.members,
        latest: group.members.flatMap(m => m.latest).sort((a, b) => b.seenAt - a.seenAt).slice(0, 3),
    }));
}

function bubbleIcon(count: number, maxCount: number): L.DivIcon {
    const size = Math.round(Math.min(76, 26 + Math.sqrt(count) * 9));
    // sqrt so small bubbles still get some colour next to a hotspot
    const color = HEAT_STEPS[Math.min(HEAT_STEPS.length - 1, Math.floor(Math.sqrt(count / maxCount) * HEAT_STEPS.length))];
    return L.divIcon({
        className: "", // drop Leaflet's default white square
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
        html: `<div class="font-pokemon" style="width:${size}px;height:${size}px;border-radius:9999px;background:${color}cc;border:2px solid #171717;box-shadow:0 0 0 3px ${color}55,0 2px 6px #0008;display:flex;align-items:center;justify-content:center;color:#171717;font-size:${size > 40 ? 15 : 12}px;line-height:1;text-shadow:none">${count}</div>`,
    });
}

function Bubbles({ cells }: { cells: HeatmapCell[] }) {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());
    useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

    const bubbles = useMemo(() => clusterCells(map, cells, zoom), [map, cells, zoom]);
    const maxCount = Math.max(1, ...bubbles.map(b => b.count));

    return (
        <>
            {bubbles.map(bubble => {
                const isGroup = bubble.members.length > 1 && zoom < MAX_ZOOM;
                return (
                    <Marker
                        key={bubble.key}
                        position={bubble.position}
                        icon={bubbleIcon(bubble.count, maxCount)}
                        eventHandlers={isGroup ? {
                            // a group opens by zooming into it until it splits
                            click: () => map.fitBounds(
                                L.latLngBounds(bubble.members.map(m => [m.lat, m.lng] as [number, number])),
                                { padding: [60, 60], maxZoom: Math.min(MAX_ZOOM, zoom + 4) }
                            ),
                        } : undefined}
                    >
                        {!isGroup && (
                            <Popup className="dex-popup" closeButton={false}>
                                <div className="min-w-[170px] text-neutral-100">
                                    <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-yellow-400/60 pb-1 font-pokemon uppercase">
                                        <span className="text-sm">{bubble.count} sighting{bubble.count === 1 ? "" : "s"}</span>
                                        {bubble.count > bubble.latest.length && <span className="text-[10px] text-neutral-400">latest 3</span>}
                                    </div>
                                    <ul className="flex flex-col gap-1">
                                        {bubble.latest.map((s, i) => (
                                            <li key={i} className="flex flex-col leading-tight">
                                                <span className="truncate text-xs font-semibold">{s.name}</span>
                                                <span className="font-pokemon text-[11px] text-yellow-400">{formatStamp(s.seenAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </Popup>
                        )}
                    </Marker>
                );
            })}
        </>
    );
}

function ebirdIcon(): L.DivIcon {
    return L.divIcon({
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -7],
        html: `<div style="width:14px;height:14px;border-radius:9999px;background:${EBIRD_COLOR}cc;border:2px solid #171717;box-shadow:0 1px 4px #0008"></div>`,
    });
}

// eBird's community sightings, separate from our own users' — a lighter marker so it doesn't
// compete visually with the heat bubbles above
function EbirdMarkers({ sightings }: { sightings: EbirdSighting[] }) {
    return (
        <>
            {sightings.map(s => (
                <Marker key={s.subId + s.obsDt} position={[s.lat, s.lng]} icon={ebirdIcon()}>
                    <Popup className="dex-popup" closeButton={false}>
                        <div className="min-w-[170px] text-neutral-100">
                            <div className="mb-1.5 flex items-center gap-1.5 border-b border-sky-400/60 pb-1 font-pokemon text-xs uppercase text-sky-300">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: EBIRD_COLOR }} />
                                eBird
                            </div>
                            <div className="truncate text-xs font-semibold">{s.locName}</div>
                            <div className="font-pokemon text-[11px] text-yellow-400">
                                {formatEbirdDate(s.obsDt)}{s.howMany ? ` · ${s.howMany}` : ""}
                            </div>
                            <a
                                href={`https://ebird.org/checklist/${s.subId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-[11px] text-sky-300 underline"
                            >
                                View checklist ↗
                            </a>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}

// frame every marker (ours + eBird's) once when the map opens
function FitToCells({ cells, ebirdSightings }: { cells: HeatmapCell[]; ebirdSightings: EbirdSighting[] }) {
    const map = useMap();
    useEffect(() => {
        const points = [
            ...cells.map(c => [c.lat, c.lng] as [number, number]),
            ...ebirdSightings.map(s => [s.lat, s.lng] as [number, number]),
        ];
        if (points.length === 0) return;
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 11 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

// exposes the Leaflet map to the page (e.g. the pokeball's "fit all")
function MapReady({ onReady }: { onReady?: (map: L.Map) => void }) {
    const map = useMap();
    useEffect(() => { onReady?.(map); }, [map, onReady]);
    return null;
}

export default function SightingsHeatmap({ cells, ebirdSightings = [], onReady }: {
    cells: HeatmapCell[];
    ebirdSightings?: EbirdSighting[];
    onReady?: (map: L.Map) => void;
}) {
    return (
        <MapContainer
            center={SPAIN_CENTER}
            zoom={6}
            minZoom={3}
            maxZoom={MAX_ZOOM}
            style={{ height: "100%", width: "100%", background: "#171717" }}
            scrollWheelZoom
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <FitToCells cells={cells} ebirdSightings={ebirdSightings} />
            <MapReady onReady={onReady} />
            <EbirdMarkers sightings={ebirdSightings} />
            <Bubbles cells={cells} />
        </MapContainer>
    );
}
