/**
 * PocketBase client instance
 * Connects to PocketBase running on http://127.0.0.1:8090
 */

import PocketBase from 'pocketbase';

// Dynamically determine PocketBase URL based on where the frontend is accessed from
function getPocketBaseUrl(): string {
  // If running in browser, prefer hostname-based logic first
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // If accessing via localhost or 127.0.0.1, ALWAYS use local PocketBase,
    // even if NEXT_PUBLIC_POCKETBASE_URL is set (avoids stale tunnel URLs).
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://127.0.0.1:8090";
    }

    // If accessing via Cloudflare tunnel, use PocketBase tunnel URL from env
    if (hostname.includes("trycloudflare.com")) {
      const pbTunnelUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;
      if (pbTunnelUrl) {
        return pbTunnelUrl;
      }
      console.error(
        "PocketBase tunnel URL not configured! " +
        "Please set NEXT_PUBLIC_POCKETBASE_URL in .env.local " +
        "to the PocketBase Cloudflare tunnel URL (from 'npm run broadcast:pb')"
      );
      // Fallback to localhost (might not work remotely, but prevents crash)
      return "http://127.0.0.1:8090";
    }

    // For other hosts, allow explicit override via env, otherwise use same hostname
    if (process.env.NEXT_PUBLIC_POCKETBASE_URL) {
      return process.env.NEXT_PUBLIC_POCKETBASE_URL;
    }
    return `http://${hostname}:8090`;
  }

  // Server-side rendering: fall back to env or local PocketBase
  if (process.env.NEXT_PUBLIC_POCKETBASE_URL) {
    return process.env.NEXT_PUBLIC_POCKETBASE_URL;
  }
  return "http://127.0.0.1:8090";
}

// Create a singleton instance
let pbInstance: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (typeof window === "undefined") {
    // Server-side: return a new instance (will be recreated on each request)
    return new PocketBase(getPocketBaseUrl());
  }
  
  // Client-side: use singleton
  if (!pbInstance) {
    pbInstance = new PocketBase(getPocketBaseUrl());
  }
  
  return pbInstance;
}

// Export the singleton instance for direct use
export const pb = getPocketBase();

