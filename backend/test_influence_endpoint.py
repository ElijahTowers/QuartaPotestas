#!/usr/bin/env python3
"""
Test the /api/influence endpoint to see what it returns.
"""
import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
BACKEND_URL = "http://localhost:8000"

async def main():
    # First, authenticate as the user to get a token
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("🔐 Authenticating as user...")
        
        # Login to get JWT token
        login_response = await client.post(
            f"{BACKEND_URL}/api/auth/login",
            json={
                "email": "lowiehartjes@gmail.com",
                "password": "kwc*gyz7jur9YMH1cfd"
            }
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return
        
        token_data = login_response.json()
        token = token_data.get("access_token", "")
        
        if not token:
            print("❌ No token in response")
            return
        
        print(f"✅ Authenticated, token: {token[:20]}...\n")
        
        # Now call the influence endpoint
        print("📊 Calling /api/influence endpoint...")
        influence_response = await client.get(
            f"{BACKEND_URL}/api/influence",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )
        
        if influence_response.status_code != 200:
            print(f"❌ Influence endpoint failed: {influence_response.status_code}")
            print(f"Response: {influence_response.text}")
            return
        
        counts = influence_response.json()
        
        print("=" * 80)
        print("🌍 COUNTRY COUNTS FROM /api/influence ENDPOINT")
        print("=" * 80)
        
        if counts:
            sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
            for country_code, count in sorted_counts:
                print(f"{country_code}: {count} article(s)")
        else:
            print("No country codes found (empty response)")
        
        print("=" * 80)
        print(f"📊 TOTAL COUNTRIES: {len(counts)}")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())

