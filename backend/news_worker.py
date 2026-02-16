#!/usr/bin/env python3
"""
RSS News Worker - Fetches RSS feeds, extracts full article text when possible,
and runs ingestion into PocketBase with AI-generated variants.

Uses full article text (via newspaper3k) when available for better AI context,
falls back to RSS summary if extraction fails.
"""
import os
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from lib.pocketbase_client import PocketBaseClient
from app.services.ingestion_service_pb import IngestionServicePB


async def run():
    """Run the ingestion pipeline (RSS → full text when possible → AI → PocketBase)."""
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
    print("News worker: running ingestion (full-text extraction enabled)...")
    result = await service.ingest_daily_articles(on_step=lambda s: print(f"  {s}"))
    print(f"Done. Result: {result}")


if __name__ == "__main__":
    asyncio.run(run())
