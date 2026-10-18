import { registerPlugin } from "@capacitor/core";

// Native side: android/.../GoogleSignInPlugin.java. Only exists inside the Android app; in a browser
// every call rejects, so callers check isNative() (lib/platform.ts) first.
export interface GoogleSignInPlugin {
    // Opens Google's account chooser. Rejects with message "canceled" if the user backs out.
    signIn(): Promise<{ idToken: string }>;
}

export const GoogleSignIn = registerPlugin<GoogleSignInPlugin>("GoogleSignIn");
