import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
        const session = await getServerSession();
        console.log("Session data:", session);
        if (!session || !session.user || !session.user.email) {
                // Redirect to sign-in page if session or user email is not available
                redirect('/api/auth/signin');
                return; // Prevent further execution
            }
        try {
            
            [user] = await sql`SELECT * FROM users WHERE email = ${session.user.email};`;
        }
        catch (error) {
            [user] = await sql`INSERT INTO users (email, username) VALUES (${session?.user?.email}, ${session?.user?.name}) RETURNING *;`;
        }


    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <Providers session={session} user={user}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
