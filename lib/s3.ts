import { S3Client } from "@aws-sdk/client-s3";


export const s3 = new S3Client({
    region: "auto", // Cloudflare R2 usa "auto"
    endpoint: process.env.CLOUDFLARE_R2_S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_S3_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_S3_SECRET,
    },
} as any);