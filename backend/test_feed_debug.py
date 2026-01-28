#!/usr/bin/env python3
"""
Debug script to check articles in PocketBase and test feed filtering
"""
import asyncio
import os
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv

load_dotenv()

from lib.pocketbase_client import PocketBaseClient

DUTCH_TZ = pytz.timezone("Europe/Amsterdam")


async def main():
    pb = PocketBaseClient()
    
    # Authenticate
    admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    
    if not admin_email or not admin_password:
        print("❌ POCKETBASE_ADMIN_EMAIL en POCKETBASE_ADMIN_PASSWORD moeten ingesteld zijn")
        return
    
    authenticated = await pb.authenticate_admin(admin_email, admin_password)
    if not authenticated:
        print("❌ Authenticatie mislukt")
        return
    
    print("✅ Authenticatie succesvol\n")
    
    # Get all articles
    print("=" * 60)
    print("ALLE ARTIKELEN IN DATABASE:")
    print("=" * 60)
    articles = await pb.get_list("articles", per_page=100)
    
    if not articles:
        print("⚠️  Geen artikelen gevonden in database!")
        print("\n💡 Tip: Voer eerst een ingest uit om artikelen te maken")
        return
    
    print(f"Totaal artikelen: {len(articles)}\n")
    
    # Show first 10 articles with their created timestamps
    for i, article in enumerate(articles[:10], 1):
        created = article.get("created", "")
        title = article.get("original_title", "Geen titel")[:50]
        print(f"{i}. {title}")
        print(f"   Created: {created}")
        print()
    
    # Calculate filter range
    print("=" * 60)
    print("FILTER BEREKENING:")
    print("=" * 60)
    now_dutch = datetime.now(DUTCH_TZ)
    today_18 = now_dutch.replace(hour=18, minute=0, second=0, microsecond=0)
    yesterday_18 = today_18 - timedelta(days=1)
    
    yesterday_18_utc = yesterday_18.astimezone(pytz.UTC)
    today_18_utc = today_18.astimezone(pytz.UTC)
    
    print(f"Nu (Nederland): {now_dutch.strftime('%d-%m-%Y %H:%M:%S')}")
    print(f"Gisteren 18:00 (Nederland): {yesterday_18.strftime('%d-%m-%Y %H:%M:%S')}")
    print(f"Vandaag 18:00 (Nederland): {today_18.strftime('%d-%m-%Y %H:%M:%S')}")
    print()
    print(f"Gisteren 18:00 (UTC): {yesterday_18_utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')}")
    print(f"Vandaag 18:00 (UTC): {today_18_utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')}")
    print()
    
    # Check which articles match the filter
    print("=" * 60)
    print("ARTIKELEN DIE AAN FILTER VOLDOEN:")
    print("=" * 60)
    
    matching = []
    for article in articles:
        created_str = article.get("created", "")
        if not created_str:
            continue
        
        try:
            # Parse created timestamp
            if created_str.endswith('Z'):
                created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
            elif ' UTC' in created_str:
                created_dt = datetime.fromisoformat(created_str.replace(' UTC', '+00:00'))
            else:
                created_dt = datetime.fromisoformat(created_str)
            
            if created_dt.tzinfo is None:
                created_dt = pytz.UTC.localize(created_dt)
            
            # Check if within range
            if yesterday_18_utc <= created_dt < today_18_utc:
                matching.append((article, created_dt))
        except Exception as e:
            print(f"⚠️  Fout bij parsen van created: {created_str} - {e}")
    
    if not matching:
        print("❌ Geen artikelen gevonden die aan het filter voldoen!")
        print("\n💡 Mogelijke oorzaken:")
        print("   - Artikelen zijn ouder dan gisteren 18:00")
        print("   - Artikelen zijn nieuwer dan vandaag 18:00")
        print("   - Er zijn nog geen artikelen aangemaakt vandaag")
    else:
        print(f"✅ {len(matching)} artikelen gevonden:\n")
        for article, created_dt in matching[:10]:
            title = article.get("original_title", "Geen titel")[:50]
            print(f"- {title}")
            print(f"  Created: {created_dt.strftime('%d-%m-%Y %H:%M:%S UTC')}")
    
    await pb.close()


if __name__ == "__main__":
    asyncio.run(main())

