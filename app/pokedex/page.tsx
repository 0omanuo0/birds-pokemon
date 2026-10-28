import Main from '@/components/pokedex/main';
import { Bird } from '@/lib/types';
import { neon } from '@neondatabase/serverless';
import { getCurrentUser } from '@/lib/currentUser';
import { dexBirds } from '@/lib/data';
import { redirect } from 'next/navigation';

export default async function Pokedex() {
    const sql = neon(process.env.DATABASE_URL || "");
    // the species list is the same for everyone and cached; it loads while the user is looked up
    const [current, birds_data] = await Promise.all([getCurrentUser(), dexBirds()]);
    if (!current) {
        redirect('/api/auth/signin');
    }

    let birds_known: Bird[] = [];
    try {
        const sightings = await sql`SELECT *, EXTRACT(EPOCH FROM seen_at) AS date_unix FROM sightings WHERE user_id = ${current.user.user_id} ORDER BY bird_id;`;
        birds_known = sightings.map((sighting: any) => ({
            ...sighting,
            seen_at: sighting.date_unix ? Math.floor(sighting.date_unix) : null,
        })) as Bird[];
    } catch (error) {
        console.error('Error fetching birds known:', error);
        birds_known = [];
    }

    birds_known = birds_known.map((bird: any) => {
        Object.entries(bird).forEach(([key, value]) => {
            if (typeof value === 'string') {
                bird[key] = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }
        });
        return bird;
    });

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return <Main birds_default={birds_data} birds_seen={birds_known} />;
}
