#!/usr/bin/env python3
"""
Delete ALL articles from the PocketBase articles collection.
Uses page=1 repeatedly until empty so no records are missed (pagination-safe).
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from lib.pocketbase_client import PocketBaseClient


async def main():
    base_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    if not email or not password:
        print("Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in .env")
        return 1

    pb = PocketBaseClient(base_url=base_url)
    ok = await pb.authenticate_admin(email, password)
    if not ok:
        print("Failed to authenticate with PocketBase")
        return 1

    total = 0
    while True:
        batch = await pb.get_list("articles", page=1, per_page=100)
        if not batch:
            break
        for r in batch:
            if await pb.delete_record("articles", r["id"]):
                total += 1
        print(f"  Deleted batch of {len(batch)} (total: {total})")

    print(f"Done. Deleted {total} articles. Collection is empty.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
