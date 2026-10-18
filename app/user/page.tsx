import ButtonLogout from "@/components/buttonLogout";
import { homeSvg } from "@/components/imageSvg";
import LateralLeft from "@/components/nav/lateralLeft";
import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import { neon } from "@neondatabase/serverless";
import { defaultUserEmail, getSessionOrDevBypass } from "@/lib/session";
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



    // frame, backdrop and bezel come from DeviceShell in the root layout ("full" screen size)
    return (
        <>
            <DeviceScreen className="p-6">
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
                                    {/* signing out is meaningless with the default account: it would sign straight back in */}
                                    {!(await defaultUserEmail()) && <ButtonLogout />}
                                </div>
            </DeviceScreen>
            <DeviceControls>
                <LateralLeft target='/' label="Home">{homeSvg}</LateralLeft>
            </DeviceControls>
        </>
    );
}