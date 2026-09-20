import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMPORARY: let the phone on the LAN load dev-server assets/HMR (Next blocks other origins in dev)
  allowedDevOrigins: ["10.1.1.105"],
};

export default nextConfig;
