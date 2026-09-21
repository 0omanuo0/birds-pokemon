// Decides whether a 3s window is worth running BirdNET on at all.
//
// This is not an optimisation, it is a correctness fix. The BirdNET graph min-max normalizes its
// input to [-1, 1] before computing the spectrogram — the model spec says so outright ("raw audio
// will be normalized between -1 and 1 before spectrogram conversion") and the first nodes after
// `input` are ReduceMin/Sub/ReduceMax/Div. So a near-silent window whose peak is 0.0005 is scaled up
// by ~2000x inside the model, mic hiss arrives at the classifier as a full-scale broadband signal,
// and the nearest class to that is Engine_Engine. No threshold or input scaling can fix it: the
// graph divides any scaling we apply straight back out. The only fix is not to ask.
//
// BirdNET-Analyzer has no such gate because it analyses recordings that contain signal. A live mic
// feeds the model silence most of the time, which is a situation the reference tooling never meets.

/** RMS level of a whole buffer in dBFS. -Infinity for digital silence, which every comparison rejects. */
export function rmsDbfs(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return 20 * Math.log10(Math.sqrt(sum / samples.length));
}

/**
 * Level of the LOUDEST short frame, which is what the gate actually decides on.
 *
 * Averaging over the whole 3s window is the wrong measurement for birds, because a call is short and
 * the rest of the window is room tone. Measured against a room tone at -45dB, an 80ms chirp 20dB
 * above it lifts the 3s RMS by only 4.8dB — under the 6dB gate — while lifting the loudest 100ms
 * frame by 17.7dB. Whole-window RMS was silently discarding ordinary, clearly audible calls before
 * they ever reached the model.
 */
export function peakFrameDbfs(samples: Float32Array, sampleRate: number, frameMs = 100): number {
    const frame = Math.max(1, Math.round((frameMs / 1000) * sampleRate));
    if (samples.length < frame) return rmsDbfs(samples);

    // half-frame hop so a call landing on a frame boundary isn't split across two and halved
    const hop = frame >> 1;
    let best = 0;
    for (let start = 0; start + frame <= samples.length; start += hop) {
        let sum = 0;
        for (let i = start; i < start + frame; i++) sum += samples[i] * samples[i];
        const mean = sum / frame;
        if (mean > best) best = mean;
    }
    return 20 * Math.log10(Math.sqrt(best));
}

// Cutoff for the pre-inference high-pass. 150Hz rather than higher: it has to clear handling noise,
// wind and traffic rumble (nearly all below 100Hz) without eating the genuinely low-voiced birds —
// bitterns boom around 150Hz, grouse around 250Hz, owls around 400Hz.
export const HIGHPASS_HZ = 150;
const HIGHPASS_POLES = 3;

/**
 * High-passes the window in place, before it is measured or classified.
 *
 * This is not cosmetic. The model min-max normalizes its whole 3s input to [-1,1] before computing
 * the spectrogram, so whatever dominates the min and max decides how much dynamic range is left for
 * everything else — and on a handheld phone that is almost always low-frequency rumble. Measured
 * with a 4.5kHz call under 80Hz rumble at 10x its amplitude, the call arrives at the classifier
 * 20.8dB quieter than it would alone; three poles at 150Hz recover about 14dB of that.
 *
 * Every band gains, including bands below the cutoff, because removing the rumble frees range for
 * all of them — so this can't quietly cost us the low-voiced species it's designed to protect.
 *
 * One pole per pass, applied three times: at 144000 samples once per window the cost is nil, and it
 * avoids hand-tuning biquad coefficients for a filter this gentle.
 */
export function highPassInPlace(samples: Float32Array, sampleRate: number, cutoffHz = HIGHPASS_HZ) {
    const rc = 1 / (2 * Math.PI * cutoffHz);
    const dt = 1 / sampleRate;
    const a = rc / (rc + dt);

    for (let pass = 0; pass < HIGHPASS_POLES; pass++) {
        let prevIn = samples[0];
        let prevOut = 0;
        for (let i = 0; i < samples.length; i++) {
            const input = samples[i];
            prevOut = a * (prevOut + input - prevIn);
            prevIn = input;
            samples[i] = prevOut;
        }
    }
}

// A dead, muted or disconnected mic never reaches inference regardless of what the adaptive floor
// is doing. Deliberately low: it is a sanity bound, not the main gate.
export const SILENCE_DBFS = -60;
// How far above the ambient floor a window has to sit to count as "something happened".
export const ACTIVITY_DB = 6;

// Floor tracking. Note this is the MIRROR IMAGE of the spectrogram's floor in lib/spectrogram.ts,
// and deliberately so:
//   - there, a fast-falling floor was the bug, because a display floor that chases the troughs of
//     noise makes ordinary noise read as signal;
//   - here, falling fast is what we want and rising slowly is essential, because a gate floor that
//     is dragged up by the very event it should be detecting would shut the gate on a sustained
//     song after a second or two.
const FLOOR_UP = 0.03; // ~30s to follow a rise, at one window per 1.5s
const FLOOR_DOWN = 0.3; // a few windows to follow a drop, so a passing car doesn't deafen the gate

export class ActivityGate {
    private floor = Number.NaN; // NaN until the first window primes it on the actual room
    private lastDb = -Infinity;

    get floorDb() {
        return this.floor;
    }

    get lastLevelDb() {
        return this.lastDb;
    }

    /** True when this window is worth classifying. Updates the floor either way. */
    accept(db: number): boolean {
        this.lastDb = db;

        // prime on the room rather than on 0dB, so the first window isn't automatically "loud"
        if (Number.isNaN(this.floor)) {
            this.floor = Number.isFinite(db) ? db : SILENCE_DBFS;
            return false;
        }

        // decided against the floor as it was BEFORE this window, so a sound never has to compete
        // with the trace of itself
        const accepted = db > SILENCE_DBFS && db >= this.floor + ACTIVITY_DB;

        if (Number.isFinite(db)) {
            this.floor += (db > this.floor ? FLOOR_UP : FLOOR_DOWN) * (db - this.floor);
        }
        return accepted;
    }

    reset() {
        this.floor = Number.NaN;
        this.lastDb = -Infinity;
    }
}
