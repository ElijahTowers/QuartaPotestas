#!/usr/bin/env python3
"""
Check for duplicate usernames in the users collection.
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
    print("🔍 Checking for duplicate usernames...")
    print(f"PocketBase URL: {POCKETBASE_URL}\n")
    
    # Authenticate as admin
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
    
    # Group by username (case-insensitive, trimmed)
    username_groups = {}
    for user in users:
        username = user.get("username", "").strip()
        if not username:
            continue
        
        # Normalize to lowercase for comparison
        username_lower = username.lower()
        
        if username_lower not in username_groups:
            username_groups[username_lower] = []
        
        username_groups[username_lower].append({
            "id": user.get("id"),
            "email": user.get("email"),
            "username": user.get("username", ""),
        })
    
    # Find duplicates
    duplicates = {name: users for name, users in username_groups.items() if len(users) > 1}
    
    if duplicates:
        print(f"⚠️  Found {len(duplicates)} duplicate usernames:\n")
        for name, users in duplicates.items():
            print(f"  👤 '{name}' ({len(users)} users):")
            for user in users:
                print(f"     - {user['email']} (ID: {user['id'][:8]}..., Username: '{user['username']}')")
            print()
    else:
        print("✅ No duplicates found! All usernames are unique.\n")
    
    # Show all usernames for reference
    print(f"📋 All usernames ({len(username_groups)} unique usernames):")
    for name in sorted(username_groups.keys()):
        count = len(username_groups[name])
        print(f"  - '{name}' ({count} user{'s' if count > 1 else ''})")
    
    # Show users without username
    users_without_username = [u for u in users if not u.get("username", "").strip()]
    if users_without_username:
        print(f"\n⚠️  {len(users_without_username)} user(s) without username:")
        for user in users_without_username:
            print(f"  - {user.get('email')} (ID: {user.get('id', 'N/A')[:8]}...)")

if __name__ == "__main__":
    main()

