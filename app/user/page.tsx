import Profile from "@/components/user/profile";
import { defaultUserEmail, getSessionOrDevBypass } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { redirect } from "next/navigation";
import { stripAccents } from "@/lib/text";

// the pixel font has no accents; the dex strips them from names the same way
const plain = stripAccents;

export default async function UserPage() {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) {
        redirect("/api/auth/signin");
    }

    const profile = await getProfile(session.user.email);
    if (!profile) {
        redirect("/api/auth/signin");
    }

    // straight from Google (the profile sends no referrer): the weserv.nl proxy it used to go through was one more
    // thing that could be down or rate-limited
    const image = session.user.image ?? null;

    // frame, backdrop and bezel come from DeviceShell in the root layout ("tall" screen size)
    return (
        <Profile
            {...profile}
            name={plain(session.user.name || profile.username || "Birder")}
            email={session.user.email}
            canLogout={!(await defaultUserEmail())}
            image={image}
        />
    );
}
