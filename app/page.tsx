import Main from '@/components/home/main';
import { UserProvider } from '@/components/userContext';
import { Bird } from '@/lib/types';
import { neon } from '@neondatabase/serverless';
import { getSessionOrDevBypass } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function Home() {
    const sql = neon(process.env.DATABASE_URL || "");
    const session = await getSessionOrDevBypass();

    if (!session?.user?.email) {
        redirect('/api/auth/signin');
    }

    let user: any = null;
    try {
        [user] = await sql`SELECT * FROM users WHERE email = ${session.user.email};`;
        if (!user || !user.user_id) {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Error loading user for home page:', error);
        redirect('/api/auth/signin');
    }

    let birds_known: Bird[] = [];
    try {
        const sightings = await sql`SELECT *, EXTRACT(EPOCH FROM seen_at) AS date_unix FROM sightings WHERE user_id = ${user.user_id} ORDER BY bird_id;`;
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

    const birds_data_raw = await sql`SELECT * FROM birds ORDER BY bird_id;`;
    const birds_data = birds_data_raw.map((bird: any) => ({
        id: bird.bird_id,
        name: bird.common_name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        scientificName: bird.scientific_name,
        family: bird.family,
        na: bird.na,
        ca: bird.ca,
        pb: bird.pb,
        nameEn: bird.name_en,
        rare: /\bR[12]\b/.test(bird.seo_notes ?? ''),
    }));

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return (
        <UserProvider userD={user}>
            <Main birds_default={birds_data} birds_seen={birds_known} />
        </UserProvider>
    );
}
