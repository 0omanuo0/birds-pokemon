// The three areas of the SEO/BirdLife Spanish list (birds.pb / birds.na / birds.ca).
export type RegionCode = "pb" | "na" | "ca";

export const REGION_NAMES: Record<RegionCode, string> = {
    pb: "the Peninsula & Balearics",
    na: "North Africa",
    ca: "the Canary Islands",
};

// Rough bounding boxes, good enough to tell the three areas apart. Checked in this order because the
// North-African box (Ceuta, Melilla and the islets) overlaps the southern edge of the peninsula's box.
const BOXES: { code: RegionCode; lat: [number, number]; lng: [number, number] }[] = [
    { code: "ca", lat: [27.5, 29.5], lng: [-18.3, -13.3] },
    // Ceuta
    { code: "na", lat: [35.85, 35.93], lng: [-5.39, -5.26] },
    // Melilla, Chafarinas, Alhucemas and Vélez de la Gomera
    { code: "na", lat: [35.1, 35.35], lng: [-4.35, -2.37] },
    { code: "pb", lat: [35.9, 43.9], lng: [-9.5, 4.6] },
];

// null = outside the area the list covers
export function regionAt(lat: number, lng: number): RegionCode | null {
    return BOXES.find(b => lat >= b.lat[0] && lat <= b.lat[1] && lng >= b.lng[0] && lng <= b.lng[1])?.code ?? null;
}
