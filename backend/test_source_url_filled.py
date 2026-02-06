#!/usr/bin/env python3
"""
Test that source_url is present in PB articles collection and gets filled on ingest.
1. Add source_url to articles if missing (via API).
2. Run one ingest (fetch RSS, process new articles).
3. List recent articles and print source_url.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from lib.pocketbase_client import PocketBaseClient
from app.services.ingestion_service_pb import IngestionServicePB


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

    # 1) Check current articles for source_url (newest first)
    print("--- Artikelen in PB (nieuwste 5) ---")
    articles = await pb.get_list("articles", per_page=5, sort="-published_at")
    for i, a in enumerate(articles or [], 1):
        surl = a.get("source_url") or "(leeg)"
        title = (a.get("original_title") or "")[:50]
        print(f"  {i}. source_url: {surl}")
        print(f"     title: {title}...")
    if not articles:
        print("  Geen artikelen in PB.")

    # 2) Run ingest (will add source_url to new articles)
    print("\n--- Ingest uitvoeren (RSS fetch + nieuwe artikelen verwerken) ---")
    service = IngestionServicePB(pb)
    try:
        result = await service.ingest_daily_articles()
        print(f"  Status: {result.get('status')}")
        print(f"  Nieuwe artikelen verwerkt: {result.get('articles_processed', 0)}")
        print(f"  Overgeslagen (al in PB): {result.get('skipped_already_in_pb', 0)}")
    except Exception as e:
        print(f"  Fout bij ingest: {e}")
        return 1

    # 3) Check again: newest articles must have source_url
    print("\n--- Artikelen in PB na ingest (nieuwste 5) ---")
    articles2 = await pb.get_list("articles", per_page=5, sort="-published_at")
    filled = 0
    for i, a in enumerate(articles2 or [], 1):
        surl = a.get("source_url") or "(leeg)"
        title = (a.get("original_title") or "")[:50]
        if surl != "(leeg)":
            filled += 1
        print(f"  {i}. source_url: {surl}")
        print(f"     title: {title}...")
    print(f"\n  Totaal met source_url gevuld: {filled}/{len(articles2 or [])}")
    if filled == 0 and (articles2 or []):
        print("  WAARSCHUWING: Geen enkel artikel heeft source_url. Controleer of het veld in PB bestaat.")
        return 1
    print(f"\n  OK: source_url wordt bij fetchen gevuld ({filled} van {len(articles2 or [])} nieuwste hebben het).")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
