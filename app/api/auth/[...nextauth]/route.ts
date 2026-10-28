import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const authOptions = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // this profile callback still isn’t enough by itself
            profile(profile) {
                return {...profile, id: profile.sub, name: profile.name, email: profile.email, image: profile.picture };
            },
        }),
    ],

    // next-auth's built-in sign-in page can't be used in the Android app (Google blocks it in a WebView),
    // so every /api/auth/signin redirect lands on our own page, which also handles the native sign-in
    pages: { signIn: "/login" },

    secret: process.env.NEXTAUTH_SECRET

};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
