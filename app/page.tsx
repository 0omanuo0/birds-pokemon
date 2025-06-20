import Main from '@/components/home/main';
import { UserProvider } from '@/components/userContext';
import { Bird } from '@/lib/types';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

// BIRDS DB TABLE
// bird_idINTEGER
// PRIMARY KEY
// GENERATED ALWAYS AS IDENTITY
// common_nameVARCHAR(100)
// NOT NULL
// scientific_nameVARCHAR(100)
// familyVARCHAR(50)
// subspeciesTEXT
// name_enVARCHAR(100)
// name_esVARCHAR(100)
// pbBOOLEAN
// NOT NULL
// DEFAULTfalse
// naBOOLEAN
// NOT NULL
// DEFAULTfalse
// caBOOLEAN
// NOT NULL
// DEFAULTfalse
// seo_notesTEXT

export default async function Home() {

    const sql = neon(process.env.DATABASE_URL || "");
    let user = null;
    const session = await getServerSession();
    console.log("Session data:", session);
    if (!session || !session.user || !session.user.email) {
            // Redirect to sign-in page if session or user email is not available
            redirect('/api/auth/signin');
            return; // Prevent further execution
        }
    try {
        
        [user] = await sql`SELECT * FROM users WHERE email = ${session.user.email};`;
    }
    catch (error) {
        [user] = await sql`INSERT INTO users (email, username) VALUES (${session?.user?.email}, ${session?.user?.name}) RETURNING *;`;
    }

    let birds_known = await sql`SELECT * FROM sightings WHERE user_id = ${user.user_id} order by bird_id;`;
    // change each value of each item in birds_known that is string to ascii
    birds_known = birds_known.map((bird: any) => {
        Object.entries(bird).forEach(([key, value]) => {
            if (typeof value === "string") {
                bird[key] = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            }
        });
        return bird;
    });

    const birds_data_raw = await sql`SELECT * FROM birds order by bird_id;`;
    const birds_data = birds_data_raw.map((bird: any) => {
        return {
            id: bird.bird_id,
            name: bird.common_name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            scientificName: bird.scientific_name,
            family: bird.family,
        }
    });
    // console.log(birds_data);
    return (
        <div className='h-[100dvh] md:py-4 2xl:py-8 w-full'
            style={{
                backgroundImage: "linear-gradient(45deg,#0000 10%, #222 60%)",
            }}
        >

            <div className='md:w-[420px] h-full mx-auto md:rounded-3xl overflow-hidden md:p-2 md:bg-neutral-700 '>
                <UserProvider userD={user}>
                    <Main birds_default={birds_data} birds_seen={birds_known} user={session} />
                </UserProvider>
            </div>
        </div>
    )

}
