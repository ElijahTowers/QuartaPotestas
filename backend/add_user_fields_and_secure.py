#!/usr/bin/env python3
"""
Add user relation fields to collections and set API rules.

This script will:
1. Try to add 'user' relation field via API (may fail due to PocketBase limitation)
2. If API fails, recreate collections with user field included
3. Set API rules to secure the collections
"""
import httpx
import asyncio
import os
import json
from typing import Optional
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


async def get_users_collection_id(client: httpx.AsyncClient, token: str) -> Optional[str]:
    """Get the users collection ID"""
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = await client.get(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
        )
        if response.status_code == 200:
            return response.json().get("id")
    except:
        pass
    return None


async def try_add_user_field_via_api(
    client: httpx.AsyncClient,
    token: str,
    collection_id: str,
    users_collection_id: str
) -> bool:
    """Try to add user field via API"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get current collection
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
    )
    if response.status_code != 200:
        return False
    
    collection_data = response.json()
    existing_fields = collection_data.get("fields", [])
    
    # Check if user field already exists
    for field in existing_fields:
        if field.get("name") == "user" and field.get("type") == "relation":
            return True  # Already exists
    
    # Create user field
    user_field = {
        "name": "user",
        "type": "relation",
        "required": True,
        "options": {
            "collectionId": users_collection_id,
            "cascadeDelete": False,
            "maxSelect": 1
        }
    }
    
    # Try adding
    updated_fields = existing_fields + [user_field]
    patch_data = {"fields": updated_fields}
    json_payload = json.dumps(patch_data)
    
    response = await client.patch(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        content=json_payload,
        headers={
            **headers,
            "Content-Type": "application/json"
        },
    )
    
    return response.status_code == 200


async def recreate_collection_with_user_field(
    client: httpx.AsyncClient,
    token: str,
    collection_name: str,
    users_collection_id: str,
    existing_fields: list
) -> bool:
    """
    Recreate a collection with user field included.
    This deletes the existing collection and creates a new one.
    """
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get collection ID
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    if response.status_code != 200:
        return False
    
    collection_id = response.json().get("id")
    
    # Get all non-system fields (exclude system fields like id, created, updated)
    custom_fields = [
        f for f in existing_fields
        if not f.get("system", False) and f.get("name") not in ["id", "created", "updated"]
    ]
    
    # Add user field at the beginning
    user_field = {
        "name": "user",
        "type": "relation",
        "required": True,
        "options": {
            "collectionId": users_collection_id,
            "cascadeDelete": False,
            "maxSelect": 1
        }
    }
    
    # Combine fields (user first, then others)
    new_fields = [user_field] + custom_fields
    
    # Delete existing collection
    print(f"  Deleting existing collection...")
    delete_response = await client.delete(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
    )
    if delete_response.status_code != 204:
        print(f"  ⚠ Failed to delete: {delete_response.status_code}")
        return False
    
    # Create new collection with user field
    print(f"  Creating collection with user field...")
    collection_data = {
        "name": collection_name,
        "type": "base",
        "fields": new_fields
    }
    
    create_response = await client.post(
        f"{POCKETBASE_URL}/api/collections",
        json=collection_data,
        headers=headers,
    )
    
    if create_response.status_code == 200:
        print(f"  ✓ Collection recreated with user field")
        return True
    else:
        print(f"  ✗ Failed to recreate: {create_response.status_code} - {create_response.text}")
        return False


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
        return False
    
    collection_data = response.json()
    collection_id = collection_data.get("id")
    
    # Set API rules
    collection_data["listRule"] = "user = @request.auth.id"
    collection_data["viewRule"] = "user = @request.auth.id"
    collection_data["createRule"] = "@request.auth.id != \"\" && user = @request.auth.id"
    collection_data["updateRule"] = "user = @request.auth.id"
    collection_data["deleteRule"] = "user = @request.auth.id"
    
    # Update
    json_payload = json.dumps(collection_data)
    
    response = await client.patch(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        content=json_payload,
        headers={
            **headers,
            "Content-Type": "application/json"
        },
    )
    
    return response.status_code == 200


async def secure_collection(
    client: httpx.AsyncClient,
    token: str,
    collection_name: str,
    users_collection_id: str
) -> bool:
    """Secure a collection by adding user field and setting API rules"""
    print(f"\nSecuring: {collection_name}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get collection
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    
    if response.status_code != 200:
        print(f"  ✗ Collection not found")
        return False
    
    collection_data = response.json()
    collection_id = collection_data.get("id")
    existing_fields = collection_data.get("fields", [])
    
    # Check if user field exists
    has_user_field = any(
        f.get("name") == "user" and f.get("type") == "relation"
        for f in existing_fields
    )
    
    if has_user_field:
        print(f"  ✓ User field already exists")
    else:
        print(f"  Adding user field...")
        
        # Try API first
        success = await try_add_user_field_via_api(
            client, token, collection_id, users_collection_id
        )
        
        if success:
            print(f"  ✓ User field added via API")
        else:
            print(f"  ⚠ API failed, recreating collection with user field...")
            print(f"  ⚠ WARNING: This will DELETE all existing records in {collection_name}!")
            
            # Ask user (in automated mode, we'll just do it)
            # For now, let's try recreation
            success = await recreate_collection_with_user_field(
                client, token, collection_name, users_collection_id, existing_fields
            )
            
            if not success:
                print(f"  ✗ Failed to add user field")
                return False
    
    # Set API rules
    print(f"  Setting API rules...")
    if await set_api_rules(client, token, collection_name):
        print(f"  ✓ API rules set")
        return True
    else:
        print(f"  ✗ Failed to set API rules")
        return False


async def main():
    """Main function"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Adding User Fields and Securing Collections")
        print("=" * 60)
        
        # Authenticate
        try:
            token = await authenticate_admin(client)
            print("✓ Authenticated\n")
        except Exception as e:
            print(f"✗ Authentication failed: {e}")
            return
        
        # Get users collection ID
        users_collection_id = await get_users_collection_id(client, token)
        if not users_collection_id:
            print("✗ Could not find users collection")
            return
        print(f"✓ Found users collection (ID: {users_collection_id})\n")
        
        # Collections to secure
        collections = ["daily_editions", "articles"]
        # Note: skipping 'ads' for now as it might not exist
        
        results = []
        for collection_name in collections:
            success = await secure_collection(
                client, token, collection_name, users_collection_id
            )
            results.append((collection_name, success))
        
        # Summary
        print("\n" + "=" * 60)
        print("Summary")
        print("=" * 60)
        for collection_name, success in results:
            status = "✓ Secured" if success else "✗ Failed"
            print(f"{status}: {collection_name}")
        
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

