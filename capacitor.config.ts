import type { CapacitorConfig } from "@capacitor/cli";

// Online mode: the WebView loads the deployed site, so /api/* and server actions stay same-origin.
// cap-www/ is only the page shown when that site can't be reached; it's also where the bundled
// (offline) app will go once the pages stop depending on the server.
// Keep the marker in sync with APP_USER_AGENT_MARKER in lib/session.ts.
const config: CapacitorConfig = {
    appId: "com.manu365.birdsdex",
    appName: "Birds Dex",
    webDir: "cap-www",
    server: {
        url: process.env.CAP_SERVER_URL ?? "https://birds-pokemon.vercel.app",
        // an unreachable server shows cap-www/index.html instead of Android's raw error page
        errorPath: "index.html",
    },
    android: {
        appendUserAgent: "BirdsDexApp",
        backgroundColor: "#171717",
    },
};

export default config;
