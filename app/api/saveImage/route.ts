
// save in public/img the image, it gets as image file in the form
import { s3 } from "@/lib/s3";
import { PutObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { getSessionOrDevBypass } from "@/lib/session";

export async function POST(req: Request) {
    // only signed-in users can write to the bucket
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) {
        return new Response("Not signed in", { status: 401 });
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return new Response("Invalid form data", { status: 400 });
    }
    const image = formData.get('image');
    const bird_id = formData.get('birdId');
    const image_id = formData.get('imageId');

    if (!(image instanceof Blob) || image.size === 0 || typeof bird_id !== 'string' || typeof image_id !== 'string' || !bird_id || !image_id) {
        return new Response("Missing required fields", { status: 400 });
    }
    // both end up in the bucket key: only plain ids, so "../" can't escape birds/<id>/
    if (!/^\d+$/.test(bird_id) || !/^[\w-]{1,64}$/.test(image_id)) {
        return new Response("Invalid birdId or imageId", { status: 400 });
    }
    if (image.size > 15 * 1024 * 1024) {
        return new Response("Image too large", { status: 413 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    // webp, at most 2048px on the long side: the dex shows photos at a few hundred px, and full camera
    // resolution made every photo window download megabytes. Only the colour profile is kept: the bucket is
    // public, and the EXIF carried the photo's exact GPS position (the sightings map rounds it to ~1 km).
    let webpBuffer: Buffer;
    try {
        webpBuffer = await sharp(buffer)
            .rotate()
            .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
            .webp()
            .keepIccProfile()
            .toBuffer();
    } catch (error) {
        // corrupt file or a format sharp can't read (e.g. HEIC): a clear 415, not an empty HTML 500
        console.error("Could not decode the uploaded image:", error);
        return new Response("Unsupported or corrupt image", { status: 415 });
    }


    const upload_params: PutObjectCommandInput = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: `birds/${bird_id}/${image_id}.webp`,
        Body: webpBuffer,
        ContentType: 'image/webp',
        // keys are random ids that are never overwritten, so browsers and the CDN can keep them for good
        CacheControl: 'public, max-age=31536000, immutable',
        ACL: 'public-read',
    };

    try {
        await s3.send(new PutObjectCommand(upload_params));
        return new Response("Image uploaded successfully", { status: 200 });
    } catch (error) {
        console.error("Error uploading image:", error);
        return new Response("Error uploading image", { status: 500 });
    }
}
