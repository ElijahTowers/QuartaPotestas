#!/usr/bin/env python3
"""
Fix achievements collection: add missing schema fields and re-populate records.
Run when the achievements collection only has the id field.
"""
import os
import sys
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

from create_achievements_collection import ACHIEVEMENTS
from lib.pocketbase_client import PocketBaseClient

# Load .env before reading env vars
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


async def get_achievements_collection_id(client: httpx.AsyncClient, token: str) -> str | None:
    headers = {"Authorization": f"Bearer {token}"}
    # Try by name first
    resp = await client.get(f"{POCKETBASE_URL}/api/collections", headers=headers)
    if resp.status_code != 200:
        return None
    data = resp.json()
    items = data.get("items", [])
    for c in items:
        if c.get("name") == "achievements":
            return c.get("id")
    return None


async def add_fields_to_achievements(client: httpx.AsyncClient, token: str, collection_id: str) -> bool:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
    )
    if resp.status_code != 200:
        print(f"Failed to get collection: {resp.status_code}")
        return False
    collection_data = resp.json()
    fields = collection_data.get("fields", [])

    existing_names = {f.get("name") for f in fields if f.get("name")}
    to_add = [
        {"name": "achievement_id", "type": "text", "required": True, "unique": True, "options": {}},
        {"name": "name", "type": "text", "required": True, "options": {}},
        {"name": "description", "type": "text", "required": True, "options": {}},
        {
            "name": "category",
            "type": "select",
            "required": True,
            "values": ["publishing", "financial", "readers", "credibility", "factions", "shop", "streaks", "special", "general"],
            "options": {},
        },
        {
            "name": "rarity",
            "type": "select",
            "required": True,
            "values": ["common", "uncommon", "rare", "epic", "legendary"],
            "options": {},
        },
        {"name": "points", "type": "number", "required": True, "options": {}},
    ]
    new_fields = [f for f in to_add if f["name"] not in existing_names]
    if not new_fields:
        print("All fields already exist.")
        return True

    updated = {"fields": fields + new_fields}
    patch = await client.patch(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        json=updated,
        headers=headers,
    )
    if patch.status_code not in (200, 204):
        print(f"Failed to add fields: {patch.status_code} - {patch.text}")
        return False
    print(f"Added fields: {[f['name'] for f in new_fields]}")
    return True


async def main():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set")
        sys.exit(1)

    print("Fix achievements collection: add schema and re-populate")
    print("")

    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await authenticate(client)
        cid = await get_achievements_collection_id(client, token)
        if not cid:
            print("Achievements collection not found.")
            sys.exit(1)

        print("1. Adding missing schema fields...")
        if not await add_fields_to_achievements(client, token, cid):
            sys.exit(1)

        print("2. Deleting existing records (only id, no useful data)...")
        pb = PocketBaseClient(POCKETBASE_URL.rstrip("/"))
        await pb.authenticate_admin(ADMIN_EMAIL, ADMIN_PASSWORD)
        try:
            all_records = await pb.get_list("achievements", per_page=500)
            for r in all_records:
                await pb.delete_record("achievements", r["id"])
            print(f"   Deleted {len(all_records)} records.")
        except Exception as e:
            print(f"   Error deleting: {e}")
            await pb.close()
            sys.exit(1)

        print("3. Creating achievement records...")
        created = 0
        for a in ACHIEVEMENTS:
            data = {
                "achievement_id": a["id"],
                "name": a["name"],
                "description": a["description"],
                "category": a["category"],
                "rarity": a["rarity"],
                "points": a["points"],
            }
            try:
                res = await pb.create_record("achievements", data)
                if res:
                    created += 1
            except Exception as e:
                print(f"   Failed {a['id']}: {e}")
        await pb.close()

        print("")
        print(f"Done. Created {created} achievements.")


if __name__ == "__main__":
    asyncio.run(main())
