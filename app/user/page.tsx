import ButtonLogout from "@/components/buttonLogout";
import { homeSvg } from "@/components/imageSvg";
import LateralLeft from "@/components/nav/lateralLeft";
import Noise from "@/components/turbulenceNoise";
import { neon } from "@neondatabase/serverless";
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
    const sql = neon(process.env.DATABASE_URL || "");
    const [user] = await sql`SELECT * FROM users WHERE email = ${session.user.email};`;
    const [{ count: sightings }] = await sql`
        SELECT COUNT(DISTINCT bird_id) 
        FROM sightings 
        WHERE user_id = ${user.user_id};
    `;
    const [{ count: images }] = await sql`
        SELECT COUNT(*) 
        FROM sightings 
        WHERE user_id = ${user.user_id};
    `;
    const [{ count: birds }] = await sql`SELECT COUNT(*) FROM birds;`;

    const safeImage = `https://images.weserv.nl/?url=${encodeURIComponent(session.user.image || "")}`;



    return (

        <div className='h-[100dvh] md:py-4 2xl:py-8 w-full'
            style={{
                backgroundImage: "linear-gradient(45deg,#0000 10%, #222 60%)",
            }}
        >
            <div className='md:w-[420px] h-full mx-auto md:rounded-3xl overflow-hidden md:p-2 md:bg-neutral-700 '>
                <main
                    className="flex relative h-full flex-col items-center justify-between bg-neutral-500 overflow-hidden md:rounded-2xl"
                >
                    <LateralLeft target='/' label="Home">{homeSvg}</LateralLeft>
                    <section
                        className="relative md:h-[450px] md:min-h-auto w-full min-h-[550px]">
                        <div className="h-full w-full flex flex-col justify-center items-center bg-neutral-900 px-3 pb-3">
                            <Noise />
                            <nav className="flex flex-row justify-between items-center w-full my-2 h-8">
                                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                                <span className="text-neutral-300 text-sm font-medium font-pokemon">Birds Pokedex</span>

                            </nav>
                            <div
                                className="w-full h-full bg-neutral-700 pixel-corners-4 relative overflow-hidden noise-effect shining p-6"
                            >
                                <div className="flex items-start w-full gap-6">
                                    <div className="pixel-corners-6-border--wrapper"
                                        style={{
                                            "--border-color": "#f90",
                                        } as React.CSSProperties}>

                                        <img src={safeImage || ""} alt="User Image" className="object-cover w-20 h-20 pixel-corners-6-border" />
                                    </div>
                                    <div>
                                        <h2 className="text-neutral-300 text-2xl font-medium font-pokemon">Name: {session.user.name}</h2>
                                        <span className="text-neutral-300 text-sm font-medium font-mono block">Email: {session.user.email}</span>
                                        <span className="text-neutral-300 text-sm font-medium font-mono block">Sightings: {sightings}/{birds}</span>
                                        <span className="text-neutral-300 text-sm font-medium font-mono block">Images: {images}</span>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full flex justify-center">
                                    <ButtonLogout />
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div >

    );
}