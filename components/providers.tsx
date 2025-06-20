"use client";

import { SessionProvider } from "next-auth/react";
import { UserProvider } from "./userContext";

export default function Providers({ children, session, user }: Readonly<{
    children: React.ReactNode;
    session: any;
    user?: any | null;
}>) {
    return (
        <SessionProvider session={session}>
            <UserProvider userD={user}>
                {children}
            </UserProvider>
        </SessionProvider>
    )
}