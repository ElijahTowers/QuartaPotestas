#!/usr/bin/env python3
"""
Add user relation fields to collections using FLATTENED structure (no options wrapper)
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


async def add_user_field_to_collection(collection_name: str):
    """Add user relation field to a collection"""
    async with httpx.AsyncClient(base_url=POCKETBASE_URL, timeout=30.0) as client:
        # Authenticate
        response = await client.post(
            "/api/collections/_superusers/auth-with-password",
            json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get users collection ID
        users_resp = await client.get("/api/collections/users", headers=headers)
        if users_resp.status_code != 200:
            print(f"❌ Failed to get users collection: {users_resp.status_code}")
            return False
        users_id = users_resp.json()["id"]
        
        # Get target collection
        collection_resp = await client.get(f"/api/collections/{collection_name}", headers=headers)
        if collection_resp.status_code != 200:
            print(f"❌ Failed to get {collection_name} collection: {collection_resp.status_code}")
            return False
        
        collection_data = collection_resp.json()
        collection_id = collection_data.get("id")
        if not collection_id:
            print(f"❌ {collection_name} collection has no ID")
            return False
        
        existing_fields = collection_data.get("fields", [])
        
        # Check if user field already exists
        has_user = any(
            f.get("name") == "user" and f.get("type") == "relation"
            for f in existing_fields
        )
        
        if has_user:
            print(f"✓ User field already exists in {collection_name}")
            return True
        
        # Create user field with FLATTENED structure (no options wrapper)
        user_field = {
            "name": "user",
            "type": "relation",
            "required": True,
            "collectionId": users_id,  # Direct property, NOT in options!
            "maxSelect": 1,
            "cascadeDelete": False
        }
        
        # IMPORTANT: Keep ALL existing fields with ALL their properties
        all_fields = existing_fields + [user_field]
        payload = {"fields": all_fields}
        
        print(f"\nAdding user field to {collection_name}...")
        print(f"User field structure: {json.dumps(user_field, indent=2)}")
        
        response = await client.patch(
            f"/api/collections/{collection_id}",
            json=payload,
            headers=headers,
        )
        
        if response.status_code == 200:
            print(f"✅ User field added to {collection_name}!")
            return True
        else:
            print(f"❌ Failed to add user field to {collection_name}: {response.status_code}")
            print(f"Error: {response.text[:500]}")
            return False


async def main():
    """Add user fields to all relevant collections"""
    print("=" * 60)
    print("Adding User Relation Fields to Collections")
    print("=" * 60)
    
    collections = ["daily_editions", "articles", "ads"]
    
    for collection in collections:
        await add_user_field_to_collection(collection)
    
    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

