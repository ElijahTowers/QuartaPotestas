#!/usr/bin/env python3
"""
Add publish_streak and last_publish_date to users collection in PocketBase.
Used for daily streak: consecutive days the user has published a newspaper.
"""
import httpx
import asyncio
import os
from pathlib import Path

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")


def load_env():
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()


async def main():
    load_env()
    email = os.getenv("POCKETBASE_ADMIN_EMAIL", ADMIN_EMAIL)
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD", ADMIN_PASSWORD)
    base = os.getenv("POCKETBASE_URL", POCKETBASE_URL)

    print("Adding publish_streak and last_publish_date to users collection\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{base}/api/collections/_superusers/auth-with-password",
            json={"identity": email, "password": password},
        )
        if r.status_code != 200:
            print(f"Auth failed: {r.text}")
            return
        token = r.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await client.get(f"{base}/api/collections/users", headers=headers)
        if r.status_code != 200:
            print(f"Failed to get users collection: {r.text}")
            return
        coll = r.json()
        existing = {f.get("name") for f in coll.get("fields", [])}

        to_add = []
        if "publish_streak" not in existing:
            to_add.append({
                "system": False, "id": "publish_streak_field", "name": "publish_streak",
                "type": "number", "required": False, "presentable": True,
                "indexable": False, "searchable": False,
                "options": {"min": None, "max": None, "noDecimal": True},
            })
        if "last_publish_date" not in existing:
            to_add.append({
                "system": False, "id": "last_publish_date_field", "name": "last_publish_date",
                "type": "text", "required": False, "presentable": True,
                "indexable": True, "searchable": False,
                "options": {"min": None, "max": 10},
            })

        if not to_add:
            print("Fields already exist.")
            return
        coll["fields"].extend(to_add)
        r = await client.patch(f"{base}/api/collections/users", json=coll, headers=headers)
        if r.status_code == 200:
            print("Added:", [f["name"] for f in to_add])
        else:
            print(f"Update failed: {r.status_code} {r.text}")


if __name__ == "__main__":
    asyncio.run(main())
