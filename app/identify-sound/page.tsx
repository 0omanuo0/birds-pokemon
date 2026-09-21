"use client";

// Realtime bird-sound identification, entirely in the browser: mic → ring buffer → BirdNET in a
// worker, with a live spectrogram drawn from the same ring. No audio leaves the device and nothing
// is written to the dex — this page only shows what it hears.

import { useRouter } from "next/navigation";
import { CameraSvg, homeSvg, trashSvg } from "@/components/imageSvg";
import LateralLeft from "@/components/nav/lateralLeft";
import LateralRight from "@/components/nav/lateralRight";
import PokeballRotation from "@/components/pokeballRotation";
import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import DexNotice from "@/components/ui/dexNotice";
import Spectrogram from "@/components/identify/spectrogram";
import BirdRow, { confidenceCell, confidenceTone } from "@/components/identify/birdRow";
import { MODEL_BYTES_APPROX, useBirdListener, type ErrorKind } from "@/components/identify/useBirdListener";

const ERROR_TEXT: Record<ErrorKind, { title: string; message: string }> = {
    mic: { title: "Microphone", message: "The microphone couldn't be opened. Check the permission and try again." },
    model: { title: "Download failed", message: "The sound model couldn't be loaded. Check your connection and try again." },
    inference: { title: "Analysis failed", message: "The model stopped responding. Try starting again." },
};

function statusLine(listener: ReturnType<typeof useBirdListener>): string {
    switch (listener.status) {
        case "listening":
            // "Too quiet" rather than a stale or bogus guess: the model min-max normalizes its input,
            // so a silent window would otherwise come back as a confident Engine.
            if (listener.tooQuiet) return "Too quiet…";
            if (listener.backgroundNoise) return "Background noise";
            return "Listening…";
        case "loading": {
            const progress = listener.progress;
            if (progress?.phase === "download" && progress.total) {
                return `Loading model… ${Math.round(((progress.received ?? 0) / progress.total) * 100)}%`;
            }
            return progress?.phase === "init" ? "Starting model…" : "Loading…";
        }
        case "error":
            return "Stopped";
        default:
            return "Press ◉ to listen";
    }
}

