#!/usr/bin/env python3
"""
Check for duplicate newspaper names in the users collection.
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "admin")

def main():
    print("🔍 Checking for duplicate newspaper names...")
    print(f"PocketBase URL: {POCKETBASE_URL}\n")
    
    # Authenticate as admin
    # PocketBase 0.36.1 uses _superusers collection for admin auth
    auth_url = f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password"
    auth_data = {
        "identity": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        auth_response = requests.post(auth_url, json=auth_data)
        auth_response.raise_for_status()
        auth_token = auth_response.json()["token"]
        print("✅ Authenticated as admin\n")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    
    # Fetch all users
    users_url = f"{POCKETBASE_URL}/api/collections/users/records?perPage=500"
    
    try:
        response = requests.get(users_url, headers=headers)
        response.raise_for_status()
        data = response.json()
        users = data.get("items", [])
        print(f"📊 Found {len(users)} users\n")
    except Exception as e:
        print(f"❌ Failed to fetch users: {e}")
        return
    
    # Group by newspaper_name (case-insensitive, trimmed)
    name_groups = {}
    for user in users:
        newspaper_name = user.get("newspaper_name", "").strip().upper()
        if not newspaper_name:
            continue
        
        if newspaper_name not in name_groups:
            name_groups[newspaper_name] = []
        
        name_groups[newspaper_name].append({
            "id": user.get("id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "newspaper_name": user.get("newspaper_name", ""),
        })
    
    # Find duplicates
    duplicates = {name: users for name, users in name_groups.items() if len(users) > 1}
    
    if duplicates:
        print(f"⚠️  Found {len(duplicates)} duplicate newspaper names:\n")
        for name, users in duplicates.items():
            print(f"  📰 '{name}' ({len(users)} users):")
            for user in users:
                print(f"     - {user['email']} (ID: {user['id'][:8]}..., Username: {user.get('username', 'N/A')})")
                print(f"       Raw value: '{user['newspaper_name']}'")
            print()
    else:
        print("✅ No duplicates found! All newspaper names are unique.\n")
    
    # Show all newspaper names for reference
    print(f"📋 All newspaper names ({len(name_groups)} unique names):")
    for name in sorted(name_groups.keys()):
        count = len(name_groups[name])
        print(f"  - '{name}' ({count} user{'s' if count > 1 else ''})")
    
    # Show users without newspaper_name
    users_without_name = [u for u in users if not u.get("newspaper_name", "").strip()]
    if users_without_name:
        print(f"\n⚠️  {len(users_without_name)} user(s) without newspaper_name:")
        for user in users_without_name:
            print(f"  - {user.get('email')} (ID: {user.get('id', 'N/A')[:8]}...)")

if __name__ == "__main__":
    main()

