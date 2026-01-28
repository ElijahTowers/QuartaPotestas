#!/usr/bin/env python3
"""
Fix API rules for development - allow public access or admin access
This allows the frontend to fetch data without authentication
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


async def fix_api_rules():
    """Set API rules to allow public access for development"""
    async with httpx.AsyncClient(base_url=POCKETBASE_URL, timeout=30.0) as client:
        # Authenticate
        response = await client.post(
            "/api/collections/_superusers/auth-with-password",
            json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        collections = ["daily_editions", "articles", "ads"]
        
        for collection_name in collections:
            # Get collection
            resp = await client.get(f"/api/collections/{collection_name}", headers=headers)
            if resp.status_code != 200:
                print(f"⚠️  {collection_name}: Collection not found")
                continue
            
            collection_data = resp.json()
            collection_id = collection_data["id"]
            
            # Set API rules to allow public access (for development)
            # In production, you'd want to use user-based rules
            collection_data["listRule"] = ""  # Public access
            collection_data["viewRule"] = ""  # Public access
            collection_data["createRule"] = ""  # Public access (or require auth in production)
            collection_data["updateRule"] = ""  # Public access (or require auth in production)
            collection_data["deleteRule"] = ""  # Public access (or require auth in production)
            
            # Update collection
            patch_resp = await client.patch(
                f"/api/collections/{collection_id}",
                json=collection_data,
                headers=headers,
            )
            
            if patch_resp.status_code == 200:
                print(f"✅ {collection_name}: API rules set to public access")
            else:
                print(f"❌ {collection_name}: Failed - {patch_resp.text[:200]}")


if __name__ == "__main__":
    print("=" * 60)
    print("Setting API Rules to Public Access (Development Mode)")
    print("=" * 60)
    print("⚠️  WARNING: This allows public access to all records!")
    print("   Use this only for development.\n")
    asyncio.run(fix_api_rules())
    print("\n✅ Done! Frontend should now be able to fetch data.")

