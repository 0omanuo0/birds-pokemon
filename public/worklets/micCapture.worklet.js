// Plain JS on purpose: this is loaded by URL through audioWorklet.addModule(), never bundled.
// All it does is batch the audio thread's 128-sample quantum into larger chunks and hand them over —
// no analysis runs here, so a slow main thread can never stall audio capture.

const CHUNK = 2048; // ~43ms at 48kHz: ~23 messages/s instead of 375 at the raw quantum

class MicCapture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buf = new Float32Array(CHUNK);
        this.n = 0;
    }

    process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (!channel) return true; // mic not delivering yet — keep the node alive

        for (let i = 0; i < channel.length; i++) {
            this.buf[this.n++] = channel[i];
            if (this.n === CHUNK) {
                const copy = this.buf.slice(0);
                this.port.postMessage(copy, [copy.buffer]);
                this.n = 0;
            }
        }
        return true;
    }
}

registerProcessor("mic-capture", MicCapture);
