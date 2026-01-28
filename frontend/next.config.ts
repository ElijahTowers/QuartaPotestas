import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No rewrites needed - we use the API proxy route (/api/proxy/[...path]) 
  // for client-side requests via Cloudflare tunnels
  // For server-side requests, we can use direct backend URLs
};

export default nextConfig;
