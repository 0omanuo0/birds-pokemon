import { AudioRing } from "@/lib/audioRing";

const PREFERRED_RATE = 48000; // what BirdNET wants; most browsers ignore the hint, hence the ring's rate below
const RING_SECONDS = 6; // 3s analysis window plus slack, so a busy frame never loses the window mid-copy

export type MicCapture = {
    /** The context's real rate. Everything downstream reads this instead of assuming 48kHz. */
    sampleRate: number;
    ring: AudioRing;
    usedWorklet: boolean;
    stop: () => void;
};

/**
 * Opens the mic and streams it into an AudioRing. Nothing is analysed here: the ring is the only
 * handoff point, so the spectrogram and the model can each read it at their own rate without
 * either one running on the audio thread.
 *
 * The ring stays at the context's native rate (44.1kHz on Safari). Only the 3s model window is
 * resampled, which avoids having to carry fractional resampler phase across chunks forever.
 */
export async function startMicCapture(): Promise<MicCapture> {
    // Browsers default these to true and tune them for speech: they actively suppress and distort
    // non-speech, non-stationary sound like bird calls. Leaving them on is a common reason a mic
    // pipeline "just doesn't identify anything" while the model itself is fine.
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
    });

    // Per the Web Audio spec every node runs at the context's nominal rate, and
    // createMediaStreamSource is required to convert the mic's hardware rate to it — so
    // audioContext.sampleRate really is the rate of what reaches this code, not just a label.
    const audioContext = new AudioContext({ sampleRate: PREFERRED_RATE });
    const sampleRate = audioContext.sampleRate;
    const ring = new AudioRing(Math.ceil(sampleRate * RING_SECONDS));
    const source = audioContext.createMediaStreamSource(stream);

    let node: AudioNode | null = null;
    let usedWorklet = false;

    try {
        await audioContext.audioWorklet.addModule("/worklets/micCapture.worklet.js");
        const worklet = new AudioWorkletNode(audioContext, "mic-capture", { numberOfInputs: 1, numberOfOutputs: 0 });
        worklet.port.onmessage = event => ring.push(event.data as Float32Array);
        source.connect(worklet);
        node = worklet;
        usedWorklet = true;
    } catch (err) {
        // older Safari, or the module failing to load: fall back to the deprecated node, which still
        // works everywhere and only has to copy into the ring here
        console.warn("AudioWorklet unavailable, falling back to ScriptProcessorNode:", err);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = event => ring.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        source.connect(processor);
        // Safari only pulls audio through a ScriptProcessorNode that reaches a destination; it has
        // one output channel of silence, so this is inaudible
        processor.connect(audioContext.destination);
        node = processor;
    }

    // Autoplay policies can hand back a suspended context even though the user did press a button.
    if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});

    let stopped = false;
    const stop = () => {
        if (stopped) return;
        stopped = true;
        if (node instanceof AudioWorkletNode) node.port.onmessage = null;
        if (node && "onaudioprocess" in node) (node as ScriptProcessorNode).onaudioprocess = null;
        node?.disconnect();
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        // close() rejects if the context is already closing; nothing useful to do about it
        audioContext.close().catch(() => {});
    };

    return { sampleRate, ring, usedWorklet, stop };
}
