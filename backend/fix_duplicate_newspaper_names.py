#!/usr/bin/env python3
"""
Fix duplicate newspaper names by appending a number to duplicates.
"""

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "admin")

def main():
    print("🔧 Fixing duplicate newspaper names...")
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
    
    # Group by newspaper_name (case-insensitive, trimmed)
    name_groups = {}
    for user in users:
        newspaper_name = user.get("newspaper_name", "").strip().upper()
        if not newspaper_name:
            continue
        
        if newspaper_name not in name_groups:
            name_groups[newspaper_name] = []
        
        name_groups[newspaper_name].append(user)
    
    # Find duplicates
    duplicates = {name: users for name, users in name_groups.items() if len(users) > 1}
    
    if not duplicates:
        print("✅ No duplicates found! All newspaper names are unique.\n")
        return
    
    print(f"⚠️  Found {len(duplicates)} duplicate newspaper names:\n")
    
    # Fix duplicates by keeping the first one and appending numbers to others
    fixed_count = 0
    for name, users in duplicates.items():
        print(f"📰 Fixing '{name}' ({len(users)} users):")
        
        # Keep the first user's name as-is (oldest user by ID or creation date)
        # Sort by ID to ensure consistent ordering
        users_sorted = sorted(users, key=lambda u: u.get("id", ""))
        keep_user = users_sorted[0]
        other_users = users_sorted[1:]
        
        print(f"   ✓ Keeping '{name}' for {keep_user.get('email')} (ID: {keep_user.get('id')[:8]}...)")
        
        # Update other users with numbered names
        for idx, user in enumerate(other_users, start=1):
            new_name = f"{name} {idx + 1}"
            user_id = user.get("id")
            user_email = user.get("email")
            
            try:
                update_response = requests.patch(
                    f"{POCKETBASE_URL}/api/collections/users/records/{user_id}",
                    json={"newspaper_name": new_name},
                    headers=headers,
                )
                update_response.raise_for_status()
                print(f"   ✓ Renamed {user_email} to '{new_name}'")
                fixed_count += 1
            except Exception as e:
                print(f"   ❌ Failed to rename {user_email}: {e}")
        
        print()
    
    print(f"✅ Fixed {fixed_count} duplicate newspaper name(s)!\n")
    
    # Verify no duplicates remain
    print("🔍 Verifying fix...")
    response = requests.get(users_url, headers=headers)
    response.raise_for_status()
    users_after = response.json().get("items", [])
    
    name_groups_after = {}
    for user in users_after:
        newspaper_name = user.get("newspaper_name", "").strip().upper()
        if not newspaper_name:
            continue
        if newspaper_name not in name_groups_after:
            name_groups_after[newspaper_name] = []
        name_groups_after[newspaper_name].append(user)
    
    duplicates_after = {name: users for name, users in name_groups_after.items() if len(users) > 1}
    
    if duplicates_after:
        print(f"⚠️  Still found {len(duplicates_after)} duplicate(s) after fix:")
        for name, users in duplicates_after.items():
            print(f"   - '{name}': {len(users)} users")
    else:
        print("✅ No duplicates remaining! All newspaper names are now unique.")

if __name__ == "__main__":
    main()

