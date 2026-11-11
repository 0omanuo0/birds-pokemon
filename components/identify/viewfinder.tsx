"use client";

import { ImageAddSvg } from "@/components/imageSvg";
import type { useCamera } from "@/lib/useCamera";
import ModeSwitch from "./modeSwitch";
import { RedButton } from "./roundTabs";
import ZoomRail from "./zoomRail";

// The identify screen: the live camera, with every control as a small device-style part on top of it.
//
//   ┌──────────────────────────────┐
//   │ [PHOTO|SOUND]    [REAR] [＋]  │  mode switch · which camera · add a photo
//   │                              │
//   │          ┌        ┐          │  corner marks: where to aim
//   │          └        ┘          │
//   │                              │
//   │       [x0.5 x1 x2 x5]        │  zoom rail
//   └──────────────────────────────┘
//
// Scanning and spinning (zoom) are on the pokeball below, like everywhere else in the app.
type Camera = ReturnType<typeof useCamera>;

// the four corner marks of the aiming frame, drawn with plain borders so they stay crisp pixels
function Marks() {
    const m = "absolute h-5 w-5 border-white/70";
    return (
        <div className="pointer-events-none absolute inset-x-[14%] inset-y-[20%]" aria-hidden>
            <span className={`${m} left-0 top-0 border-l-2 border-t-2`} />
            <span className={`${m} right-0 top-0 border-r-2 border-t-2`} />
            <span className={`${m} bottom-0 left-0 border-b-2 border-l-2`} />
            <span className={`${m} bottom-0 right-0 border-b-2 border-r-2`} />
        </div>
    );
}

export default function Viewfinder({ camera, onAddPhoto, onZoomStep }: {
    camera: Camera;
    onAddPhoto: () => void;
    // a zoom step was tapped (its index in camera.zoom.steps): the page turns the pokeball to it, and the zoom follows the ball
    onZoomStep: (index: number) => void;
}) {
    const { videoRef, ready, denied, zoom } = camera;
    const cams = camera.camera;
    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                // CSS zoom only where the camera can't zoom itself; the photo is cropped the same way
                style={{ transform: zoom.hardware ? undefined : `scale(${zoom.value})` }}
            />

            {/* camera not showing yet: say why instead of leaving a black box */}
            {!ready && (
                <p className="absolute inset-0 flex items-center justify-center px-8 text-center font-pokemon text-sm uppercase text-neutral-400">
                    {denied ? "Camera unavailable. Use + to add a photo." : "Starting camera…"}
                </p>
            )}

            <Marks />

            {/* top bar */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-2 pb-6">
                <ModeSwitch mode="photo" />
                <div className="flex gap-1.5">
                    {cams.count > 1 && (
                        <RedButton label="Switch camera" onPress={cams.cycle}>
                            {cams.facing === "front" ? "Front" : cams.facing === "rear" ? "Rear" : `Cam ${cams.index + 1}`}
                            <span aria-hidden>⟲</span>
                        </RedButton>
                    )}
                    <RedButton label="Add a photo" onPress={onAddPhoto}>
                        <span className="h-4 w-4 [&_svg]:!filter-none" aria-hidden>{ImageAddSvg}</span>
                    </RedButton>
                </div>
            </div>

            {ready && <ZoomRail zoom={zoom} onPick={onZoomStep} />}
        </div>
    );
}
