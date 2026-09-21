import { Fft } from "@/lib/fft";

// Low-res on purpose: the whole image is 80x48 and gets blitted up with smoothing off, so it reads
// as a sprite rather than a heatmap, and a column costs one FFT plus 3840 words of memmove.
export const COLS = 80; // one screenful = the 3s window BirdNET is classifying, so the picture is what the model heard
export const ROWS = 48; // ~1.6 semitones per row across the range below
export const FFT_SIZE = 2048; // 42.7ms / 23.4Hz bins at 48kHz

// Displayed frequency range. Linear 0–24kHz would spend two thirds of the rows on hiss and squeeze
// all bird song into a dozen; log spacing over this range keeps resolution constant in pitch, which
// is what makes a song's shape readable.
const F_MIN = 150;
const F_MAX = 12000;

// --- how "loud" becomes "bright", and how "stands out" becomes yellow ---------------------------
// The floor is per row and asymmetric: it rises slowly so a 1–2s call can't be absorbed into its own
// floor and fade out while it's still sounding, and falls faster so contrast comes back after a
// passing car or a lawnmower stopping.
//
// FLOOR_DOWN has to stay well below one column's worth of noise fluctuation. A row's level is the max
// over its bins, and per-bin noise power is exponentially distributed (~5dB swing column to column),
// so a fast-falling floor dives into the troughs and then reads ordinary noise as signal. Measured
// over 80 columns of steady noise: 0.35 highlights ~3.2 cells per column, 0.1 → 0.4, 0.05 → 0.16.
const FLOOR_UP = 0.02; // ~1.9s to track a rise, at ~27 columns/s
const FLOOR_DOWN = 0.05; // ~0.75s to track a drop
const RANGE_DB = 24; // dB above the floor that maps to full brightness
// 12dB rather than 10: the same measurement puts 10dB at ~0.6 false cells per column and 12dB at
// ~0.16, while a 5-column chirp is still caught in every column at either threshold.
const HIGHLIGHT_DB = 12; // this far above its own row's floor counts as "something is there"
const GATE_DB = -78; // absolute gate: never highlight in near-silence, where the floor is meaningless

// Base ramp is the device's own neutral scale, so quiet audio reads as screen background rather than
// as a picture of nothing. The highlight ramp ends on yellow-400, the page's attention colour.
const BASE = ["#0a0a0a", "#262626", "#404040", "#737373", "#a3a3a3"];
const HIGH = ["#7a5c00", "#c79a00", "#facc15"];
export const BASE_STEPS = BASE.length;
export const HI_STEPS = HIGH.length;

