import atlas from "./mosaicAtlas.json";

// Where a species' tile sits in the mosaic atlas built by scripts/build-mosaics.mjs (one small PNG with
// every reference photo shrunk to 10x10). A locked bird points a CSS background at its tile, so it shows
// on the first frame with no request of its own.

export type MosaicTile = { url: string; cols: number; rows: number; col: number; row: number };

const URL_ = `/mosaics/atlas.png?v=${atlas.version}`;
const index = atlas.index as Record<string, number>;

export function mosaicTileFor(scientificName: string | undefined): MosaicTile | null {
    const i = scientificName ? index[scientificName.trim()] : undefined;
    if (i === undefined) return null;
    return { url: URL_, cols: atlas.cols, rows: atlas.rows, col: i % atlas.cols, row: Math.floor(i / atlas.cols) };
}

// fetch the atlas as soon as the pokedex code loads, before the first locked bird needs it
if (typeof window !== "undefined") {
    const image = new Image();
    image.src = URL_;
}
