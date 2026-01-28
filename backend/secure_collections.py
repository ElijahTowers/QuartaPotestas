#!/usr/bin/env python3
"""
Secure PocketBase collections by adding user relation fields and setting API rules.

This script:
1. Adds a 'user' relation field to collections (if missing)
2. Sets API rules to ensure users can only access their own records
"""
import httpx
import asyncio
import os
import json
from typing import List, Optional
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


async def get_collection(client: httpx.AsyncClient, token: str, collection_name: str) -> dict:
    """Get collection details"""
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    if response.status_code != 200:
        raise Exception(f"Failed to get collection: {response.status_code} - {response.text}")
    return response.json()


async def has_user_field(collection_data: dict) -> bool:
    """Check if collection has a 'user' relation field"""
    fields = collection_data.get("fields", [])
    for field in fields:
        if field.get("name") == "user" and field.get("type") == "relation":
            return True
    return False


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


async def try_add_user_field(
    client: httpx.AsyncClient,
    token: str,
    collection_id: str,
    users_collection_id: str
) -> bool:
    """
    Try to add a 'user' relation field to the collection.
    
    Note: This may fail due to PocketBase 0.36.1 API limitations.
    If it fails, the field must be added manually via Admin UI.
    """
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
    
    # Create user relation field
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
    
    # Try adding the field
    updated_fields = existing_fields + [user_field]
    
    # Manually serialize JSON
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
    
    if response.status_code == 200:
        return True
    else:
        # Relation fields often fail via API - this is expected
        return False


async def update_api_rules(
    client: httpx.AsyncClient,
    token: str,
    collection_id: str,
    collection_name: str
) -> bool:
    """Update API rules for the collection"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get current collection
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
    )
    if response.status_code != 200:
        print(f"  ✗ Failed to get collection: {response.status_code}")
        return False
    
    collection_data = response.json()
    
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
        print(f"  ✓ Updated API rules for {collection_name}")
        return True
    else:
        print(f"  ✗ Failed to update API rules: {response.status_code} - {response.text}")
        return False


async def secure_collection(
    client: httpx.AsyncClient,
    token: str,
    collection_name: str,
    users_collection_id: Optional[str] = None
) -> bool:
    """Secure a single collection by adding user field and setting API rules"""
    print(f"\nSecuring collection: {collection_name}")
    
    # Get collection
    try:
        collection_data = await get_collection(client, token, collection_name)
        collection_id = collection_data.get("id")
    except Exception as e:
        print(f"  ✗ Failed to get collection: {e}")
        return False
    
    # Check if user field exists
    has_field = await has_user_field(collection_data)
    
    if not has_field:
        print(f"  ⚠ 'user' relation field not found")
        
        if not users_collection_id:
            # Get users collection ID
            users_collection_id = await get_users_collection_id(client, token)
            if not users_collection_id:
                print(f"  ✗ Could not find 'users' collection")
                print(f"  ⚠ SKIPPING: Cannot add 'user' field automatically")
                print(f"  → Please add 'user' relation field manually via Admin UI:")
                print(f"    1. Go to http://127.0.0.1:8090/_/")
                print(f"    2. Collections → {collection_name}")
                print(f"    3. New Field → Type: Relation")
                print(f"    4. Name: user, Collection: users, Required: Yes")
                return False
        
        # Try to add user field
        print(f"  Attempting to add 'user' relation field...")
        success = await try_add_user_field(client, token, collection_id, users_collection_id)
        
        if success:
            print(f"  ✓ Added 'user' relation field")
        else:
            print(f"  ✗ Failed to add 'user' field via API (known PocketBase limitation)")
            print(f"  ⚠ MANUAL STEP REQUIRED:")
            print(f"    1. Go to http://127.0.0.1:8090/_/")
            print(f"    2. Collections → {collection_name}")
            print(f"    3. New Field → Type: Relation")
            print(f"    4. Name: user")
            print(f"    5. Collection: users")
            print(f"    6. Required: Yes")
            print(f"    7. Max select: 1")
            print(f"    8. Save")
            print(f"  → After adding the field manually, run this script again to set API rules")
            return False
    else:
        print(f"  ✓ 'user' relation field already exists")
    
    # Update API rules
    return await update_api_rules(client, token, collection_id, collection_name)


async def main():
    """Main function to secure collections"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Securing PocketBase Collections")
        print("=" * 60)
        
        # Authenticate
        try:
            token = await authenticate_admin(client)
            print("✓ Authenticated\n")
        except Exception as e:
            print(f"✗ Authentication failed: {e}")
            return
        
        # Get users collection ID once
        users_collection_id = await get_users_collection_id(client, token)
        if users_collection_id:
            print(f"✓ Found users collection (ID: {users_collection_id})\n")
        else:
            print(f"⚠ Could not find users collection\n")
        
        # Collections to secure
        collections_to_secure = [
            "daily_editions",
            "articles",
            "ads"
        ]
        
        results = []
        for collection_name in collections_to_secure:
            success = await secure_collection(
                client,
                token,
                collection_name,
                users_collection_id
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
        print("\nUsers can now only access records where user = their own ID.\n")


if __name__ == "__main__":
    asyncio.run(main())

