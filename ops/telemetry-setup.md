# Telemetry Analytics Setup

This document describes the privacy-friendly analytics system for Quarta Potestas.

## Overview

The telemetry system tracks page visits using:
- **Cloudflare headers** for location data (no external APIs)
- **User-Agent parsing** for device and browser info
- **PocketBase** for storage (self-hosted, privacy-friendly)

## Setup Instructions

### 1. Create the Telemetry Collection

Run the setup script to create the `telemetry` collection in PocketBase:

```bash
cd backend
python3 add_telemetry_collection.py
```

Or manually create the collection in PocketBase Admin UI:

**Collection Name:** `telemetry`

**Fields:**
- `visitor_id` (text, required) - Simple session-based ID
- `path` (text, required) - Page path (e.g., `/dashboard`)
- `country` (text, optional) - Country code from `CF-IPCountry` header
- `city` (text, optional) - City from `CF-IPCity` header
- `device_type` (text, optional) - "Mobile" or "Desktop"
- `browser` (text, optional) - Browser name and version
- `user_id` (relation to `users`, optional) - Only set if user is logged in
- `created` (date, auto) - Timestamp

**API Rules:**
- `listRule`: `@request.auth.id != ""` (authenticated users only)
- `viewRule`: `@request.auth.id != ""`
- `createRule`: `@request.auth.id != "" || @request.auth.type = "admin"` (allow anonymous tracking)
- `updateRule`: `@request.auth.id != "" || @request.auth.type = "admin"`
- `deleteRule`: `@request.auth.type = "admin"` (admin only)

### 2. Verify Installation

The telemetry system is automatically active once:
- ✅ The `telemetry` collection exists in PocketBase
- ✅ The `TelemetryTracker` component is in `layout.tsx` (already done)
- ✅ `ua-parser-js` is installed (already done)

### 3. Test the System

1. Visit any page on your site
2. Check PocketBase Admin UI → `telemetry` collection
3. You should see a new record with:
   - Path: `/hub`, `/editor`, etc.
   - Country: `NL` (or your country code)
   - City: Your city (if available)
   - Device Type: `Mobile` or `Desktop`
   - Browser: `Chrome 120`, `Safari 17`, etc.

## How It Works

1. **Client-Side (`Tracker.tsx`):**
   - Monitors pathname changes using `usePathname()`
   - Calls `trackVisit(pathname)` server action on each page view

2. **Server-Side (`telemetry.ts`):**
   - Reads Cloudflare headers:
     - `CF-IPCountry` → Country code
     - `CF-IPCity` → City name
     - `User-Agent` → Device and browser info
   - Parses User-Agent with `ua-parser-js`
   - Saves to PocketBase `telemetry` collection

3. **Privacy Features:**
   - ✅ No IP addresses stored (only country/city from Cloudflare)
   - ✅ No external APIs (uses Cloudflare headers)
   - ✅ Self-hosted (PocketBase on your server)
   - ✅ Anonymous by default (user_id only if logged in)
   - ✅ Session-based visitor IDs (not persistent)

## Viewing Analytics

### In PocketBase Admin UI:

1. Go to: `http://localhost:8090/_/` (or `https://db.quartapotestas.com/_/`)
2. Navigate to: **Collections** → **telemetry**
3. View records with filters:
   - Filter by `country` to see geographic distribution
   - Filter by `path` to see popular pages
   - Filter by `device_type` to see mobile vs desktop
   - Filter by `user_id` to see logged-in user activity

### Example Query:

```
country = "NL" AND device_type = "Mobile"
```

Shows: "A user from Netherlands (NL) visited /news on a Mobile Device using Chrome."

## Troubleshooting

### No records appearing?

1. Check that PocketBase is running
2. Verify the `telemetry` collection exists
3. Check browser console for errors
4. Verify Cloudflare headers are present (only works via Cloudflare Tunnel)

### Missing location data?

- Cloudflare headers (`CF-IPCountry`, `CF-IPCity`) are only available when:
  - Traffic goes through Cloudflare (via tunnel)
  - Not available on `localhost` (will be `null`)

### Missing user_id?

- `user_id` is only set if the user is logged in
- Anonymous visits will have `user_id = null`

## Privacy & GDPR

This system is designed to be privacy-friendly:
- ✅ No IP addresses stored
- ✅ No persistent tracking cookies
- ✅ Self-hosted (data stays on your server)
- ✅ User can be identified only if logged in
- ✅ All data can be deleted from PocketBase

For GDPR compliance, consider:
- Adding a privacy policy
- Allowing users to opt-out
- Providing data export/deletion features

