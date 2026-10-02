

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

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return <BirdHome bird={bird} sightings={sightings as Sighting[]} />;
}