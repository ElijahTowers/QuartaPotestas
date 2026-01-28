#!/usr/bin/env python3
"""
Script to add the published_editions collection to PocketBase
Run this to add the collection without recreating existing ones
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

load_env_file()


async def authenticate_admin(client: httpx.AsyncClient) -> str:
    """Authenticate and get admin token"""
    email = os.getenv("POCKETBASE_ADMIN_EMAIL")
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD")
    
    if not email or not password:
        print("PocketBase Admin Authentication")
        print("=" * 40)
        email = input("Admin email: ")
        password = getpass.getpass("Admin password: ")
    
    print(f"Authenticating with PocketBase at {POCKETBASE_URL}...")
    
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": email, "password": password},
    )
    
    if response.status_code != 200:
        raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
    
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
    
    print(f"Creating collection: {collection_data['name']}")
    
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
        if "already exists" in error_text.lower() or "unique" in error_text.lower():
            print(f"⚠ Collection already exists: {collection_data['name']}")
            return True
        else:
            try:
                error_json = response.json()
                error_msg = error_json.get("message", error_text)
                print(f"✗ Failed to create {collection_data['name']}: {response.status_code}")
                print(f"  Error: {error_msg}")
                if "data" in error_json and error_json["data"]:
                    print(f"  Details: {error_json['data']}")
            except Exception as e:
                print(f"✗ Failed to create {collection_data['name']}: {response.status_code} - {error_text}")
            return False
    else:
        print(f"✗ Failed to create {collection_data['name']}: {response.status_code} - {response.text}")
        return False


async def main():
    """Main setup function"""
    print("\n" + "=" * 50)
    print("Add Published Editions Collection")
    print("=" * 50 + "\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Authenticate
        token = await authenticate_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get users collection ID
        users_response = await client.get(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
        )
        
        if users_response.status_code != 200:
            print("✗ Could not find users collection. Please create it first.")
            return
        
        users_id = users_response.json()["id"]
        print(f"✓ Found users collection (ID: {users_id})\n")
        
        # Define published_editions collection
        published_editions_collection = {
            "name": "published_editions",
            "type": "base",
            "fields": [
                {
                    "name": "user",
                    "type": "relation",
                    "required": True,
                    "collectionId": users_id,
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
        
        # Create collection
        print("Creating published_editions collection...\n")
        success = await create_collection(client, token, published_editions_collection)
        
        if success:
            print("\n" + "=" * 50)
            print("✓ Setup complete!")
            print("=" * 50)
            print("\nCollection created:")
            print("  - published_editions")
            print("\n⚠️  Don't forget to set API rules in PocketBase Admin UI:")
            print("   - List/Search: @request.auth.id != \"\"")
            print("   - View: user = @request.auth.id")
            print("   - Create: @request.auth.id != \"\"")
            print("   - Update: user = @request.auth.id")
            print("   - Delete: user = @request.auth.id")
            print("\n")
        else:
            print("\n✗ Failed to create collection. Check errors above.\n")


if __name__ == "__main__":
    asyncio.run(main())

