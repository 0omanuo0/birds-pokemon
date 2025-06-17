
// save in public/img the image, it gets as image file in the form

export async function POST(req: Request) {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    const bird_id = formData.get('birdId') as File;
    // save the image in public/img
    const fs = require('fs');
    const path = require('path');
    const imagePath = path.join(process.cwd(), 'public', 'img', 'bird_' + bird_id + '.jpg');
    const buffer = Buffer.from(await image.arrayBuffer());
    fs.writeFileSync(imagePath, buffer);
    return new Response("Image saved");
}