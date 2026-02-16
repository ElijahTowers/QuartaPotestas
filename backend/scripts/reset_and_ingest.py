#!/usr/bin/env python3
"""
Reset today's edition + articles, then run fresh ingestion (like POST /debug/reset-and-ingest).
"""
import os
import sys
import asyncio
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from lib.pocketbase_client import PocketBaseClient
from app.services.ingestion_service_pb import IngestionServicePB


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

    today = date.today()
    editions = await pb.get_list("daily_editions", filter=f'date = "{today.isoformat()}"')
    if editions:
        edition_id = editions[0]["id"]
        articles = await pb.get_list("articles", filter=f'daily_edition_id = "{edition_id}"')
        print(f"Deleting {len(articles)} articles and daily edition for {today}...")
        for a in articles:
            await pb.delete_record("articles", a["id"])
        await pb.delete_record("daily_editions", edition_id)
        print("Deleted.")
    else:
        print(f"No edition for {today} to delete.")

    await pb.ensure_articles_source_url_field()
    service = IngestionServicePB(pb)
    print("Running ingestion...")
    result = await service.ingest_daily_articles(on_step=lambda s: print(f"  {s}"))
    print(f"Done. Result: {result}")


if __name__ == "__main__":
    asyncio.run(main())
