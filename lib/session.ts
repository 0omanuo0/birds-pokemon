import { getServerSession, Session } from "next-auth";

// TEMPORARY testing bypass — remove when done.
// Lets a device that can't finish Google sign-in (e.g. a phone opening the dev server by LAN IP)
// act as the user in DEV_BYPASS_EMAIL. Never active in production builds, and off unless the env var is set.
export async function getSessionOrDevBypass(): Promise<Session | null> {
    const session = await getServerSession();
    if (session?.user?.email) return session;

    const email = process.env.DEV_BYPASS_EMAIL;
    if (process.env.NODE_ENV !== "production" && email) {
        return { user: { email, name: "Dev bypass" }, expires: "" };
    }
    return session;
}
