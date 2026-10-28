import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMPORARY: let the phone on the LAN load dev-server assets/HMR (Next blocks other origins in dev)
  // 10.1.1.105 = LAN, 172.22.210.142 = ZeroTier; an origin missing here loads the HTML but never hydrates (page looks frozen)
  allowedDevOrigins: ["10.1.1.105", "172.22.210.142", "127.0.0.1"],
};

export default nextConfig;
