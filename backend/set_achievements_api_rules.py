#!/usr/bin/env python3
"""
Set API rules for achievements and user_achievements so the frontend hub can fetch them.
- achievements: any authenticated user can list (read-only)
- user_achievements: users can list/view only their own records
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import httpx


async def main():
    base_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090").rstrip("/")
    email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    if not email or not password:
        print("Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in .env")
        return 1

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        r = await client.post(
            "/api/collections/_superusers/auth-with-password",
            json={"identity": email, "password": password},
        )
        if r.status_code != 200:
            print("Auth failed")
            return 1
        token = r.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        for name, list_rule in [
            ("achievements", '@request.auth.id != ""'),  # Any authenticated user can list
            ("user_achievements", "user = @request.auth.id"),  # Users see only their own
        ]:
            resp = await client.get(f"/api/collections/{name}", headers=headers)
            if resp.status_code != 200:
                print(f"  {name}: collection not found")
                continue
            data = resp.json()
            data["listRule"] = list_rule
            data["viewRule"] = list_rule
            patch = await client.patch(
                f"/api/collections/{data['id']}",
                json={"listRule": list_rule, "viewRule": list_rule},
                headers=headers,
            )
            if patch.status_code in (200, 204):
                print(f"  {name}: listRule set")
            else:
                print(f"  {name}: failed {patch.status_code}")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
