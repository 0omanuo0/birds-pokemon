
import { fetchBirdData } from '@/lib/data';
import { neon } from '@neondatabase/serverless';

export async function GET(req : Request) {
    // get url param bird_name
    const url = new URL(req.url);
    const bird_name = url.searchParams.get("bird_name");
    if (!bird_name) {
        return new Response(
            JSON.stringify({
                message: 'No bird name provided',
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

    const bird = await fetchBirdData(bird_name);
    if (!bird) {
        return new Response(
            JSON.stringify({
                message: 'Bird not found',
                status: 'error',
            }),
            {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }

   
    return new Response(
        JSON.stringify(bird),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
}
