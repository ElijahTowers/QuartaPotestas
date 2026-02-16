#!/usr/bin/env python3
"""
Delete the last N articles from PocketBase (by created date, newest first).
Usage: python scripts/delete_last_n_articles.py [N]
Default N=5.
"""
import os
import sys
import asyncio
from pathlib import Path

# Add parent to path for lib
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from lib.pocketbase_client import PocketBaseClient


async def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    pb = PocketBaseClient(base_url=os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090"))
    email = os.getenv("POCKETBASE_ADMIN_EMAIL")
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD")
    if not email or not password:
        print("ERROR: Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in .env")
        sys.exit(1)
    ok = await pb.authenticate_admin(email, password)
    if not ok:
        print("ERROR: Failed to authenticate with PocketBase")
        sys.exit(1)
    articles = await pb.get_list("articles", per_page=min(n * 2, 100))
    # Sort by created desc (newest first) and take first n
    articles.sort(key=lambda a: a.get("created", ""), reverse=True)
    articles = articles[:n]
    if not articles:
        print("No articles found.")
        return
    print(f"Deleting {len(articles)} article(s):")
    for a in articles:
        title = (a.get("original_title") or "?")[:50]
        print(f"  - {a['id']}: {title}...")
        await pb.delete_record("articles", a["id"])
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
