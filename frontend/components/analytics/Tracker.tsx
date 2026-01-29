"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/lib/actions/telemetry";

/**
 * Privacy-friendly analytics tracker component
 * Tracks page views using Cloudflare headers (no external APIs)
 */
export default function TelemetryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Track all pathnames including root
    if (pathname) {
      // Call the server action to track the visit
      trackVisit(pathname).catch((error) => {
        // Log error for debugging
        console.error("[Telemetry] Failed to track:", error);
        if (error instanceof Error) {
          console.error("[Telemetry] Error details:", error.message);
        }
      });
    }
  }, [pathname]);

  // This component doesn't render anything
  return null;
}

