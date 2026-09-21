// Circular buffer of mic samples, written by the audio thread's message handler and read by two
// independent consumers at different rates: the spectrogram (one short frame per animation frame)
// and BirdNET (a 3s window roughly once a second). Neither consumer can be allowed to dictate when
// the other runs, which is why positions are absolute (`totalWritten`) rather than indices into the
// storage — a reader can ask for "the samples ending here" and be told honestly whether that span
// still exists, instead of silently reading whatever happens to be in those slots now.
export class AudioRing {
    private readonly buf: Float32Array;
    private write = 0; // next slot to write inside buf
    private total = 0; // samples ever pushed — the absolute timeline all reads are expressed in

    constructor(readonly capacity: number) {
        this.buf = new Float32Array(capacity);
    }

    get totalWritten() {
        return this.total;
    }

    push(chunk: Float32Array) {
        // A chunk longer than the whole ring can only leave its tail behind, but `total` still counts
        // every sample: absolute positions stay truthful even for audio that was never stored, so a
        // reader asking for it gets a clean `false` rather than a quietly shifted window.
        const n = Math.min(chunk.length, this.capacity);
        const src = n === chunk.length ? chunk : chunk.subarray(chunk.length - n);
        const first = Math.min(n, this.capacity - this.write);
        this.buf.set(src.subarray(0, first), this.write);
        if (first < n) this.buf.set(src.subarray(first), 0);
        this.write = (this.write + n) % this.capacity;
        this.total += chunk.length;
    }

    // Copies dest.length samples ending (exclusive) at absolute index `endAbs`.
    // Returns false when that span has already been overwritten or hasn't arrived yet; the caller
    // resyncs rather than getting a torn read.
    read(dest: Float32Array, endAbs: number): boolean {
        const startAbs = endAbs - dest.length;
        if (startAbs < 0 || endAbs > this.total || this.total - startAbs > this.capacity) return false;

        let pos = (this.write - (this.total - startAbs)) % this.capacity;
        if (pos < 0) pos += this.capacity;
        const first = Math.min(dest.length, this.capacity - pos);
        dest.set(this.buf.subarray(pos, pos + first), 0);
        if (first < dest.length) dest.set(this.buf.subarray(0, dest.length - first), first);
        return true;
    }
}
