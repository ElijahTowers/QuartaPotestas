#!/usr/bin/env python3
"""
Check if newspaper_name field exists in users collection and show current values.
"""
import httpx
import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

async def main():
    print("=" * 60)
    print("Checking newspaper_name field in users collection")
    print("=" * 60 + "\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Authenticate as admin
        print("🔐 Authenticating...")
        auth_response = await client.post(
            f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
            json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        
        if auth_response.status_code != 200:
            print(f"❌ Auth failed: {auth_response.text}")
            return
        
        token = auth_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Authenticated\n")
        
        # Get users collection schema
        print("📋 Fetching users collection schema...")
        collection_response = await client.get(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
        )
        
        if collection_response.status_code != 200:
            print(f"❌ Failed to get collection: {collection_response.text}")
            return
        
        collection = collection_response.json()
        fields = collection.get("fields", [])
        
        # Check if newspaper_name field exists
        newspaper_name_field = None
        for field in fields:
            if field.get("name") == "newspaper_name":
                newspaper_name_field = field
                break
        
        if newspaper_name_field:
            print("✅ Field 'newspaper_name' EXISTS in users collection")
            print(f"   Type: {newspaper_name_field.get('type')}")
            print(f"   Required: {newspaper_name_field.get('required', False)}")
        else:
            print("❌ Field 'newspaper_name' NOT FOUND in users collection")
            print("\nAvailable fields:")
            for field in fields:
                print(f"   - {field.get('name')} ({field.get('type')})")
            return
        
        print("\n" + "=" * 60)
        print("📊 Checking user records for newspaper_name values")
        print("=" * 60 + "\n")
        
        # Get all users
        users_response = await client.get(
            f"{POCKETBASE_URL}/api/collections/users/records",
            params={"perPage": 100},
            headers=headers,
        )
        
        if users_response.status_code != 200:
            print(f"❌ Failed to get users: {users_response.text}")
            return
        
        users_data = users_response.json()
        users = users_data.get("items", [])
        
        print(f"Found {len(users)} user(s):\n")
        
        for user in users:
            email = user.get("email", "N/A")
            user_id = user.get("id", "N/A")
            newspaper_name = user.get("newspaper_name", None)
            
            if newspaper_name:
                print(f"✅ {email} (ID: {user_id[:8]}...)")
                print(f"   Newspaper Name: '{newspaper_name}'")
            else:
                print(f"⚠️  {email} (ID: {user_id[:8]}...)")
                print(f"   Newspaper Name: <not set> (will use default: 'THE DAILY DYSTOPIA')")
            print()

if __name__ == "__main__":
    asyncio.run(main())

