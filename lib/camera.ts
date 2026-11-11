// Camera helpers for the identify page: hardware zoom and full-resolution stills.
//
// A <video> preview is only a stream (usually 1080p to 1440p). Where the browser supports it (Chrome on Android),
// ImageCapture.takePhoto() asks the sensor for a real still at its largest size. Elsewhere the best we can do is
// grab a frame of the stream, so the stream itself is requested as large as is reasonable.

type ZoomCaps = { min: number; max: number; step: number };

// Not in lib.dom yet: zoom, and the ImageCapture API
type ZoomTrackCapabilities = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
type ImageCaptureLike = {
    getPhotoCapabilities(): Promise<{ imageWidth?: { max: number }; imageHeight?: { max: number } }>;
    takePhoto(settings?: { imageWidth?: number; imageHeight?: number }): Promise<Blob>;
};

// The zoom range of a track, or null when the camera has no hardware (or logical multi-lens) zoom.
// On phones with several back lenses, Chrome exposes one logical camera whose zoom range spans them: zooming in
// is what makes the phone switch to the telephoto lens.
export function zoomCapsOf(track: MediaStreamTrack | undefined): ZoomCaps | null {
    const z = (track?.getCapabilities?.() as ZoomTrackCapabilities | undefined)?.zoom;
    if (!z || !(z.max > z.min)) return null;
    return { min: z.min, max: z.max, step: z.step || 0.1 };
}

// The most we let the wheel reach: a 30x phone zoom is only noise, and the wheel needs a usable range.
const MAX_FACTOR = 10;

// `factor` is 1 for the camera's widest view, up to MAX_FACTOR. Returns the zoom actually applied, or null if the
// camera can't zoom in hardware (the caller then zooms the preview with CSS and crops the capture).
export async function applyZoom(track: MediaStreamTrack | undefined, caps: ZoomCaps | null, factor: number): Promise<number | null> {
    if (!track || !caps) return null;
    const wanted = Math.min(caps.max, caps.min * Math.max(1, factor), caps.min * MAX_FACTOR);
    const value = Math.round(wanted / caps.step) * caps.step;
    try {
        await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
        return value;
    } catch {
        return null;
    }
}

// Zoom the track to `value` in the camera's own units (1 = the main lens, 0.5 = ultra-wide, 5 = a 5x tele...), clamped to
// what the camera allows. Returns the value applied, or null when it could not be.
export async function applyZoomValue(track: MediaStreamTrack | undefined, caps: ZoomCaps | null, value: number): Promise<number | null> {
    if (!track || !caps) return null;
    const v = Math.min(caps.max, Math.max(caps.min, Math.round(value / caps.step) * caps.step));
    try {
        await track.applyConstraints({ advanced: [{ zoom: v } as MediaTrackConstraintSet] });
        return v;
    } catch {
        return null;
    }
}

// How far the wheel can zoom in, as a factor, for this camera (CSS zoom when there is no hardware zoom)
export function maxFactorOf(caps: ZoomCaps | null): number {
    return caps ? Math.min(MAX_FACTOR, caps.max / caps.min) : 5;
}

// The part of the preview the user actually sees, as fractions (0..1) of the camera frame: the <video> fills its box
// with object-fit: cover (so the frame is cropped on one axis), then a CSS zoom crops the middle further.
function visibleFraction(video: HTMLVideoElement, cssZoom: number): { w: number; h: number } {
    const vw = video.videoWidth, vh = video.videoHeight;
    const bw = video.clientWidth || vw, bh = video.clientHeight || vh;
    const cover = Math.max(bw / vw, bh / vh);
    const z = Math.max(1, cssZoom);
    return { w: Math.min(1, bw / cover / vw / z), h: Math.min(1, bh / cover / vh / z) };
}

// Crops `source` (a full-size still, or the video itself) to what the preview showed, at the source's own resolution.
// A still can have another shape than the stream (a 4:3 sensor against a 16:9 preview): the stream is the centred crop
// of the still that spans its width or its height, and the visible part is measured inside that.
function cropToPreview(source: CanvasImageSource, sw: number, sh: number, video: HTMLVideoElement, cssZoom: number): Promise<Blob | null> {
    const vis = visibleFraction(video, cssZoom);
    const streamAspect = video.videoWidth / video.videoHeight;
    const frameW = Math.min(sw, sh * streamAspect), frameH = frameW / streamAspect; // the stream's frame inside the source, in source pixels
    const cw = frameW * vis.w, ch = frameH * vis.h;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.95));
}

// A still of what the camera sees now, as large as the camera allows.
// `cssZoom` is the zoom the preview applies with CSS (1 when the zoom is in hardware): the still is cropped to match,
// so what is saved is what was framed.
export async function captureStill(video: HTMLVideoElement, track: MediaStreamTrack | undefined, cssZoom: number): Promise<Blob | null> {
    const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture;
    if (track && ImageCaptureCtor && track.readyState === "live") {
        try {
            const ic = new ImageCaptureCtor(track);
            const caps = await ic.getPhotoCapabilities();
            const blob = await ic.takePhoto({ imageWidth: caps.imageWidth?.max, imageHeight: caps.imageHeight?.max });
            if (blob.size > 0) {
                // take the biggest photo the sensor gives, then crop it to what the preview showed
                // (createImageBitmap applies the EXIF rotation, so the still has the preview's orientation)
                const bitmap = await createImageBitmap(blob);
                try {
                    const portraitStill = bitmap.height > bitmap.width, portraitStream = video.videoHeight > video.videoWidth;
                    if (portraitStill === portraitStream) return await cropToPreview(bitmap, bitmap.width, bitmap.height, video, cssZoom);
                } finally { bitmap.close(); }
                return blob; // orientation doesn't match the preview's: don't guess, keep the whole photo
            }
        } catch {
            // takePhoto refused (busy, unsupported settings): fall back to a frame of the stream
        }
    }
    return cropToPreview(video, video.videoWidth, video.videoHeight, video, cssZoom);
}
