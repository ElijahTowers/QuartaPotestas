#!/usr/bin/env python3
"""
Delete articles and editions from yesterday 18:00 Dutch time onwards.
Matches the RSS window: gisteren 18:00 t/m nu.
"""
import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

try:
    import pytz
    DUTCH_TZ = pytz.timezone("Europe/Amsterdam")
except ImportError:
    DUTCH_TZ = None

from lib.pocketbase_client import PocketBaseClient


async def main():
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

    # Yesterday and today (RSS window: yesterday 18:00 -> now)
    if DUTCH_TZ:
        now = datetime.now(DUTCH_TZ)
    else:
        now = datetime.now()
    yesterday = (now - timedelta(days=1)).date()
    today = now.date()
    dates_to_delete = [yesterday.isoformat(), today.isoformat()]

    deleted_articles = 0
    deleted_editions = 0

    # Fetch all editions and filter by date (PB date format: "2026-02-16 00:00:00.000Z")
    all_editions = []
    page = 1
    while True:
        batch = await pb.get_list("daily_editions", page=page, per_page=100)
        if not batch:
            break
        all_editions.extend(batch)
        if len(batch) < 100:
            break
        page += 1

    for ed in all_editions:
        ed_date = (ed.get("date") or "")[:10]  # "2026-02-16"
        if ed_date not in dates_to_delete:
            continue
        edition_id = ed["id"]
        articles = await pb.get_list("articles", filter=f'daily_edition_id = "{edition_id}"')
        for a in articles:
            await pb.delete_record("articles", a["id"])
            deleted_articles += 1
        await pb.delete_record("daily_editions", edition_id)
        deleted_editions += 1

    print(f"Deleted {deleted_articles} articles and {deleted_editions} editions (dates: {dates_to_delete}).")


if __name__ == "__main__":
    asyncio.run(main())
