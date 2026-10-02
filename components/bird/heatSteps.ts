import { formatSeenDate } from "@/components/home/headCard";

// Shared by the map page and the Leaflet map; kept Leaflet-free so the page can import it during SSR.
export const HEAT_STEPS = ["#fde68a", "#fbbf24", "#f97316", "#ef4444", "#b91c1c"];

// "14 MAR 2026 · 18:42" in the viewer's locale and timezone
export const formatStamp = (seenAt: number) =>
    `${formatSeenDate(seenAt)} · ${new Date(seenAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
