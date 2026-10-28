import { UserProvider } from '@/components/userContext';
import { neon } from '@neondatabase/serverless';
import { getSessionOrDevBypass } from '@/lib/session';
import { redirect } from 'next/navigation';
import TodayHome from '@/components/today/todayHome';



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



    // frame, backdrop and bezel come from DeviceShell in the root layout
    return (
        <UserProvider userD={user}>
            <TodayHome />
        </UserProvider>
    );
}
