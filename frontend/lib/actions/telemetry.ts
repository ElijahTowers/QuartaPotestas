"use server";

import { headers, cookies } from "next/headers";
import { UAParser } from "ua-parser-js";
import PocketBase from "pocketbase";

/**
 * Track a page visit with privacy-friendly analytics
 * Uses Cloudflare headers for location data (no external APIs)
 */
export async function trackVisit(path: string): Promise<void> {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();
    
    // Get PocketBase URL (server-side)
    const hostname = headersList.get("host") || "localhost";
    let pbUrl: string;
    if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
      pbUrl = "http://127.0.0.1:8090";
    } else if (hostname.includes("quartapotestas.com")) {
      pbUrl = "https://db.quartapotestas.com";
    } else {
      pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
    }
    
    // Extract Cloudflare headers
    const country = headersList.get("cf-ipcountry") || null;
    const city = headersList.get("cf-ipcity") || null;
    const userAgent = headersList.get("user-agent") || "";
    
    // Parse User Agent
    const parser = new UAParser(userAgent);
    const device = parser.getDevice();
    const browser = parser.getBrowser();
    
    // Determine device type
    let deviceType: string | null = null;
    if (device.type === "mobile" || device.type === "tablet") {
      deviceType = "Mobile";
    } else if (device.type === "desktop" || (!device.type && userAgent)) {
      deviceType = "Desktop";
    }
    
    // Get browser name
    const browserName = browser.name ? `${browser.name}${browser.version ? ` ${browser.version.split('.')[0]}` : ''}` : null;
    
    // Generate a simple visitor ID (session-based, not persistent)
    // In a real implementation, you might want to use a cookie or localStorage
    const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Get user ID if authenticated (from cookies)
    let userId: string | null = null;
    const pbAuthCookie = cookieStore.get("pb_auth");
    if (pbAuthCookie) {
      try {
        const authData = JSON.parse(pbAuthCookie.value);
        if (authData?.model?.id) {
          userId = authData.model.id;
        }
      } catch (e) {
        // Invalid cookie format, ignore
      }
    }
    
    // Create PocketBase instance for server-side
    const pb = new PocketBase(pbUrl);
    
    // Set auth token if available (optional - telemetry allows anonymous)
    if (pbAuthCookie) {
      try {
        const authData = JSON.parse(pbAuthCookie.value);
        if (authData?.token) {
          pb.authStore.save(authData.token, authData.model);
        }
      } catch (e) {
        // Invalid cookie, continue without auth (anonymous tracking is allowed)
      }
    }
    
    // Create telemetry record (works without auth due to empty createRule)
    const recordData = {
      visitor_id: visitorId,
      path: path,
      country: country,
      city: city,
      device_type: deviceType,
      browser: browserName,
      user_id: userId || null,
    };
    
    // Log in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("[Telemetry] Creating record:", recordData);
    }
    
    const record = await pb.collection("telemetry").create(recordData);
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Telemetry] Record created:", record.id);
    }
    
  } catch (error) {
    // Log error for debugging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.error("[Telemetry] Failed to track visit:", error);
      if (error instanceof Error) {
        console.error("[Telemetry] Error message:", error.message);
        console.error("[Telemetry] Error stack:", error.stack);
      }
    }
    // Silently fail in production - analytics should never break the app
  }
}

