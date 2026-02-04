#!/usr/bin/env python3
"""
Script to remove duplicate articles from the articles collection.
Keeps the oldest article (by date or created timestamp) and removes duplicates.
"""
import os
import sys
import asyncio
from collections import defaultdict

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.pocketbase_client import PocketBaseClient
from dotenv import load_dotenv


async def remove_duplicates():
    """Remove duplicate articles, keeping the oldest one"""
    pb_client = PocketBaseClient()
    
    # Get admin credentials from environment
    admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    
    if not admin_email or not admin_password:
        print("❌ ERROR: POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment")
        return False
    
    print(f"🔐 Authenticating as admin: {admin_email}")
    authenticated = await pb_client.authenticate_admin(admin_email, admin_password)
    
    if not authenticated:
        print("❌ ERROR: Failed to authenticate with PocketBase admin credentials")
        return False
    
    print("✅ Admin authenticated successfully")
    print("")
    
    # Get all articles
    print("📥 Fetching all articles...")
    all_articles = []
    page = 1
    per_page = 500
    
    while True:
        articles = await pb_client.get_list("articles", page=page, per_page=per_page)
        if not articles:
            break
        all_articles.extend(articles)
        print(f"   Fetched page {page}: {len(articles)} articles (total: {len(all_articles)})")
        if len(articles) < per_page:
            break
        page += 1
    
    print(f"✅ Total articles fetched: {len(all_articles)}")
    print("")
    
    # Group by original_title
    print("🔍 Grouping articles by original_title...")
    articles_by_title = defaultdict(list)
    for article in all_articles:
        title = article.get("original_title", "").strip()
        if title:
            articles_by_title[title].append(article)
    
    # Find duplicates
    duplicates = {title: articles for title, articles in articles_by_title.items() if len(articles) > 1}
    
    if not duplicates:
        print("✅ No duplicate articles found!")
        await pb_client.close()
        return True
    
    print(f"⚠️  Found {len(duplicates)} titles with duplicates:")
    total_duplicates = sum(len(articles) - 1 for articles in duplicates.values())
    print(f"   Total duplicate articles to remove: {total_duplicates}")
    print("")
    
    # Show some examples
    print("📋 Example duplicates:")
    for idx, (title, articles) in enumerate(list(duplicates.items())[:5], 1):
        print(f"   {idx}. '{title[:60]}...' - {len(articles)} copies")
    if len(duplicates) > 5:
        print(f"   ... and {len(duplicates) - 5} more")
    print("")
    
    # Ask for confirmation
    response = input(f"🗑️  Remove {total_duplicates} duplicate articles? (yes/no): ")
    if response.lower() not in ["yes", "y"]:
        print("❌ Cancelled")
        await pb_client.close()
        return False
    
    # Remove duplicates (keep the oldest one)
    removed_count = 0
    kept_count = 0
    
    print("")
    print("🧹 Removing duplicates...")
    for title, articles in duplicates.items():
        # Sort by created timestamp (oldest first)
        # PocketBase uses 'created' field for timestamp
        articles_sorted = sorted(
            articles,
            key=lambda a: a.get("created", a.get("id", ""))
        )
        
        # Keep the first (oldest) one
        keep_article = articles_sorted[0]
        keep_id = keep_article["id"]
        kept_count += 1
        
        # Remove the rest
        for article in articles_sorted[1:]:
            article_id = article["id"]
            try:
                success = await pb_client.delete_record("articles", article_id)
                if success:
                    removed_count += 1
                    if removed_count % 10 == 0:
                        print(f"   Removed {removed_count} duplicates...")
                else:
                    print(f"   ⚠️  Failed to delete article {article_id}")
            except Exception as e:
                print(f"   ⚠️  Error deleting article {article_id}: {e}")
    
    print("")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"✅ Duplicate removal complete!")
    print(f"   Kept: {kept_count} articles (oldest of each duplicate)")
    print(f"   Removed: {removed_count} duplicate articles")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    await pb_client.close()
    return True


if __name__ == "__main__":
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🧹 Remove Duplicate Articles")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("")
    
    # Load environment variables from .env file
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded environment from: {env_path}")
    else:
        print(f"⚠️  No .env file found at: {env_path}")
        print("   Using system environment variables")
    print("")
    
    success = asyncio.run(remove_duplicates())
    
    print("")
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

