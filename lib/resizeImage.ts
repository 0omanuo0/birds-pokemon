// Downscales an image so it fits within max×max (keeps the aspect ratio, never upscales) and re-encodes
// it as JPEG. The identify model doesn't need full camera resolution, so this keeps uploads small.
export async function resizeToJpeg(source: Blob, max = 1000, quality = 0.9): Promise<Blob> {
    // createImageBitmap applies the photo's EXIF orientation, so phone pictures don't come out rotated
    const bitmap = await createImageBitmap(source);
    try {
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                blob => (blob ? resolve(blob) : reject(new Error("Could not encode JPEG"))),
                "image/jpeg",
                quality,
            )
        );
    } finally {
        bitmap.close();
    }
}
