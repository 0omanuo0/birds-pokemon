import type { Metadata, Viewport } from "next";
import FullscreenOnTap from "@/components/fullscreenOnTap";
import DeviceShell from "@/components/device/deviceShell";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./roundedCorners.css";
import Providers from "@/components/providers";
import { getSessionOrDevBypass } from "@/lib/session";
import { getCurrentUser } from "@/lib/currentUser";

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
    // Signed out means no user here: it used to fall back to a hard-coded account and send that row (email included)
    // to every visitor. Pages that need a user redirect to sign-in themselves. Both lookups are shared with the page.
    const [session, current] = await Promise.all([getSessionOrDevBypass(), getCurrentUser()]);
    const user = current?.user ?? null;

    return (
        <html lang="en">
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
