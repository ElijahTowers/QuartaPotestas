#!/usr/bin/env python3
"""
Add assistant_comment field to articles collection in PocketBase.
"""
import httpx
import asyncio
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

POCKETBASE_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "lowiehartjes@gmail.com")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

async def main():
    print("=" * 60)
    print("Adding assistant_comment field to articles collection")
    print("=" * 60 + "\n")
    
    if not ADMIN_PASSWORD:
        print("❌ POCKETBASE_ADMIN_PASSWORD not set in environment")
        return
    
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
        
        # Check if assistant_comment field already exists
        existing_fields = [f["name"] for f in collection.get("fields", [])]
        if "assistant_comment" in existing_fields:
            print("ℹ️  assistant_comment field already exists!")
            return
        
        # Add assistant_comment field
        print("Adding assistant_comment field...")
        new_field = {
            "system": False,
            "id": "assistant_comment_field",
            "name": "assistant_comment",
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
            f"{POCKETBASE_URL}/api/collections/articles",
            headers=headers,
            json=collection,
        )
        
        if update_response.status_code == 200:
            print("✅ assistant_comment field added successfully!\n")
            print("Field details:")
            print("  - Name: assistant_comment")
            print("  - Type: Text")
            print("  - Required: No")
            print("  - Searchable: Yes")
            print("  - Description: Short commentary from the editor (max 15 words)")
        else:
            print(f"❌ Failed to add field: {update_response.text}")
            print(f"Response status: {update_response.status_code}")
            return

if __name__ == "__main__":
    asyncio.run(main())

