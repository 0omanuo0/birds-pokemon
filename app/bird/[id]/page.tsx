

import BirdHome from "@/components/bird/home";
import { fetchBirdById, fetchBirdData, sightingsByUserId } from "@/lib/data";
import { Sighting } from "@/lib/types";
import { neon } from "@neondatabase/serverless";
import { getServerSession } from "next-auth";
import { redirect } from 'next/navigation';



export default async function BirdPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession();
    const { id } = await params;
    if (!session || !session.user || !session.user.email) {
        // Redirect to sign-in page if session or user email is not available
        redirect('/api/auth/signin');
        return; // Prevent further execution
    }
    const sql = neon(process.env.DATABASE_URL || "");
    const [user] = await sql`SELECT * FROM users WHERE email = ${session.user.email};`;
    const bird = await fetchBirdById(id);
    const sightings = await sightingsByUserId(user.user_id, id);

    return (

        <div className='h-[100dvh] md:py-4 2xl:py-8 w-full'
            style={{
                backgroundImage: "linear-gradient(45deg,#0000 10%, #222 60%)",
            }}
        >

            <div className='md:w-[420px] h-full mx-auto md:rounded-3xl overflow-hidden md:p-2 md:bg-neutral-700 '>
                <BirdHome bird={bird} sightings={sightings as Sighting[]} />
            </div>
        </div>

    );
}