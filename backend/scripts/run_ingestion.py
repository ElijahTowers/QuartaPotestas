#!/usr/bin/env python3
"""
Run ingestion directly (bypasses HTTP/API). Uses IngestionServicePB.
"""
import os
import sys
import asyncio
from pathlib import Path

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
    service = IngestionServicePB(pb)
    print("Running ingestion...")
    result = await service.ingest_daily_articles(on_step=lambda s: print(f"  {s}"))
    print(f"Done. Result: {result}")


if __name__ == "__main__":
    asyncio.run(main())
