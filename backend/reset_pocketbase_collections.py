#!/usr/bin/env python3
"""
Reset PocketBase collections by deleting and recreating them
"""
import httpx
import asyncio
import os
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
    
    # First, get the collection ID
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
    
    collection_data = response.json()
    collection_id = collection_data.get("id")
    
    if not collection_id:
        print(f"✗ Collection '{collection_name}' has no ID")
        return False
    
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

async def main():
    """Delete all collections"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Resetting PocketBase Collections")
        print("=" * 60)
        
        # Authenticate
        token = await authenticate_admin(client)
        print("✓ Authenticated\n")
        
        # Delete collections in reverse order (to handle relations)
        collections_to_delete = ["ads", "articles", "daily_editions"]
        
        for collection_name in collections_to_delete:
            await delete_collection(client, token, collection_name)
        
        print("\n" + "=" * 60)
        print("✓ Reset complete!")
        print("=" * 60)
        print("\nNow run: python3 setup_pocketbase_collections.py\n")

if __name__ == "__main__":
    asyncio.run(main())

