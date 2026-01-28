#!/usr/bin/env python3
"""
Script to automatically create PocketBase collections
Run this after starting PocketBase and creating your admin account
"""

import asyncio
import httpx
import json
import getpass
import os
from pathlib import Path

POCKETBASE_URL = "http://127.0.0.1:8090"

# Try to load from .env file if it exists
def load_env_file():
    """Load environment variables from .env file"""
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()

# Load .env file if it exists
load_env_file()


async def authenticate_admin(client: httpx.AsyncClient) -> str:
    """Authenticate and get admin token"""
    import os
    
    # Try to get from environment variables first
    email = os.getenv("POCKETBASE_ADMIN_EMAIL")
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD")
    
    if not email or not password:
        print("PocketBase Admin Authentication")
        print("=" * 40)
        print("(Tip: Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD to skip prompts)")
        email = input("Admin email: ")
        password = getpass.getpass("Admin password: ")
    
    # PocketBase admin/superuser authentication endpoint
    # Note: You must create a superuser account via the UI first at http://127.0.0.1:8090/_/
    print(f"Authenticating with PocketBase at {POCKETBASE_URL}...")
    
    # Try different endpoint formats for different PocketBase versions
    # In PocketBase 0.36.1, superusers use the _superusers collection endpoint
    endpoints_to_try = [
        "/api/collections/_superusers/auth-with-password",  # Correct endpoint for PocketBase 0.36.1
        "/api/admins/auth-with-password",                   # Legacy format
        "/api/admins/authWithPassword",                      # CamelCase format
        "/api/admins/auth",                                  # Short format
    ]
    
    response = None
    last_error = None
    
    for endpoint in endpoints_to_try:
        try:
            print(f"Trying endpoint: {endpoint}...")
            response = await client.post(
                f"{POCKETBASE_URL}{endpoint}",
                json={"identity": email, "password": password},
            )
            if response.status_code == 200:
                print(f"✓ Success with endpoint: {endpoint}")
                break
            elif response.status_code != 404:
                # If it's not 404, this might be the right endpoint but wrong credentials
                last_error = response
                break
        except Exception as e:
            last_error = e
            continue
    
    if not response:
        raise Exception(
            f"❌ Could not connect to PocketBase authentication endpoints.\n"
            f"Please check:\n"
            f"1. PocketBase is running: http://127.0.0.1:8090\n"
            f"2. You can access the admin UI: http://127.0.0.1:8090/_/\n"
            f"Error: {last_error}"
        )
    
    # Handle different response codes
    if response.status_code == 404:
        raise Exception(
            f"❌ Admin authentication endpoint not found (404).\n\n"
            f"This usually means PocketBase 0.36.1 doesn't expose the admin API via REST.\n"
            f"Alternative: Create collections manually via the UI at http://127.0.0.1:8090/_/\n\n"
            f"Or try:\n"
            f"1. Check if you can access http://127.0.0.1:8090/_/\n"
            f"2. Make sure you created a superuser account\n"
            f"3. Try updating PocketBase to the latest version\n"
            f"Response: {response.text}"
        )
    
    if response.status_code == 400:
        try:
            error_data = response.json()
            error_msg = error_data.get("message", response.text)
        except:
            error_msg = response.text
        raise Exception(
            f"❌ Authentication failed (400): {error_msg}\n\n"
            f"Please check:\n"
            f"1. Email is correct: {email}\n"
            f"2. Password is correct\n"
            f"3. You created a superuser account (not a regular user)\n"
            f"4. You can log in via the UI at http://127.0.0.1:8090/_/\n"
        )
    
    if response.status_code == 401:
        raise Exception(
            f"❌ Unauthorized (401): Invalid credentials\n\n"
            f"Please check:\n"
            f"1. Email: {email}\n"
            f"2. Password is correct\n"
            f"3. You're using superuser credentials from http://127.0.0.1:8090/_/\n"
        )
    
    if response.status_code != 200:
        error_msg = response.text
        raise Exception(
            f"❌ Authentication failed ({response.status_code}): {error_msg}\n\n"
            f"Make sure:\n"
            f"1. PocketBase is running: http://127.0.0.1:8090\n"
            f"2. You're using superuser credentials from http://127.0.0.1:8090/_/\n"
            f"3. You can log in via the UI\n"
        )
    
    data = response.json()
    token = data["token"]
    print("✓ Authenticated successfully\n")
    return token


