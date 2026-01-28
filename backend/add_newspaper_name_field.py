#!/usr/bin/env python3
"""
Add newspaper_name field to users collection in PocketBase.
"""
import httpx
import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

async def main():
    print("=" * 60)
    print("Adding newspaper_name field to users collection")
    print("=" * 60 + "\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Authenticate as admin
        print("Authenticating...")
        auth_response = await client.post(
            f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
            json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        
        if auth_response.status_code != 200:
            print(f"❌ Auth failed: {auth_response.text}")
            return
        
        token = auth_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Authenticated\n")
        
        # Get users collection
        print("Fetching users collection...")
        collection_response = await client.get(
            f"{POCKETBASE_URL}/api/collections/users",
            headers=headers,
        )
        
        if collection_response.status_code != 200:
            print(f"❌ Failed to get collection: {collection_response.text}")
            return
        
        collection = collection_response.json()
        print("✅ Got users collection\n")
        
        # Check if field already exists
        existing_fields = collection.get("fields", [])
        field_exists = any(f.get("name") == "newspaper_name" for f in existing_fields)
        
        if field_exists:
            print("⚠️  Field 'newspaper_name' already exists in users collection")
            return
        
        # Add newspaper_name field
        print("Adding newspaper_name field...")
        new_field = {
            "system": False,
            "id": "newspaper_name_field",
            "name": "newspaper_name",
            "type": "text",
            "required": False,
            "presentable": True,
            "indexable": True,
            "searchable": True,
            "options": {
                "min": None,
                "max": None,
                "pattern": ""
            }
        }
        
        # Add to fields
        collection["fields"].append(new_field)
        
        # Update collection
        update_response = await client.patch(
            f"{POCKETBASE_URL}/api/collections/users",
            json=collection,
            headers=headers,
        )
        
        if update_response.status_code == 200:
            print("✅ Successfully added 'newspaper_name' field to users collection")
            print("\nField details:")
            print("  - Name: newspaper_name")
            print("  - Type: Text")
            print("  - Required: No")
            print("  - Searchable: Yes")
        else:
            print(f"❌ Failed to add field: {update_response.text}")
            print(f"Response status: {update_response.status_code}")
            print(f"Response body: {update_response.text}")

if __name__ == "__main__":
    asyncio.run(main())

