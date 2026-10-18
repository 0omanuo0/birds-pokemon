import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMPORARY: let the phone on the LAN load dev-server assets/HMR (Next blocks other origins in dev)
  allowedDevOrigins: ["10.1.1.105"],
  experimental: {
    // Dynamic pages weren't kept at all by the client router (default 0s), so every navigation, even back
    // to a page seen seconds ago, waited for the server and database. 30s of reuse makes bouncing between
    // home / bird / user instant; server actions that change data call revalidatePath, which clears it.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
