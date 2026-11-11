import { fetchBirdData } from '@/lib/data';
import { getSessionOrDevBypass } from '@/lib/session';

export async function GET(req: Request) {
    // signed-in users only, like the rest of the data routes
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) {
        return Response.json({ message: 'Not signed in', status: 'error' }, { status: 401 });
    }

    const bird_name = new URL(req.url).searchParams.get("bird_name");
    if (!bird_name) {
        return Response.json({ message: 'No bird name provided', status: 'error' }, { status: 400 });
    }

    try {
        const bird = await fetchBirdData(bird_name);
        if (!bird) {
            return Response.json({ message: 'Bird not found', status: 'error' }, { status: 404 });
        }
        return Response.json(bird);
    } catch (error) {
        console.error("bird lookup failed for", bird_name, error);
        return Response.json({ message: 'Lookup failed', status: 'error' }, { status: 500 });
    }
}
