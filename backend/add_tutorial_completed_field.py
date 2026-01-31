#!/usr/bin/env python3
"""
Add tutorial_completed field to users collection in PocketBase
"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

# PocketBase connection details
POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")


def main():
    """Add tutorial_completed boolean field to users collection"""
    print("🔧 Adding tutorial_completed field to users collection...")
    
    # Step 1: Authenticate as admin
    print("\n1. Authenticating as admin...")
    auth_response = requests.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    
    if auth_response.status_code != 200:
        print(f"❌ Authentication failed: {auth_response.status_code}")
        print(f"   Response: {auth_response.text}")
        sys.exit(1)
    
    auth_data = auth_response.json()
    admin_token = auth_data.get("token")
    
    if not admin_token:
        print("❌ No token received from authentication")
        sys.exit(1)
    
    print("✅ Admin authenticated")
    
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }
    
    # Step 2: Get current users collection schema
    print("\n2. Fetching users collection schema...")
    collection_response = requests.get(
        f"{POCKETBASE_URL}/api/collections/users",
        headers=headers,
    )
    
    if collection_response.status_code != 200:
        print(f"❌ Failed to fetch collection: {collection_response.status_code}")
        print(f"   Response: {collection_response.text}")
        sys.exit(1)
    
    collection_data = collection_response.json()
    print("✅ Collection fetched")
    
    # Auth collections use "fields" instead of "schema"
    fields = collection_data.get("fields", [])
    print(f"   Current fields: {len(fields)}")
    
    # Step 3: Check if field already exists
    tutorial_field_exists = any(field.get("name") == "tutorial_completed" for field in fields)
    
    if tutorial_field_exists:
        print("\n⚠️  Field 'tutorial_completed' already exists. Skipping field creation.")
    else:
        # Step 4: Add tutorial_completed field
        print("\n3. Adding tutorial_completed field...")
        new_field = {
            "system": False,
            "id": "tutorial_completed_field",
            "name": "tutorial_completed",
            "type": "bool",
            "required": False,
            "presentable": True,
            "indexable": True,
            "searchable": False,
            "options": {},
        }
        
        # Ensure fields is a list
        if not isinstance(fields, list):
            fields = []
        
        fields.append(new_field)
        
        # Update collection - use "fields" for auth collections
        update_payload = {
            "fields": fields,
        }
        
        print(f"   Updating with {len(fields)} fields total...")
        update_response = requests.patch(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
            json=update_payload,
        )
        
        if update_response.status_code != 200:
            print(f"❌ Failed to update collection: {update_response.status_code}")
            print(f"   Response: {update_response.text}")
            sys.exit(1)
        
        print("✅ Field 'tutorial_completed' added successfully!")
    
    # Step 5: Set default value for existing users
    print("\n4. Setting default value for existing users...")
    users_response = requests.get(
        f"{POCKETBASE_URL}/api/collections/users/records?perPage=500",
        headers=headers,
    )
    
    if users_response.status_code != 200:
        print(f"⚠️  Failed to fetch users: {users_response.status_code}")
        print("   Skipping default value assignment")
    else:
        users_data = users_response.json()
        users = users_data.get("items", [])
        
        updated_count = 0
        for user in users:
            # Only update if field is missing or null
            if "tutorial_completed" not in user or user.get("tutorial_completed") is None:
                user_id = user.get("id")
                try:
                    update_user_response = requests.patch(
                        f"{POCKETBASE_URL}/api/collections/users/records/{user_id}",
                        headers=headers,
                        json={"tutorial_completed": False},
                    )
                    
                    if update_user_response.status_code == 200:
                        updated_count += 1
                    else:
                        print(f"   ⚠️  Failed to update user {user_id}: {update_user_response.status_code}")
                except Exception as e:
                    print(f"   ⚠️  Error updating user {user_id}: {e}")
        
        print(f"\n✅ Updated {updated_count} existing users with default value")
    
    print("\n🎉 Tutorial field setup complete!")


if __name__ == "__main__":
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("ERROR: POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set")
        sys.exit(1)
    
    main()

