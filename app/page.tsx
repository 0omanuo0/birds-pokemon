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
    const email = session.user.email;

    // The three queries don't depend on each other, so they run together: one round trip to the database
    // instead of three in a row (each is a network hop to Neon, and this page is what every navigation home waits on).
    // Sightings join the user by email instead of waiting for the user's id.
    const [users, sightings, birds_data_raw] = await Promise.all([
        sql`SELECT * FROM users WHERE email = ${email};`,
        sql`
            SELECT s.*, EXTRACT(EPOCH FROM s.seen_at) AS date_unix
            FROM sightings s JOIN users u ON u.user_id = s.user_id
            WHERE u.email = ${email}
            ORDER BY s.bird_id;`
            .catch(error => {
                console.error('Error fetching birds known:', error);
                return [];
            }),
        sql`
            SELECT bird_id, common_name, scientific_name, family, na, ca, pb, name_en, seo_notes
            FROM birds ORDER BY bird_id;`,
    ]);

    const user: any = users[0];
    if (!user || !user.user_id) {
        console.error('Error loading user for home page: user not found');
        redirect('/api/auth/signin');
    }

    let birds_known: Bird[] = sightings.map((sighting: any) => ({
        ...sighting,
        seen_at: sighting.date_unix ? Math.floor(sighting.date_unix) : null,
    })) as Bird[];

    birds_known = birds_known.map((bird: any) => {
        Object.entries(bird).forEach(([key, value]) => {
            if (typeof value === 'string') {
                bird[key] = value.normalize('NFD').replace(/[̀-ͯ]/g, '');
            }
        });
        return bird;
    });

    const birds_data = birds_data_raw.map((bird: any) => ({
        id: bird.bird_id,
        name: bird.common_name.normalize('NFD').replace(/[̀-ͯ]/g, ''),
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
