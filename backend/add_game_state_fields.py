#!/usr/bin/env python3
"""
Add game state fields (treasury, purchased_upgrades, readers, credibility) to users collection in PocketBase.
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
    print("Adding game state fields (treasury, purchased_upgrades, readers, credibility) to users collection")
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
        
        # Check if fields already exist
        existing_fields = collection.get("fields", [])
        existing_field_names = {f.get("name") for f in existing_fields}
        
        fields_to_add = []
        
        # Add treasury field if it doesn't exist
        if "treasury" not in existing_field_names:
            fields_to_add.append({
                "system": False,
                "id": "treasury_field",
                "name": "treasury",
                "type": "number",
                "required": False,
                "presentable": True,
                "indexable": False,
                "searchable": False,
                "options": {
                    "min": None,
                    "max": None,
                    "noDecimal": False
                }
            })
        
        # Add purchased_upgrades field if it doesn't exist
        if "purchased_upgrades" not in existing_field_names:
            fields_to_add.append({
                "system": False,
                "id": "purchased_upgrades_field",
                "name": "purchased_upgrades",
                "type": "json",
                "required": False,
                "presentable": False,
                "indexable": False,
                "searchable": False,
                "options": {}
            })
        
        # Add readers field if it doesn't exist
        if "readers" not in existing_field_names:
            fields_to_add.append({
                "system": False,
                "id": "readers_field",
                "name": "readers",
                "type": "number",
                "required": False,
                "presentable": True,
                "indexable": False,
                "searchable": False,
                "options": {
                    "min": None,
                    "max": None,
                    "noDecimal": True
                }
            })
        
        # Add credibility field if it doesn't exist
        if "credibility" not in existing_field_names:
            fields_to_add.append({
                "system": False,
                "id": "credibility_field",
                "name": "credibility",
                "type": "number",
                "required": False,
                "presentable": True,
                "indexable": False,
                "searchable": False,
                "options": {
                    "min": None,
                    "max": None,
                    "noDecimal": False
                }
            })
        
        if not fields_to_add:
            print("⚠️  All game state fields already exist in users collection")
            return
        
        # Add fields
        print(f"Adding {len(fields_to_add)} field(s)...")
        collection["fields"].extend(fields_to_add)
        
        # Update collection
        update_response = await client.patch(
            f"{POCKETBASE_URL}/api/collections/users",
            json=collection,
            headers=headers,
        )
        
        if update_response.status_code == 200:
            print("✅ Successfully added game state fields to users collection")
            print("\nFields added:")
            for field in fields_to_add:
                print(f"  - {field['name']} ({field['type']})")
        else:
            print(f"❌ Failed to add fields: {update_response.text}")
            print(f"Response status: {update_response.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
