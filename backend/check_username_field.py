#!/usr/bin/env python3
"""
Check if username field exists in users collection
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

def main():
    print("🔍 Checking username field in users collection...")
    
    # Authenticate as admin
    print("\n1. Authenticating as admin...")
    auth_response = requests.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={
            "identity": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        }
    )
    
    if auth_response.status_code != 200:
        print(f"❌ Authentication failed: {auth_response.status_code}")
        print(f"   Response: {auth_response.text}")
        return
    
    auth_data = auth_response.json()
    admin_token = auth_data.get("token")
    
    if not admin_token:
        print("❌ No token received from authentication")
        return
    
    print("✅ Admin authenticated")
    
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }
    
    # Get users collection schema
    print("\n2. Fetching users collection schema...")
    collection_response = requests.get(
        f"{POCKETBASE_URL}/api/collections/users",
        headers=headers,
    )
    
    if collection_response.status_code != 200:
        print(f"❌ Failed to fetch collection: {collection_response.status_code}")
        print(f"   Response: {collection_response.text}")
        return
    
    collection_data = collection_response.json()
    # Auth collections use "fields" instead of "schema"
    fields = collection_data.get("fields", [])
    
    print(f"\n📋 Collection has {len(fields)} fields:")
    for field in fields:
        print(f"   - {field.get('name')} ({field.get('type')})")
    
    # Check if username field exists
    username_field = next((f for f in fields if f.get("name") == "username"), None)
    
    if username_field:
        print("\n✅ Username field exists!")
        print(f"   Type: {username_field.get('type')}")
        print(f"   Required: {username_field.get('required', False)}")
        print(f"   Presentable: {username_field.get('presentable', False)}")
    else:
        print("\n❌ Username field NOT found in schema!")
        print("   You may need to refresh the PocketBase admin UI or run add_username_field.py again")

if __name__ == "__main__":
    main()

