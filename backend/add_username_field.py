#!/usr/bin/env python3
"""
Add username field to users collection in PocketBase
"""
import requests
import os
import sys
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

def generate_default_username(email: str) -> str:
    """Generate a default username from email"""
    # Extract the part before @
    username = email.split("@")[0]
    # Remove any dots and make it lowercase
    username = username.replace(".", "").lower()
    # Add a random number to make it unique
    import random
    username = f"{username}{random.randint(100, 999)}"
    return username

def main():
    print("🔧 Adding username field to users collection...")
    
    # Step 1: Authenticate as admin
    print("\n1. Authenticating as admin...")
    # PocketBase 0.36.1 uses _superusers collection for admin auth
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
    print(f"   Collection type: {collection_data.get('type')}")
    print(f"   Collection name: {collection_data.get('name')}")
    
    # Step 3: Check if username field already exists
    # Auth collections use "fields" instead of "schema"
    fields = collection_data.get("fields", [])
    print(f"   Current fields: {len(fields)}")
    
    username_field_exists = any(field.get("name") == "username" for field in fields)
    
    if username_field_exists:
        print("\n⚠️  Username field already exists. Skipping field creation.")
    else:
        # Step 4: Add username field
        print("\n3. Adding username field...")
        new_field = {
            "system": False,
            "id": "username_field",
            "name": "username",
            "type": "text",
            "required": False,
            "presentable": True,
            "indexable": True,
            "searchable": True,
            "options": {
                "min": None,
                "max": None,
                "pattern": "",
            }
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
            print(f"   Payload sent: {update_payload}")
            sys.exit(1)
        
        print("✅ Username field added")
        
        # Verify it was added
        verify_response = requests.get(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
        )
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            verify_fields = verify_data.get("fields", [])
            if any(f.get("name") == "username" for f in verify_fields):
                print("✅ Verified: Username field is now in the collection")
            else:
                print("⚠️  Warning: Field may not have been added correctly")
    
    # Step 5: Set default usernames for existing users without username
    print("\n4. Setting default usernames for existing users...")
    
    # Get all users
    users_response = requests.get(
        f"{POCKETBASE_URL}/api/collections/users/records?perPage=500",
        headers=headers,
    )
    
    if users_response.status_code != 200:
        print(f"⚠️  Failed to fetch users: {users_response.status_code}")
        print("   Skipping default username assignment")
    else:
        users_data = users_response.json()
        users = users_data.get("items", [])
        
        updated_count = 0
        for user in users:
            if not user.get("username"):
                email = user.get("email", "")
                if email:
                    default_username = generate_default_username(email)
                    
                    # Update user
                    update_user_response = requests.patch(
                        f"{POCKETBASE_URL}/api/collections/users/records/{user['id']}",
                        headers=headers,
                        json={
                            "username": default_username,
                        }
                    )
                    
                    if update_user_response.status_code == 200:
                        updated_count += 1
                        print(f"   ✅ Set username for {email}: {default_username}")
                    else:
                        print(f"   ⚠️  Failed to update {email}: {update_user_response.status_code}")
        
        print(f"\n✅ Updated {updated_count} users with default usernames")
    
    print("\n🎉 Username field setup complete!")
    print("\nNext steps:")
    print("1. Update your registration code to generate usernames for new users")
    print("2. Add username editing functionality in the frontend")

if __name__ == "__main__":
    main()

