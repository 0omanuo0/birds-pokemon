// Radix-2 FFT specialised for the spectrogram: real input, power spectrum out, same size every call.
// Everything that only depends on the size — the Hann window, the bit-reversal permutation and the
// twiddle factors — is built once in the constructor. Computing twiddles inside the butterfly loop
// (two Math.cos/Math.sin per butterfly, ~22k of them per column at size 2048) costs far more than
// the arithmetic it feeds, and it is the difference between this running in the animation frame
// budget and not.
export class Fft {
    private readonly re: Float32Array;
    private readonly im: Float32Array;
    private readonly window: Float32Array;
    private readonly rev: Uint32Array;
    private readonly cos: Float32Array;
    private readonly sin: Float32Array;

    constructor(readonly size: number) {
        if (size < 2 || (size & (size - 1)) !== 0) throw new Error("FFT size must be a power of 2");

        this.re = new Float32Array(size);
        this.im = new Float32Array(size);

        this.window = new Float32Array(size);
        for (let i = 0; i < size; i++) this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));

        this.rev = new Uint32Array(size);
        const bits = Math.log2(size);
        for (let i = 0; i < size; i++) {
            let r = 0;
            for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
            this.rev[i] = r;
        }

        // Twiddles for every stage laid out back to back: stage `size=2<<s` starts at offset
        // (size/2 - 1) - ... — simpler to just index per stage with a running offset at use time.
        this.cos = new Float32Array(size);
        this.sin = new Float32Array(size);
        let offset = 0;
        for (let len = 2; len <= size; len <<= 1) {
            const half = len >> 1;
            const angle = (-2 * Math.PI) / len;
            for (let i = 0; i < half; i++) {
                this.cos[offset + i] = Math.cos(angle * i);
                this.sin[offset + i] = Math.sin(angle * i);
            }
            offset += half;
        }
    }

    // Hann-windowed |X[k]|^2 for k < size/2, written into `out` (length size/2).
    power(samples: Float32Array, out: Float32Array) {
        const { size, re, im, window, rev, cos, sin } = this;

        // window and bit-reverse in one pass, so no separate in-place permutation is needed
        for (let i = 0; i < size; i++) {
            re[rev[i]] = samples[i] * window[i];
            im[i] = 0;
        }

        let offset = 0;
        for (let len = 2; len <= size; len <<= 1) {
            const half = len >> 1;
            for (let start = 0; start < size; start += len) {
                for (let i = 0; i < half; i++) {
                    const c = cos[offset + i];
                    const s = sin[offset + i];
                    const even = start + i;
                    const odd = even + half;
                    const tr = re[odd] * c - im[odd] * s;
                    const ti = re[odd] * s + im[odd] * c;
                    re[odd] = re[even] - tr;
                    im[odd] = im[even] - ti;
                    re[even] += tr;
                    im[even] += ti;
                }
            }
            offset += half;
        }

        for (let i = 0; i < out.length; i++) out[i] = re[i] * re[i] + im[i] * im[i];
    }
}
