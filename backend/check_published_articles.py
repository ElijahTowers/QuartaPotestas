#!/usr/bin/env python3
"""
Script to check published articles for a specific user account.
Shows which articles were published and counts them by country.
"""
import asyncio
import httpx
import json
import os
from typing import Dict, List, Set
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
POCKETBASE_ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
POCKETBASE_ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")


async def authenticate_admin(client: httpx.AsyncClient) -> str:
    """Authenticate as admin and return token"""
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={
            "identity": POCKETBASE_ADMIN_EMAIL,
            "password": POCKETBASE_ADMIN_PASSWORD,
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to authenticate: {response.status_code} - {response.text}")
    
    data = response.json()
    return data.get("token", "")


async def get_user_by_email(client: httpx.AsyncClient, token: str, email: str) -> Dict:
    """Get user by email"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/users/records",
        params={"filter": f'email="{email}"'},
        headers=headers,
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to get user: {response.status_code} - {response.text}")
    
    data = response.json()
    items = data.get("items", [])
    
    if not items:
        raise Exception(f"User with email {email} not found")
    
    return items[0]


async def get_published_editions(client: httpx.AsyncClient, token: str, user_id: str) -> List[Dict]:
    """Get all published editions for a user"""
    headers = {"Authorization": f"Bearer {token}"}
    
    all_editions = []
    page = 1
    per_page = 500
    
    while True:
        response = await client.get(
            f"{POCKETBASE_URL}/api/collections/published_editions/records",
            params={
                "filter": f'user="{user_id}"',
                "perPage": per_page,
                "page": page,
            },
            headers=headers,
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to get published editions: {response.status_code} - {response.text}")
        
        data = response.json()
        items = data.get("items", [])
        
        if not items:
            break
        
        all_editions.extend(items)
        
        total_pages = data.get("totalPages", 1)
        if page >= total_pages:
            break
        
        page += 1
    
    return all_editions


async def get_articles_by_ids(client: httpx.AsyncClient, token: str, article_ids: Set[str]) -> Dict[str, Dict]:
    """Get articles by their IDs"""
    headers = {"Authorization": f"Bearer {token}"}
    
    articles = {}
    page = 1
    per_page = 500
    
    while True:
        response = await client.get(
            f"{POCKETBASE_URL}/api/collections/articles/records",
            params={
                "perPage": per_page,
                "page": page,
            },
            headers=headers,
        )
        
        if response.status_code != 200:
            break
        
        data = response.json()
        items = data.get("items", [])
        
        if not items:
            break
        
        for article in items:
            article_id = article.get("id", "")
            if article_id in article_ids:
                articles[article_id] = article
        
        total_pages = data.get("totalPages", 1)
        if page >= total_pages:
            break
        
        page += 1
    
    return articles


async def main():
    email = "lowiehartjes@gmail.com"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print(f"🔐 Authenticating as admin...")
        token = await authenticate_admin(client)
        print(f"✅ Authenticated\n")
        
        print(f"👤 Finding user: {email}")
        user = await get_user_by_email(client, token, email)
        user_id = user.get("id", "")
        user_name = user.get("name", "N/A")
        print(f"✅ Found user: {user_name} (ID: {user_id})\n")
        
        print(f"📰 Fetching published editions...")
        editions = await get_published_editions(client, token, user_id)
        print(f"✅ Found {len(editions)} published edition(s)\n")
        
        if not editions:
            print("❌ No published editions found for this user.")
            return
        
        # Extract article IDs from all editions
        published_article_ids: Set[str] = set()
        edition_info = []
        
        for edition in editions:
            edition_id = edition.get("id", "")
            newspaper_name = edition.get("newspaper_name", "Unnamed")
            created = edition.get("created", "")
            
            grid_layout = edition.get("grid_layout", {})
            
            # Handle stringified JSON
            if isinstance(grid_layout, str):
                try:
                    grid_layout = json.loads(grid_layout)
                except json.JSONDecodeError:
                    continue
            
            placed_items = grid_layout.get("placedItems", [])
            article_count = 0
            
            for item in placed_items:
                if not item.get("isAd", False) and item.get("articleId"):
                    article_id = item.get("articleId")
                    if article_id:
                        published_article_ids.add(str(article_id))
                        article_count += 1
            
            edition_info.append({
                "id": edition_id,
                "name": newspaper_name,
                "created": created,
                "article_count": article_count,
            })
        
        print(f"📊 Found {len(published_article_ids)} unique published article(s) across all editions\n")
        
        if not published_article_ids:
            print("❌ No articles found in published editions.")
            return
        
        print(f"📄 Fetching article details...")
        articles = await get_articles_by_ids(client, token, published_article_ids)
        print(f"✅ Fetched {len(articles)} article(s)\n")
        
        # Count by country
        country_counts = defaultdict(int)
        article_details = []
        
        for article_id, article in articles.items():
            title = article.get("original_title", "No title")
            country_code = article.get("country_code", "XX") or "XX"
            location_city = article.get("location_city", "Unknown")
            
            article_details.append({
                "id": article_id,
                "title": title,
                "country_code": country_code,
                "location_city": location_city,
            })
            
            if country_code and country_code != "" and country_code != "XX":
                country_counts[country_code] += 1
        
        # Print results
        print("=" * 80)
        print("📰 PUBLISHED EDITIONS SUMMARY")
        print("=" * 80)
        for i, edition in enumerate(edition_info, 1):
            print(f"{i}. {edition['name']} (ID: {edition['id']})")
            print(f"   Created: {edition['created']}")
            print(f"   Articles: {edition['article_count']}")
            print()
        
        print("=" * 80)
        print("📄 PUBLISHED ARTICLES")
        print("=" * 80)
        for i, article in enumerate(article_details, 1):
            print(f"{i}. {article['title']}")
            print(f"   Country Code: {article['country_code']}")
            print(f"   Location: {article['location_city']}")
            print(f"   ID: {article['id']}")
            print()
        
        print("=" * 80)
        print("🌍 COUNTRY COUNTS")
        print("=" * 80)
        if country_counts:
            sorted_counts = sorted(country_counts.items(), key=lambda x: x[1], reverse=True)
            for country_code, count in sorted_counts:
                print(f"{country_code}: {count} article(s)")
        else:
            print("No country codes found (all articles have 'XX' or empty country_code)")
        
        print("=" * 80)
        print(f"📊 TOTAL: {len(article_details)} article(s) published")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())

