#!/usr/bin/env python3
"""
Add audience_scores field to articles collection in PocketBase.
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
    print("Adding audience_scores field to articles collection")
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
        
        # Check if audience_scores field already exists
        existing_fields = [f["name"] for f in collection.get("fields", [])]
        if "audience_scores" in existing_fields:
            print("ℹ️  audience_scores field already exists!")
            return
        
        # Add audience_scores field
        print("Adding audience_scores field...")
        new_field = {
            "system": False,
            "id": "audience_scores_field",
            "name": "audience_scores",
            "type": "json",
            "required": False,
            "presentable": False,
            "indexable": False,
            "searchable": False,
            "options": {}
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
            print("✅ audience_scores field added successfully!\n")
            print("Field details:")
            print("  - Name: audience_scores")
            print("  - Type: JSON")
            print("  - Required: No")
            print("  - Description: Faction reaction scores (-10 to +10) for 8 factions")
        else:
            print(f"❌ Failed to add field: {update_response.text}")
            print(f"Response status: {update_response.status_code}")
            return

if __name__ == "__main__":
    asyncio.run(main())

