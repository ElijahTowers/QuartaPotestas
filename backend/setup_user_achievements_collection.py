#!/usr/bin/env python3
"""
Create the user_achievements collection in PocketBase via API.
Tracks which achievements each user has unlocked.
"""
import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")


async def authenticate(client: httpx.AsyncClient) -> str:
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code != 200:
        raise SystemExit(f"Auth failed: {response.status_code} - {response.text}")
    return response.json()["token"]


async def get_users_collection_id(client: httpx.AsyncClient, token: str) -> str | None:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{POCKETBASE_URL}/api/collections", headers=headers)
    if resp.status_code != 200:
        return None
    data = resp.json()
    items = data.get("items", [])
    for c in items:
        if c.get("name") == "users":
            return c.get("id")
    return None


async def main():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set")
        sys.exit(1)

    print("Setup user_achievements collection")
    print("")

    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await authenticate(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Check if collection already exists
        resp = await client.get(f"{POCKETBASE_URL}/api/collections", headers=headers)
        if resp.status_code != 200:
            print("Failed to list collections")
            sys.exit(1)
        items = resp.json().get("items", [])
        existing = [c for c in items if c.get("name") == "user_achievements"]

        if existing:
            print("user_achievements collection already exists")
            sys.exit(0)

        users_id = await get_users_collection_id(client, token)
        if not users_id:
            print("Could not find users collection")
            sys.exit(1)

        # Create collection with fields (PocketBase API uses "fields")
        payload = {
            "name": "user_achievements",
            "type": "base",
            "fields": [
                {"name": "user", "type": "relation", "required": True, "collectionId": users_id, "maxSelect": 1, "options": {}},
                {"name": "achievement_id", "type": "text", "required": True, "options": {}},
                {"name": "unlocked_at", "type": "date", "required": True, "options": {}},
            ],
        }
        create_resp = await client.post(
            f"{POCKETBASE_URL}/api/collections",
            json=payload,
            headers=headers,
        )

        if create_resp.status_code in (200, 201):
            print("Created user_achievements collection")
        else:
            print(f"Failed to create collection: {create_resp.status_code} - {create_resp.text}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
