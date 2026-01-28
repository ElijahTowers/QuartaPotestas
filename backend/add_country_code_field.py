#!/usr/bin/env python3
"""
Add country_code field to articles collection in PocketBase.
"""
import httpx
import asyncio
import json

POCKETBASE_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "lowiehartjes@gmail.com"
ADMIN_PASSWORD = "kwc*gyz7jur9YMH1cfd"

async def main():
    print("=" * 60)
    print("Adding country_code field to articles collection")
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
        
        # Get articles collection
        print("Fetching articles collection schema...")
        get_response = await client.get(
            f"{POCKETBASE_URL}/api/collections/articles",
            headers=headers,
        )
        
        if get_response.status_code != 200:
            print(f"❌ Failed to fetch collection: {get_response.text}")
            return
        
        collection = get_response.json()
        print(f"✅ Collection fetched\n")
        
        # Check if country_code field already exists
        existing_fields = [f["name"] for f in collection.get("fields", [])]
        if "country_code" in existing_fields:
            print("ℹ️  country_code field already exists!")
            return
        
        # Add country_code field
        print("Adding country_code field...")
        new_field = {
            "system": False,
            "id": "country_code_field",
            "name": "country_code",
            "type": "text",
            "required": False,
            "presentable": True,
            "indexable": True,
            "searchable": True,
            "options": {
                "min": None,
                "max": 2,
                "pattern": ""
            }
        }
        
        # Add to fields
        collection["fields"].append(new_field)
        
        # Update collection
        update_response = await client.patch(
            f"{POCKETBASE_URL}/api/collections/articles",
            headers=headers,
            json=collection,
        )
        
        if update_response.status_code == 200:
            print("✅ country_code field added successfully!\n")
            print("Field details:")
            print("  - Name: country_code")
            print("  - Type: Text")
            print("  - Required: No")
            print("  - Max length: 2 characters")
            print("  - Searchable: Yes")
        else:
            print(f"❌ Failed to add field: {update_response.text}")
            return

asyncio.run(main())

