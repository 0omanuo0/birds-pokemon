import { getCurrentUser } from '@/lib/currentUser';
import { redirect } from 'next/navigation';
import TodayHome from '@/components/today/todayHome';



export default async function Home() {
    // shared with the root layout's lookup, so no extra query
    if (!(await getCurrentUser())) {
        redirect('/api/auth/signin');
    }

    // frame, backdrop and bezel come from DeviceShell in the root layout
    return <TodayHome />;
}
