import type { Metadata } from "next";
import FullscreenOnTap from "@/components/fullscreenOnTap";
import DeviceShell from "@/components/device/deviceShell";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./roundedCorners.css";
import Providers from "@/components/providers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";

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
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    const sql = neon(process.env.DATABASE_URL || "");
    let user = null;
    let session: any | null = await getServerSession();
    if (!session || !session.user || !session.user.email) {
        // Redirect to sign-in page if session or user email is not available
        // redirect('/api/auth/signin');
        // return; // Prevent further execution
        session = { user: { email: "manu365manu@gmail.com", name: "Manu365" } };
    }
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
