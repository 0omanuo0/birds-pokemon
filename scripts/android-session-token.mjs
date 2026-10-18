// Mints a next-auth session cookie value for the default account and stores it in
// android/local.properties (gitignored), where android/app/build.gradle picks it up and MainActivity
// sets it as a cookie when the app starts. This is what lets the debug APK skip Google sign-in, which
// Google blocks inside a WebView, against a deployment that has no server-side changes.
//
// usage: node --env-file=.env.local scripts/android-session-token.mjs [email] [days]
//   NEXTAUTH_SECRET must be the same value the deployed site uses, or the cookie is rejected.
// The token is a credential for that account and ends up inside the APK: don't share the APK.
import { encode } from "next-auth/jwt";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const email = process.argv[2] ?? process.env.DEFAULT_USER_EMAIL;
const days = Number(process.argv[3] ?? 90);
const secret = process.env.NEXTAUTH_SECRET;
if (!email || !secret) {
    console.error("Need NEXTAUTH_SECRET (run with --env-file=.env.local) and an email (argument or DEFAULT_USER_EMAIL).");
    process.exit(1);
}

const token = await encode({
    token: { email, name: "Birder", sub: email },
    secret,
    maxAge: days * 24 * 60 * 60,
});

const file = "android/local.properties";
const key = "birdsdex.sessionToken";
const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(l => l && !l.startsWith(key + "=")) : [];
lines.push(`${key}=${token}`);
writeFileSync(file, lines.join("\n") + "\n");
console.log(`Session token for ${email} written to ${file} (valid ${days} days).`);
