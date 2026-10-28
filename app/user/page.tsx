import Profile from "@/components/user/profile";
import { getSessionOrDevBypass } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { redirect } from "next/navigation";

// the pixel font has no accents; the dex strips them from names the same way
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function UserPage() {
    const session = await getSessionOrDevBypass();
    if (!session?.user?.email) {
        redirect("/api/auth/signin");
    }

    const profile = await getProfile(session.user.email);
    if (!profile) {
        redirect("/api/auth/signin");
    }

    const image = session.user.image
        ? `https://images.weserv.nl/?url=${encodeURIComponent(session.user.image)}`
        : null;

    // frame, backdrop and bezel come from DeviceShell in the root layout ("tall" screen size)
    return (
        <Profile
            {...profile}
            name={plain(session.user.name || profile.username || "Birder")}
            email={session.user.email}
            image={image}
        />
    );
}
