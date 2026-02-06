#!/usr/bin/env python3
"""
Add source_url field to the articles collection for incremental RSS ingest.
Run once: python add_source_url_to_articles.py
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


async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await authenticate(client)
        headers = {"Authorization": f"Bearer {token}"}
        # Get articles collection (by name if supported, else list and find)
        get_resp = await client.get(f"{POCKETBASE_URL}/api/collections/articles", headers=headers)
        if get_resp.status_code != 200:
            list_resp = await client.get(f"{POCKETBASE_URL}/api/collections", headers=headers)
            if list_resp.status_code != 200:
                print(f"Failed to get collections: {list_resp.status_code}")
                return
            data = list_resp.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            if isinstance(items, dict):
                items = items.get("items", [])
            collection_id = None
            for c in (items or []):
                if isinstance(c, dict) and c.get("name") == "articles":
                    collection_id = c.get("id")
                    break
            if not collection_id:
                print("Could not find articles collection")
                return
        else:
            collection_id = get_resp.json()["id"]
        resp = await client.get(f"{POCKETBASE_URL}/api/collections/{collection_id}", headers=headers)
        if resp.status_code != 200:
            print("Could not get articles collection")
            return
        collection_data = resp.json()
        fields = collection_data.get("fields", [])
        if any(f.get("name") == "source_url" for f in fields):
            print("Field source_url already exists on articles.")
            return
        updated = {"fields": fields + [{"name": "source_url", "type": "url", "required": False, "options": {}}]}
        patch = await client.patch(
            f"{POCKETBASE_URL}/api/collections/{collection_id}",
            json=updated,
            headers=headers,
        )
        if patch.status_code in (200, 204):
            print("Added source_url to articles collection.")
        else:
            print(f"Failed to add field: {patch.status_code} - {patch.text}")


async def authenticate(client: httpx.AsyncClient) -> str:
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code != 200:
        raise SystemExit(f"Auth failed: {response.status_code} - {response.text}")
    return response.json()["token"]


if __name__ == "__main__":
    asyncio.run(main())
