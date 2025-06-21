
// save in public/img the image, it gets as image file in the form
import { s3 } from "@/lib/s3";
import { PutObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import sharp from "sharp";

export async function POST(req: Request) {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    const bird_id = formData.get('birdId') as string;
    const image_id = formData.get('imageId') as string;

    if (!image || !bird_id || !image_id) {
        return new Response("Missing required fields", { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    // convert the image to webp format
    const webpBuffer = await sharp(buffer).webp().toBuffer();



    const upload_params: PutObjectCommandInput = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: `birds/${bird_id}/${image_id}.webp`,
        Body: webpBuffer,
        ContentType: 'image/webp',
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
