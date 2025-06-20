import { fetchBirdData } from "@/lib/data";


export async function POST(req: Request) {
    // fetch to "10.1.1.101:5000/predict", the POST request contains a file frame.jpg
    const formData = await req.formData();
    const file = formData.get('image') as File;
    if (!file) {
        return new Response(
            JSON.stringify({
                message: 'No file uploaded',
                status: 'error',
            }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
    const url = process.env.BACKEND_IDENTIFY || 'http://10.1.1.101:5000/predict';
    const newFormData = new FormData();
    newFormData.append('file', file);
    const response = await fetch(url, {
        method: 'POST',
        body: newFormData,
    });
    console.log("URL:", url);

    if (!response.ok) {
        console.error('Failed to process the image:', response.statusText);
        return new Response(
            JSON.stringify({
                message: 'Failed to process the image',
                status: 'error',
            }),
            {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
    let result = await response.json();
    console.log('Prediction result:', result);
    const name = result.prediction;
    const birdData = await fetchBirdData(name);
    // append the bird data to the result
    result = {
        ...result,
        bird: birdData,
    };
    

    return new Response(
        JSON.stringify(result),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
}