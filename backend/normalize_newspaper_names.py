#!/usr/bin/env python3
"""
Normalize all newspaper_name values in the users collection to uppercase.
This ensures consistency and allows fast exact-match uniqueness checks.
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    print("❌ Error: POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in .env")
    sys.exit(1)

def main():
    print("🔐 Authenticating as admin...")
    
    # Authenticate as admin
    # PocketBase 0.36.1 uses _superusers collection for admin auth
    auth_response = requests.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    
    if auth_response.status_code != 200:
        print(f"❌ Authentication failed: {auth_response.status_code} - {auth_response.text}")
        sys.exit(1)
    
    auth_data = auth_response.json()
    token = auth_data.get("token")
    headers = {"Authorization": f"Bearer {token}"}
    
    print("✅ Authenticated successfully")
    print("\n📋 Fetching all users...")
    
    # Get all users
    all_users = []
    page = 1
    per_page = 500
    
    while True:
        response = requests.get(
            f"{POCKETBASE_URL}/api/collections/users/records",
            params={"page": page, "perPage": per_page},
            headers=headers,
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch users: {response.status_code} - {response.text}")
            sys.exit(1)
        
        data = response.json()
        items = data.get("items", [])
        all_users.extend(items)
        
        total_pages = data.get("totalPages", 1)
        print(f"  Page {page}/{total_pages}: {len(items)} users")
        
        if page >= total_pages:
            break
        page += 1
    
    print(f"\n✅ Fetched {len(all_users)} total users")
    print("\n🔄 Normalizing newspaper names...")
    
    updated_count = 0
    skipped_count = 0
    
    for user in all_users:
        user_id = user.get("id")
        newspaper_name = user.get("newspaper_name", "")
        
        if not newspaper_name:
            skipped_count += 1
            continue
        
        # Check if already uppercase
        normalized = newspaper_name.upper().strip()
        if newspaper_name == normalized:
            skipped_count += 1
            continue
        
        # Update to uppercase
        print(f"  Updating user {user_id}: '{newspaper_name}' -> '{normalized}'")
        
        update_response = requests.patch(
            f"{POCKETBASE_URL}/api/collections/users/records/{user_id}",
            json={"newspaper_name": normalized},
            headers=headers,
        )
        
        if update_response.status_code == 200:
            updated_count += 1
        else:
            print(f"    ⚠️  Failed to update: {update_response.status_code} - {update_response.text}")
    
    print(f"\n✅ Normalization complete!")
    print(f"   Updated: {updated_count} users")
    print(f"   Skipped: {skipped_count} users (empty or already uppercase)")

if __name__ == "__main__":
    main()

