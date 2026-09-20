

import BirdHome from "@/components/bird/home";
import { fetchBirdById, sightingsByUserEmail } from "@/lib/data";
import { Sighting } from "@/lib/types";
import { getSessionOrDevBypass } from "@/lib/session";
import { redirect } from 'next/navigation';



export default async function BirdPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSessionOrDevBypass();
    const { id } = await params;
    if (!session || !session.user || !session.user.email) {
        // Redirect to sign-in page if session or user email is not available
        redirect('/api/auth/signin');
        return; // Prevent further execution
    }
    // bird and sightings in parallel, and sightings joins the user by email: one round of DB calls
    // instead of three sequential ones (user → bird → sightings)
    const [bird, sightings] = await Promise.all([
        fetchBirdById(id),
        sightingsByUserEmail(session.user.email, id),
    ]);

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