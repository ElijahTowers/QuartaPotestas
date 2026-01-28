#!/usr/bin/env python3
"""
Recreate PocketBase collections with all fields including relation fields.
This is an alternative approach since adding relation fields to existing collections doesn't work.
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

async def delete_collection(client: httpx.AsyncClient, token: str, collection_name: str) -> bool:
    """Delete a collection by name"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get collection ID
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    
    if response.status_code == 404:
        print(f"⚠ Collection '{collection_name}' does not exist")
        return True
    
    if response.status_code != 200:
        print(f"✗ Failed to get collection '{collection_name}': {response.status_code}")
        return False
    
    collection_id = response.json()["id"]
    
    # Delete the collection
    response = await client.delete(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
    )
    
    if response.status_code == 204:
        print(f"✓ Deleted collection: {collection_name}")
        return True
    else:
        print(f"✗ Failed to delete '{collection_name}': {response.status_code} - {response.text}")
        return False

async def create_collection_with_fields(client: httpx.AsyncClient, token: str, collection_data: dict) -> str:
    """Create a collection with all fields and return the collection ID"""
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
        collection_id = response.json()["id"]
        print(f"✓ Created collection: {collection_data['name']} (ID: {collection_id})")
        return collection_id
    else:
        error_text = response.text
        print(f"✗ Failed to create {collection_data['name']}: {response.status_code}")
        print(f"  Error: {error_text}")
        raise Exception(f"Failed to create collection: {error_text}")

async def main():
    """Recreate collections with all fields including relations"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Recreating PocketBase Collections with All Fields")
        print("=" * 60)
        
        # Authenticate
        token = await authenticate_admin(client)
        print("✓ Authenticated\n")
        
        # Step 1: Delete existing collections (in reverse order to handle relations)
        print("Step 1: Deleting existing collections...")
        await delete_collection(client, token, "ads")
        await delete_collection(client, token, "articles")
        await delete_collection(client, token, "daily_editions")
        print()
        
        # Step 2: Create daily_editions first (no dependencies)
        print("Step 2: Creating daily_editions collection...")
        daily_editions_data = {
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
        }
        daily_editions_id = await create_collection_with_fields(client, token, daily_editions_data)
        print()
        
        # Step 3: Create articles with relation field (depends on daily_editions)
        print("Step 3: Creating articles collection with relation field...")
        articles_data = {
            "name": "articles",
            "type": "base",
            "fields": [
                {
                    "name": "daily_edition_id",
                    "type": "relation",
                    "required": True,
                    "options": {
                        "collectionId": daily_editions_id,  # Use the ID from step 2
                        "cascadeDelete": True,
                        "maxSelect": 1
                    }
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
        }
        articles_id = await create_collection_with_fields(client, token, articles_data)
        print()
        
        # Step 4: Create ads collection
        print("Step 4: Creating ads collection...")
        ads_data = {
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
                    "name": "headline",
                    "type": "text",
                    "required": True,
                    "options": {}
                },
                {
                    "name": "body",
                    "type": "text",
                    "required": False,
                    "options": {}
                },
                {
                    "name": "image_url",
                    "type": "url",
                    "required": False,
                    "options": {}
                }
            ]
        }
        ads_id = await create_collection_with_fields(client, token, ads_data)
        print()
        
        # Step 5: Set API Rules (permissions)
        print("Step 5: Setting API Rules to Public (for development)...")
        collections_to_update = [
            ("daily_editions", daily_editions_id),
            ("articles", articles_id),
            ("ads", ads_id)
        ]
        
        headers = {"Authorization": f"Bearer {token}"}
        for collection_name, collection_id in collections_to_update:
            # Get current collection
            response = await client.get(
                f"{POCKETBASE_URL}/api/collections/{collection_id}",
                headers=headers,
            )
            if response.status_code == 200:
                collection_data = response.json()
                # Set all rules to "Public" for development
                collection_data["listRule"] = ""
                collection_data["viewRule"] = ""
                collection_data["createRule"] = ""
                collection_data["updateRule"] = ""
                collection_data["deleteRule"] = ""
                
                # Update collection
                update_response = await client.patch(
                    f"{POCKETBASE_URL}/api/collections/{collection_id}",
                    json=collection_data,
                    headers=headers,
                )
                if update_response.status_code == 200:
                    print(f"  ✓ Set API rules for {collection_name}")
                else:
                    print(f"  ⚠ Failed to set API rules for {collection_name}: {update_response.status_code}")
        
        print("\n" + "=" * 60)
        print("✓ Setup complete!")
        print("=" * 60)
        print("\nCollections created with all fields:")
        print(f"  - daily_editions (ID: {daily_editions_id})")
        print(f"  - articles (ID: {articles_id}) - includes relation field!")
        print(f"  - ads (ID: {ads_id})")
        print("\nAll fields including relation fields are now set up.\n")

if __name__ == "__main__":
    asyncio.run(main())