async def create_collection(client: httpx.AsyncClient, token: str, collection_data: dict) -> bool:
    """Create a collection in PocketBase"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Debug: print the data we're sending (without sensitive info)
    print(f"Creating collection: {collection_data['name']}")
    
    # Remove empty options objects to simplify
    # NOTE: PocketBase 0.36.1 uses "fields" not "schema"
    for field in collection_data.get("fields", []):
        if "options" in field and field["options"] == {}:
            # Keep it but ensure it's a proper empty dict
            pass
    
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections",
        json=collection_data,
        headers=headers,
    )
    
    if response.status_code == 200:
        print(f"✓ Created collection: {collection_data['name']}")
        return True
    elif response.status_code == 400:
        error_text = response.text
        if "already exists" in error_text.lower():
            print(f"⚠ Collection already exists: {collection_data['name']}")
            return True
        else:
            # Print more detailed error for debugging
            try:
                error_json = response.json()
                error_msg = error_json.get("message", error_text)
                print(f"✗ Failed to create {collection_data['name']}: {response.status_code}")
                print(f"  Error: {error_msg}")
                if "data" in error_json and error_json["data"]:
                    print(f"  Details: {error_json['data']}")
                # Print the full response for debugging
                print(f"  Full response: {error_text}")
            except Exception as e:
                print(f"✗ Failed to create {collection_data['name']}: {response.status_code} - {error_text}")
                print(f"  Could not parse error JSON: {e}")
            return False
    else:
        print(f"✗ Failed to create {collection_data['name']}: {response.status_code} - {response.text}")
        return False


async def main():
    """Main setup function"""
    print("\n" + "=" * 50)
    print("PocketBase Collections Setup")
    print("=" * 50 + "\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Authenticate
        token = await authenticate_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        
        # Define collections
        # PocketBase 0.36.1 uses "fields" instead of "schema"
        collections = [
            {
                "name": "daily_editions",
                "type": "base",
                "fields": [
                    {
                        "name": "date",
                        "type": "date",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "global_mood",
                        "type": "text",
                        "required": False,
                        "options": {}
                    }
                ]
            },
            {
                "name": "articles",
                "type": "base",
                "fields": [
                    {
                        "name": "daily_edition_id",
                        "type": "relation",
                        "required": True,
                        # NOTE: In PocketBase v0.36+, relation properties must be at root level, NOT nested in "options"
                        "collectionId": "",  # Will be set after daily_editions is created
                        "cascadeDelete": True,
                        "minSelect": None,
                        "maxSelect": 1,
                        "displayFields": ["date"]
                    },
                    {
                        "name": "original_title",
                        "type": "text",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "processed_variants",
                        "type": "json",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "tags",
                        "type": "json",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "location_lat",
                        "type": "number",
                        "required": False,
                        "options": {}
                    },
                    {
                        "name": "location_lon",
                        "type": "number",
                        "required": False,
                        "options": {}
                    },
                    {
                        "name": "location_city",
                        "type": "text",
                        "required": False,
                        "options": {}
                    },
                    {
                        "name": "date",
                        "type": "date",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "published_at",
                        "type": "date",
                        "required": False,
                        "options": {}
                    }
                ]
            },
            {
                "name": "ads",
                "type": "base",
                "fields": [
                    {
                        "name": "company",
                        "type": "text",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "tagline",
                        "type": "text",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "description",
                        "type": "text",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "tags",
                        "type": "json",
                        "required": False,
                        "options": {}
                    }
                ]
            },
            {
                "name": "published_editions",
                "type": "base",
                "fields": [
                    {
                        "name": "user",
                        "type": "relation",
                        "required": True,
                        "collectionId": "",  # Will be set after users collection exists
                        "cascadeDelete": False,
                        "minSelect": None,
                        "maxSelect": 1,
                        "displayFields": ["email"]
                    },
                    {
                        "name": "date",
                        "type": "date",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "newspaper_name",
                        "type": "text",
                        "required": False,
                        "options": {}
                    },
                    {
                        "name": "grid_layout",
                        "type": "json",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "stats",
                        "type": "json",
                        "required": True,
                        "options": {}
                    },
                    {
                        "name": "published_at",
                        "type": "date",
                        "required": True,
                        "options": {}
                    }
                ]
            }
        ]
        
        # Create collections in order
        print("\nCreating collections...\n")
        
        # First, create daily_editions
        daily_editions_created = await create_collection(client, token, collections[0])
        
        if not daily_editions_created:
            print("Failed to create daily_editions. Cannot continue.")
            return
        
        # Get the daily_editions collection ID
        response = await client.get(
            f"{POCKETBASE_URL}/api/collections/daily_editions",
            headers=headers,
        )
        if response.status_code == 200:
            daily_editions_id = response.json()["id"]
            # Update articles collection to reference daily_editions
            # NOTE: In PocketBase v0.36+, relation properties are at root level, not in "options"
            # Find the relation field in articles collection
            for field in collections[1]["fields"]:
                if field.get("type") == "relation" and field.get("name") == "daily_edition_id":
                    field["collectionId"] = daily_editions_id
                    break
        
        # Get the users collection ID (it should already exist)
        users_response = await client.get(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
        )
        if users_response.status_code == 200:
            users_id = users_response.json()["id"]
            # Update published_editions collection to reference users
            for field in collections[3]["fields"]:
                if field.get("type") == "relation" and field.get("name") == "user":
                    field["collectionId"] = users_id
                    break
        else:
            print("⚠ Warning: Could not find users collection. published_editions user relation may need manual setup.")
        
        # Create articles
        await create_collection(client, token, collections[1])
        
        # Create ads
        await create_collection(client, token, collections[2])
        
        # Create published_editions
        await create_collection(client, token, collections[3])
        
        print("\n" + "=" * 50)
        print("✓ Setup complete!")
        print("=" * 50)
        print("\nCollections created:")
        print("  - daily_editions")
        print("  - articles")
        print("  - ads")
        print("  - published_editions")
        print("\nYou can now use PocketBase with your application.\n")


if __name__ == "__main__":
    asyncio.run(main())