export default function IdentifySound() {
    const router = useRouter();
    const listener = useBirdListener();
    const { status, predictions, detected } = listener;

    const top = predictions[0];
    const filledCells = top ? Math.round(top.score * 10) : 0;

    // frame, backdrop and bezel come from DeviceShell in the root layout ("standard" screen size)
    return (
        <>
            <DeviceScreen className="">
                <div className="flex h-full min-h-0 flex-col gap-3 bg-neutral-900 px-3 pb-3 pt-3 text-neutral-100">
                    {/* ── spectrogram (fixed, does not scroll) ── */}
                    <div className="pixel-corners-4 shrink-0 border-y-2 border-y-yellow-400 bg-black px-3 py-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span
                                className={`font-pokemon text-[11px] uppercase tracking-wide ${
                                    status === "error" ? "text-red-400" : "text-neutral-400"
                                }`}
                            >
                                {statusLine(listener)}
                            </span>
                            {status === "listening" && (
                                <span className="flex items-center gap-1 font-pokemon text-[11px] uppercase text-red-400">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" aria-hidden />
                                    Rec
                                </span>
                            )}
                        </div>

                        <Spectrogram
                            ring={listener.ring}
                            sampleRate={listener.sampleRate}
                            active={status === "listening"}
                            className="h-32 w-full"
                        />

                        {/* live best guess, whether or not it's confident enough to be listed below.
                            Hidden while the gate is closed or the model is hearing a non-bird: showing
                            a percentage for a window we didn't classify would be a lie. */}
                        {status === "listening" && !listener.tooQuiet && !listener.backgroundNoise && top && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate font-pokemon text-[11px] uppercase text-neutral-300">
                                    {top.commonName}
                                </span>
                                <div className="flex h-2 w-20 shrink-0 gap-[2px]" aria-hidden>
                                    {Array.from({ length: 10 }, (_, i) => (
                                        <span
                                            key={i}
                                            className={`h-full flex-1 ${
                                                i < filledCells ? confidenceCell(top.score) : "bg-neutral-700"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <span className={`shrink-0 font-pokemon text-[11px] ${confidenceTone(top.score)}`}>
                                    {(top.score * 100).toFixed(0)}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Dev only: the numbers needed to calibrate the gate's dB constants on a real
                        mic, plus which inference path actually ran. */}
                    {process.env.NODE_ENV !== "production" && status === "listening" && listener.diagnostics && (
                        <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                            {listener.mode} · {listener.diagnostics.allowed} species
                            {listener.diagnostics.unmatched > 0 && ` (${listener.diagnostics.unmatched} unmatched)`}
                            {" · "}
                            {listener.diagnostics.levelDb.toFixed(0)}dB / floor{" "}
                            {Number.isNaN(listener.diagnostics.floorDb) ? "—" : listener.diagnostics.floorDb.toFixed(0)}dB
                        </span>
                    )}

                    {/* ── birds detected (only this list scrolls) ──── */}
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <div className="flex shrink-0 items-center justify-between">
                            <span className="font-pokemon text-[11px] uppercase tracking-wide text-neutral-400">
                                Birds detected
                            </span>
                            {/* switch to the camera flow — the two identify modes toggle between each other.
                                In the header rather than floating over the list, which it would cover. */}
                            <button
                                onClick={() => router.push("/identify")}
                                aria-label="Identify by photo"
                                className="h-7 w-7 shrink-0 cursor-pointer border-2 border-neutral-700/70 bg-red-400 p-[3px]"
                            >
                                {CameraSvg}
                            </button>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-1">
                            {detected.length === 0 ? (
                                <span className="font-pokemon text-[11px] uppercase text-neutral-500">
                                    {status === "listening" ? "Nothing yet — keep listening" : "Nothing heard yet"}
                                </span>
                            ) : (
                                detected.map(bird => <BirdRow key={bird.scientificName} bird={bird} />)
                            )}
                        </div>
                    </div>
                </div>

                <DexNotice
                    open={status === "confirm"}
                    title="Download model?"
                    onClose={listener.stop}
                    actions={[
                        { label: "Cancel", onClick: listener.stop },
                        { label: "Download", primary: true, onClick: () => void listener.confirm() },
                    ]}
                >
                    BirdNET runs on your phone, so nothing you record is sent anywhere. It needs a one-off{" "}
                    {Math.round(MODEL_BYTES_APPROX / (1024 * 1024))}MB download, kept for next time.
                    {listener.diagnostics && listener.diagnostics.allowed > 0 && (
                        <span className="mt-2 block text-xs text-neutral-400">
                            Listening for {listener.diagnostics.allowed} species from your dex.
                        </span>
                    )}
                </DexNotice>

                <DexNotice
                    open={status === "error"}
                    tone="error"
                    title={listener.error ? ERROR_TEXT[listener.error].title : "Error"}
                    onClose={listener.dismissError}
                    actions={[
                        { label: "Close", onClick: listener.dismissError },
                        { label: "Retry", primary: true, onClick: () => void listener.request() },
                    ]}
                >
                    {listener.error ? ERROR_TEXT[listener.error].message : null}
                </DexNotice>
            </DeviceScreen>

            <DeviceControls>
                <LateralLeft target="/" label="Home">{homeSvg}</LateralLeft>
                <LateralRight onAction={listener.clear} label="Clear">{trashSvg}</LateralRight>
                {/* same legend as the other device pages, labelled for this page's pokeball */}
                <div className="font-pokemon-ns text-lg text-neutral-400 flex gap-6 my-2 shrink-0">
                    <span>
                        <span>◉</span>Press ·{" "}
                        <b className="text-amber-400">{status === "listening" ? "STOP" : "REC"}</b>
                    </span>
                </div>
                <PokeballRotation
                    startScroll={0}
                    endScroll={0}
                    onPress={() => {
                        if (status === "listening") listener.stop();
                        else if (status === "idle") void listener.request();
                    }}
                />
            </DeviceControls>
        </>
    );
}
