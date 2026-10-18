import { getServerSession, Session } from "next-auth";
import { headers } from "next/headers";

// The Android app appends this to its WebView user agent (capacitor.config.ts, appendUserAgent).
export const APP_USER_AGENT_MARKER = "BirdsDexApp";

// Account used when nobody is signed in. The Android app has no login screen yet: it loads the site
// and everything acts as this user. Off unless DEFAULT_USER_EMAIL is set, and only for requests that
// carry the app's user agent marker, so browser visitors of the same deployment still need Google
// sign-in. The marker is spoofable: this keeps strangers from landing in the account by accident, it
// is not real authentication. Everything server-side goes through getSessionOrDevBypass, so this is
// the only place that decides who "the user" is.
export async function defaultUserEmail(): Promise<string | null> {
    const email = process.env.DEFAULT_USER_EMAIL;
    if (!email) return null;
    const userAgent = (await headers()).get("user-agent") ?? "";
    return userAgent.includes(APP_USER_AGENT_MARKER) ? email : null;
}

export async function getSessionOrDevBypass(): Promise<Session | null> {
    const session = await getServerSession();
    if (session?.user?.email) return session;

    const defaultEmail = await defaultUserEmail();
    if (defaultEmail) {
        return { user: { email: defaultEmail, name: "Birder" }, expires: "" };
    }

    // TEMPORARY testing bypass — remove when done.
    // Lets a device that can't finish Google sign-in (e.g. a phone opening the dev server by LAN IP)
    // act as the user in DEV_BYPASS_EMAIL. Never active in production builds, and off unless the env var is set.
    const email = process.env.DEV_BYPASS_EMAIL;
    if (process.env.NODE_ENV !== "production" && email) {
        return { user: { email, name: "Dev bypass" }, expires: "" };
    }
    return session;
}
