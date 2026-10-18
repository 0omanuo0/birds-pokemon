import type { Metadata, Viewport } from "next";
import FullscreenOnTap from "@/components/fullscreenOnTap";
import DeviceShell from "@/components/device/deviceShell";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./roundedCorners.css";
import Providers from "@/components/providers";
import { APP_USER_AGENT_MARKER, getSessionOrDevBypass } from "@/lib/session";
import { neon } from "@neondatabase/serverless";
import { headers } from "next/headers";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Birds-Pokedex",
    description: "by manu365",
    // iPhone "Add to Home Screen": open without Safari's UI, content under a dark status bar
    appleWebApp: {
        capable: true,
        title: "Birds Dex",
        statusBarStyle: "black-translucent",
    },
    icons: {
        apple: "/icons/apple-touch-icon.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#171717",
    // lets the app draw edge to edge on notched phones in fullscreen / installed mode
    viewportFit: "cover",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    const sql = neon(process.env.DATABASE_URL || "");
    let user = null;
    // a real Google session, else the default account (DEFAULT_USER_EMAIL), else nobody: the pages
    // redirect to sign-in themselves, so the layout just renders without a user
    let session: any | null = await getSessionOrDevBypass();
    if (session?.user?.email) {
        try {

            [user] = await sql`SELECT * FROM users WHERE email = ${session.user.email};`;
            if( !user || !user.user_id) {
                throw new Error("User not found");
            }
        }
        catch (error) {
            [user] = await sql`INSERT INTO users (email, username) VALUES (${session?.user?.email}, ${session?.user?.name}) RETURNING *;`;
        }

        session.user = {
            ...session.user,
            id: user.user_id,
            name: user.username || session.user.name,
            image: user.image || session.user.image,
        };
    } else {
        session = null;
    }


    // true inside the Android app's WebView (capacitor.config.ts appends the marker to its user agent).
    // Set on <html> so CSS can adapt without waiting for hydration: bottom bar, cheaper grain, see globals.css
    const isApp = ((await headers()).get("user-agent") ?? "").includes(APP_USER_AGENT_MARKER);

    return (
        <html lang="en" data-app={isApp ? "" : undefined}>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased text-white`}
            >
                <FullscreenOnTap />
                <Providers session={session} user={user}>
                    <DeviceShell>{children}</DeviceShell>
                </Providers>
            </body>
        </html>
    );
}
