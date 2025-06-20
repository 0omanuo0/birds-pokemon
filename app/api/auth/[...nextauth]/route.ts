import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const authOptions = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // this profile callback still isn’t enough by itself
            profile(profile) {
                console.log("Google profile:", profile);
                return {...profile, id: profile.sub, name: profile.name, email: profile.email, image: profile.picture };
            },
        }),
    ],

    secret: process.env.NEXTAUTH_SECRET,
    debug: true

}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
