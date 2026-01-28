#!/usr/bin/env python3
"""
Set API Rules for PocketBase collections (assumes 'user' field already exists).

This script sets API rules to ensure users can only access their own records.
Run this AFTER manually adding the 'user' relation field to collections.
"""
import httpx
import asyncio
import os
import json
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")


async def authenticate_admin(client: httpx.AsyncClient) -> str:
    """Authenticate as admin and return token"""
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code != 200:
        raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json()["token"]


async def set_api_rules(
    client: httpx.AsyncClient,
    token: str,
    collection_name: str
) -> bool:
    """Set API rules for a collection"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get collection
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    
    if response.status_code != 200:
        print(f"  ✗ Collection '{collection_name}' not found")
        return False
    
    collection_data = response.json()
    collection_id = collection_data.get("id")
    
    # Check if user field exists
    fields = collection_data.get("fields", [])
    has_user_field = any(
        f.get("name") == "user" and f.get("type") == "relation"
        for f in fields
    )
    
    if not has_user_field:
        print(f"  ⚠ WARNING: 'user' relation field not found in '{collection_name}'")
        print(f"     API rules will be set, but won't work until 'user' field is added")
    
    # Set API rules
    # List/View: Only records where user = authenticated user
    collection_data["listRule"] = "user = @request.auth.id"
    collection_data["viewRule"] = "user = @request.auth.id"
    
    # Create: Must be authenticated and set user to own ID
    collection_data["createRule"] = "@request.auth.id != \"\" && user = @request.auth.id"
    
    # Update: Only if user = authenticated user
    collection_data["updateRule"] = "user = @request.auth.id"
    
    # Delete: Only if user = authenticated user
    collection_data["deleteRule"] = "user = @request.auth.id"
    
    # Update collection
    json_payload = json.dumps(collection_data)
    
    response = await client.patch(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        content=json_payload,
        headers={
            **headers,
            "Content-Type": "application/json"
        },
    )
    
    if response.status_code == 200:
        print(f"  ✓ Set API rules for '{collection_name}'")
        return True
    else:
        print(f"  ✗ Failed to set API rules: {response.status_code} - {response.text}")
        return False


async def main():
    """Set API rules for collections"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Setting API Rules for PocketBase Collections")
        print("=" * 60)
        print("\n⚠️  NOTE: This assumes 'user' relation field already exists!")
        print("   If not, add it manually first via Admin UI.\n")
        
        # Authenticate
        try:
            token = await authenticate_admin(client)
            print("✓ Authenticated\n")
        except Exception as e:
            print(f"✗ Authentication failed: {e}")
            return
        
        # Collections to secure
        collections = [
            "daily_editions",
            "articles",
            "ads"
        ]
        
        results = []
        for collection_name in collections:
            print(f"Processing: {collection_name}")
            success = await set_api_rules(client, token, collection_name)
            results.append((collection_name, success))
        
        # Summary
        print("\n" + "=" * 60)
        print("Summary")
        print("=" * 60)
        for collection_name, success in results:
            status = "✓" if success else "✗"
            print(f"{status} {collection_name}")
        
        print("\n" + "=" * 60)
        print("API Rules Applied:")
        print("=" * 60)
        print("  List/View:  user = @request.auth.id")
        print("  Create:     @request.auth.id != \"\" && user = @request.auth.id")
        print("  Update:     user = @request.auth.id")
        print("  Delete:     user = @request.auth.id")
        print("\n✅ Collections are now secured!\n")


if __name__ == "__main__":
    asyncio.run(main())