// ImageData is bytes in memory order (R,G,B,A); writing it a word at a time means packing in the
// host's byte order, which is little-endian everywhere in practice but cheap to check.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
function pack(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (LITTLE_ENDIAN ? (255 << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}
export const PALETTE = new Uint32Array([...BASE, ...HIGH].map(pack));

// Samples per column, chosen so COLS columns span the 3s analysis window (1800 at 48kHz → 37.5ms,
// ~27 columns/s). Note this is smaller than FFT_SIZE on purpose: the windows overlap slightly, so
// every input sample lands in some column and short chips can't fall between them.
export function hopFor(sampleRate: number): number {
    return Math.max(1, Math.round((sampleRate * 3) / COLS));
}

// Turns one FFT frame into one column of palette indices. Stateful: it carries the per-row noise
// floor between columns, so it belongs to a listening session and is thrown away with it.
export class SpectrogramColumns {
    private readonly fft: Fft;
    private readonly power: Float32Array;
    private readonly edge: Int32Array;
    private readonly floorDb: Float32Array;
    private primed = false;

    constructor(sampleRate: number) {
        this.fft = new Fft(FFT_SIZE);
        this.power = new Float32Array(FFT_SIZE / 2);
        this.floorDb = new Float32Array(ROWS);

        const binsPerHz = FFT_SIZE / sampleRate;
        this.edge = new Int32Array(ROWS + 1);
        for (let r = 0; r <= ROWS; r++) {
            const hz = F_MIN * Math.pow(F_MAX / F_MIN, r / ROWS);
            this.edge[r] = Math.min(FFT_SIZE / 2 - 1, Math.round(hz * binsPerHz));
        }
        // the bottom rows are narrower than one bin (23.4Hz at 48kHz) — give every row at least one,
        // otherwise they'd all read the same bin and the bass end would be a flat band
        for (let r = 0; r < ROWS; r++) if (this.edge[r + 1] <= this.edge[r]) this.edge[r + 1] = this.edge[r] + 1;
    }

    // out[r] is a PALETTE index; row 0 is the LOWEST frequency (the renderer flips it to the bottom).
    compute(frame: Float32Array, out: Uint8Array) {
        this.fft.power(frame, this.power);

        for (let r = 0; r < ROWS; r++) {
            // max, not mean: a whistle occupying 2 of a row's 20 bins survives max and is averaged
            // into the floor by mean — max is what keeps thin calls visible at this resolution
            let peak = 0;
            for (let b = this.edge[r]; b < this.edge[r + 1]; b++) if (this.power[b] > peak) peak = this.power[b];
            const db = 10 * Math.log10(peak + 1e-12);

            if (!this.primed) this.floorDb[r] = db; // start on the room, so the first second isn't all yellow
            const floor = this.floorDb[r];
            this.floorDb[r] = floor + (db > floor ? FLOOR_UP : FLOOR_DOWN) * (db - floor);

            // compared against the floor as it was *before* this column, so a sound never competes
            // with the trace of itself
            const above = db - floor;
            if (above >= HIGHLIGHT_DB && db > GATE_DB) {
                const t = (above - HIGHLIGHT_DB) / Math.max(1, RANGE_DB - HIGHLIGHT_DB);
                out[r] = BASE_STEPS + Math.min(HI_STEPS - 1, Math.floor(t * HI_STEPS));
            } else {
                out[r] = Math.min(BASE_STEPS - 1, Math.floor((Math.max(0, above) / RANGE_DB) * BASE_STEPS));
            }
        }
        this.primed = true;
    }
}

// Owns the COLS x ROWS bitmap and scrolls it. Never enters the DOM: the page draws it, scaled up,
// onto its own visible canvas.
export class SpectrogramRenderer {
    private readonly low: HTMLCanvasElement;
    private readonly lowCtx: CanvasRenderingContext2D;
    private readonly image: ImageData;
    private readonly pixels: Uint32Array;

    constructor() {
        this.low = document.createElement("canvas");
        this.low.width = COLS;
        this.low.height = ROWS;
        const ctx = this.low.getContext("2d");
        if (!ctx) throw new Error("2d canvas unavailable");
        this.lowCtx = ctx;
        this.image = ctx.createImageData(COLS, ROWS);
        this.pixels = new Uint32Array(this.image.data.buffer);
        this.clear();
    }

    clear() {
        this.pixels.fill(PALETTE[0]);
        this.lowCtx.putImageData(this.image, 0, 0);
    }

    pushColumn(col: Uint8Array) {
        // One copyWithin shifts the entire image one pixel left. It bleeds each row's first pixel
        // into the previous row's last pixel — which is exactly the column overwritten next, so the
        // wrap is free rather than something to guard against.
        this.pixels.copyWithin(0, 1);
        for (let r = 0; r < ROWS; r++) {
            // row 0 is the lowest frequency and belongs at the BOTTOM of the picture
            this.pixels[(ROWS - 1 - r) * COLS + (COLS - 1)] = PALETTE[col[r]];
        }
        this.lowCtx.putImageData(this.image, 0, 0);
    }

    blit(ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.low, 0, 0, COLS * scaleX, ROWS * scaleY);
    }
}
