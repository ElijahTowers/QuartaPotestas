#!/usr/bin/env python3
"""
Test the newspaper name filter query to see if it works correctly.
"""

import os
import sys
import requests
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "admin")

async def test_filter():
    print("🧪 Testing newspaper name filter query...\n")
    
    # Authenticate as admin
    async with httpx.AsyncClient(base_url=POCKETBASE_URL, timeout=30.0) as client:
        auth_response = await client.post(
            "/api/collections/_superusers/auth-with-password",
            json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        
        if auth_response.status_code != 200:
            print(f"❌ Auth failed: {auth_response.status_code}")
            return
        
        token = auth_response.json()["token"]
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: Get all users to see what we have
        print("1️⃣ Fetching all users...")
        all_users_response = await client.get(
            "/api/collections/users/records?perPage=500",
            headers=headers,
        )
        all_users = all_users_response.json().get("items", [])
        print(f"   Found {len(all_users)} users\n")
        
        for user in all_users:
            print(f"   - {user.get('email')}: '{user.get('newspaper_name', 'N/A')}' (ID: {user.get('id')[:8]}...)")
        
        # Test 2: Try different filter syntaxes
        test_name = "ZUTPHEN"
        test_user_id = all_users[0].get("id") if all_users else None
        
        print(f"\n2️⃣ Testing filter for name '{test_name}' (excluding user {test_user_id[:8] if test_user_id else 'N/A'}...)\n")
        
        # Test different filter syntaxes
        filters = [
            f'newspaper_name = "{test_name}" && id != "{test_user_id}"',
            f"newspaper_name = '{test_name}' && id != '{test_user_id}'",
            f'newspaper_name="{test_name}" && id!="{test_user_id}"',
            f'newspaper_name ~ "{test_name}" && id != "{test_user_id}"',  # Case-insensitive
        ]
        
        from urllib.parse import quote
        
        for i, filter_query in enumerate(filters, 1):
            encoded_filter = quote(filter_query)
            print(f"   Test {i}: {filter_query}")
            print(f"   Encoded: {encoded_filter}")
            
            try:
                response = await client.get(
                    f"/api/collections/users/records?filter={encoded_filter}&perPage=10",
                    headers=headers,
                )
                
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("items", [])
                    print(f"   ✅ Status 200: Found {len(items)} user(s)")
                    for item in items:
                        print(f"      - {item.get('email')}: '{item.get('newspaper_name')}'")
                else:
                    print(f"   ❌ Status {response.status_code}: {response.text[:200]}")
            except Exception as e:
                print(f"   ❌ Error: {e}")
            
            print()

if __name__ == "__main__":
    asyncio.run(test_filter())

