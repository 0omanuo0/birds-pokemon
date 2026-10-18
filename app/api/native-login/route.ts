import { encode } from "next-auth/jwt";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Sign-in for the Android app. Google blocks its web sign-in page inside a WebView, so the app signs in
// natively (Credential Manager), gets a Google ID token and posts it here. The token is verified against
// Google's public keys and our web client id, then a normal next-auth session cookie is set: from there
// on the site can't tell this session from one made by the web sign-in.
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // next-auth's own default

export async function POST(req: Request) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!clientId || !secret) return new Response("Sign-in is not configured", { status: 500 });

    const body = await req.json().catch(() => null);
    const idToken = body?.idToken;
    if (typeof idToken !== "string") return new Response("Missing idToken", { status: 400 });

    let claims;
    try {
        // audience = the web client id: the app asks Google for a token for it (serverClientId)
        ({ payload: claims } = await jwtVerify(idToken, GOOGLE_KEYS, {
            issuer: ["https://accounts.google.com", "accounts.google.com"],
            audience: clientId,
        }));
    } catch (error) {
        console.error("Native login: invalid Google token:", error);
        return new Response("Invalid Google token", { status: 401 });
    }
    if (typeof claims.email !== "string" || claims.email_verified !== true) {
        return new Response("Google account has no verified email", { status: 401 });
    }

    const token = await encode({
        token: {
            sub: claims.sub,
            email: claims.email,
            name: typeof claims.name === "string" ? claims.name : undefined,
            picture: typeof claims.picture === "string" ? claims.picture : undefined,
        },
        secret,
        maxAge: SESSION_MAX_AGE,
    });

    // same cookie next-auth sets itself: __Secure- prefixed over https
    const secure = process.env.NODE_ENV === "production";
    const cookie = [
        `${secure ? "__Secure-" : ""}next-auth.session-token=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${SESSION_MAX_AGE}`,
        ...(secure ? ["Secure"] : []),
    ].join("; ");

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
    });
}
