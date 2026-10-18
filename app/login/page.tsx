"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { isNative } from "@/lib/platform";
import { GoogleSignIn } from "@/lib/nativeGoogle";

// Replaces next-auth's built-in sign-in page (pages.signIn in the nextauth route). In a browser it starts
// the normal Google web flow. In the Android app Google refuses that flow inside a WebView, so the app signs
// in natively and trades the Google ID token for a session at /api/native-login.
function LoginCard() {
    const params = useSearchParams();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in failed. Try again." : null);

    async function signInWithGoogle() {
        setBusy(true);
        setError(null);
        try {
            if (!isNative()) {
                await signIn("google", { callbackUrl: params.get("callbackUrl") ?? "/" });
                return; // the browser navigates away
            }
            const { idToken } = await GoogleSignIn.signIn();
            const response = await fetch("/api/native-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            });
            if (!response.ok) throw new Error(`login ${response.status}`);
            // full load, not router.push: the layout and pages read the session on the server
            window.location.replace("/");
        } catch (e) {
            // backing out of Google's chooser is not an error worth showing
            if (!(e instanceof Error && /cancel/i.test(e.message))) {
                console.error("Sign-in failed:", e);
                setError("Sign-in failed. Check your connection and try again.");
            }
            setBusy(false);
        }
    }

    return (
        <main className="flex h-[100dvh] flex-col items-center justify-center gap-6 bg-neutral-900 px-6 pb-[var(--app-bottom-bar)] pt-[env(safe-area-inset-top)] text-center text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-24 w-24 [image-rendering:pixelated]" />
            <h1 className="font-pokemon text-3xl text-neutral-200">Birds Pokédex</h1>
            <button
                onClick={signInWithGoogle}
                disabled={busy}
                style={{ clipPath: "polygon(8% 0, 92% 0, 100% 30%, 100% 100%, 0 100%, 0 30%)" }}
                className="font-pokemon w-64 cursor-pointer bg-red-500 px-4 py-3 text-xl tracking-wider text-white shadow-md transition-colors hover:bg-red-600 disabled:opacity-60"
            >
                {busy ? "Signing in…" : "Sign in with Google"}
            </button>
            {error && <p className="max-w-xs text-sm text-red-300">{error}</p>}
        </main>
    );
}

export default function LoginPage() {
    // useSearchParams needs a Suspense boundary in the app router
    return (
        <Suspense>
            <LoginCard />
        </Suspense>
    );
}
