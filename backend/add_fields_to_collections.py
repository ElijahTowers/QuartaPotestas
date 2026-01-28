#!/usr/bin/env python3
"""
Add schema fields to existing PocketBase collections
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

async def get_collection_id(client: httpx.AsyncClient, token: str, collection_name: str) -> str:
    """Get collection ID by name"""
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    if response.status_code != 200:
        raise Exception(f"Failed to get collection: {response.status_code} - {response.text}")
    return response.json()["id"]

async def update_collection_fields(client: httpx.AsyncClient, token: str, collection_id: str, new_fields: list) -> bool:
    """Update collection fields by patching the collection"""
    # Note: Don't set Content-Type explicitly - httpx sets it automatically when using json=
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Fetch the existing collection first
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
    )
    
    if response.status_code != 200:
        print(f"  ✗ Failed to get collection: {response.status_code}")
        return False
    
    collection_data = response.json()
    
    # 2. Get existing fields array (preserve system fields like id/created/updated)
    existing_fields = collection_data.get("fields", [])
    
    # Get existing field names to avoid duplicates
    existing_field_names = {field.get("name") for field in existing_fields}
    
    # 3. Append new fields to existing fields list (preserving ALL existing field properties)
    fields_to_add = []
    for field in new_fields:
        field_name = field.get("name")
        if field_name and field_name not in existing_field_names:
            # Deep copy the field to avoid modifying the original
            field_copy = json.loads(json.dumps(field))
            
            # For relation fields, flatten structure (move options to root level)
            if field_copy.get("type") == "relation":
                # In PocketBase v0.36+, relation properties must be at root level, not in "options"
                if "options" in field_copy:
                    options = field_copy.pop("options", {})
                    # Move options properties to root level
                    if "collectionId" in options:
                        field_copy["collectionId"] = options["collectionId"]
                    if "cascadeDelete" in options:
                        field_copy["cascadeDelete"] = options["cascadeDelete"]
                    if "maxSelect" in options:
                        field_copy["maxSelect"] = options["maxSelect"]
                    if "minSelect" in options:
                        field_copy["minSelect"] = options["minSelect"]
                    if "displayFields" in options:
                        field_copy["displayFields"] = options["displayFields"]
                
                # Validate collectionId is present
                if not field_copy.get("collectionId"):
                    print(f"  ✗ Relation field '{field_name}' missing collectionId")
                    continue
            fields_to_add.append(field_copy)
        elif field_name in existing_field_names:
            print(f"  ⚠ Field '{field_name}' already exists, skipping")
    
    if not fields_to_add:
        print(f"  ⚠ No new fields to add")
        return True
    
    # Add fields one at a time to avoid issues with merging
    success_count = 0
    for field in fields_to_add:
        # Get current fields state (refresh after each addition)
        if success_count > 0:
            response = await client.get(
                f"{POCKETBASE_URL}/api/collections/{collection_id}",
                headers=headers,
            )
            if response.status_code == 200:
                collection_data = response.json()
                existing_fields = collection_data.get("fields", [])
        
        # IMPORTANT: Keep ALL properties of existing fields (don't strip them)
        # Combine existing fields with this new field
        updated_fields = existing_fields + [field]
        
        # Debug: print relation field structure
        if field.get("type") == "relation":
            print(f"  DEBUG: Relation field '{field.get('name')}' structure: {json.dumps({k: v for k, v in field.items() if k != 'options'}, indent=2)}")
        
        # 4. Send PATCH request with the fields key
        patch_data = {"fields": updated_fields}
        
        # Debug: print the JSON being sent for relation fields
        if field.get("type") == "relation":
            # Find the relation field in the payload
            relation_in_payload = None
            for f in updated_fields:
                if f.get("name") == field.get("name") and f.get("type") == "relation":
                    relation_in_payload = f
                    break
            
            print(f"  DEBUG: Relation field in payload: {json.dumps(relation_in_payload, indent=2)}")
            collection_id_value = relation_in_payload.get('collectionId') if relation_in_payload else None
            print(f"  DEBUG: collectionId in payload: {collection_id_value}")
            
            # Verify ID format (PocketBase IDs are typically 15 alphanumeric characters)
            if collection_id_value:
                if len(collection_id_value) != 15 or not collection_id_value.replace('_', '').isalnum():
                    print(f"  ⚠ WARNING: Collection ID '{collection_id_value}' has unusual format!")
                    print(f"     Expected: 15 alphanumeric characters")
                    print(f"     Got: {len(collection_id_value)} characters")
                else:
                    print(f"  ✓ Collection ID format looks valid")
        
        # Send PATCH request with json= parameter (httpx handles JSON encoding correctly)
        response = await client.patch(
            f"{POCKETBASE_URL}/api/collections/{collection_id}",
            json=patch_data,  # Use json= to ensure proper JSON encoding
            headers=headers,
        )
        
        if response.status_code == 200:
            success_count += 1
            updated = response.json()
            existing_fields = updated.get("fields", [])
            print(f"  ✓ Added field: {field.get('name')}")
        else:
            print(f"  ✗ Failed to add field '{field.get('name')}': {response.status_code} - {response.text}")
            # Continue with next field even if one fails
    
    if success_count > 0:
        # Final verification
        response = await client.get(
            f"{POCKETBASE_URL}/api/collections/{collection_id}",
            headers=headers,
        )
        if response.status_code == 200:
            final_data = response.json()
            final_fields = final_data.get("fields", [])
            print(f"  ✓ Total fields now: {len(final_fields)}")
            print(f"  ✓ Successfully added {success_count} out of {len(fields_to_add)} fields")
        return success_count > 0
    else:
        return False

async def main():
    """Add fields to collections"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Adding Schema Fields to PocketBase Collections")
        print("=" * 60)
        
        # Authenticate
        token = await authenticate_admin(client)
        print("✓ Authenticated\n")
        
        # Get collection IDs
        daily_editions_id = await get_collection_id(client, token, "daily_editions")
        articles_id = await get_collection_id(client, token, "articles")
        
        print(f"Daily editions collection ID: {daily_editions_id}")
        print(f"Articles collection ID: {articles_id}")
        
        print("Updating daily_editions fields...")
        # Update daily_editions fields
        daily_editions_fields = [
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
        await update_collection_fields(client, token, daily_editions_id, daily_editions_fields)
        
        print("\nUpdating articles fields...")
        # Update articles fields
        # Note: daily_editions_id is already the collection ID from get_collection_id()
        print(f"  Using daily_editions_id: {daily_editions_id} for relation field")
        
        # Add relation field FIRST (before other fields) - this might be required
        # NOTE: In PocketBase v0.36+, relation field properties must be at root level, NOT nested in "options"
        relation_field = {
            "name": "daily_edition_id",
            "type": "relation",
            "required": True,
            "collectionId": daily_editions_id,  # Direct property, not in options
            "cascadeDelete": True,
            "maxSelect": 1
        }
        
        # Try adding relation field separately first
        print("  Adding relation field first...")
        relation_success = await update_collection_fields(client, token, articles_id, [relation_field])
        
        articles_fields = [
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
        await update_collection_fields(client, token, articles_id, articles_fields)
        
        print("\n" + "=" * 60)
        print("✓ Fields added!")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

