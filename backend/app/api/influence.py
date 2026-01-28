"""
Influence Map API - Returns country statistics for visualization.
Counts only articles that were actually published in user's newspapers.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Set
import os
import json
import sys

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient
from app.api.auth import get_current_user

router = APIRouter()

# Global PocketBase client (initialized on first use)
_pb_client: PocketBaseClient | None = None


async def get_pb_client() -> PocketBaseClient:
    """Get or create PocketBase client with admin authentication"""
    global _pb_client
    if _pb_client is None:
        _pb_client = PocketBaseClient()
        # Authenticate with admin credentials from environment
        admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
        admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
        
        if not admin_email or not admin_password:
            raise HTTPException(
                status_code=500,
                detail="POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment"
            )
        
        authenticated = await _pb_client.authenticate_admin(admin_email, admin_password)
        if not authenticated:
            raise HTTPException(
                status_code=500,
                detail="Failed to authenticate with PocketBase admin credentials"
            )
    
    return _pb_client


@router.get("/influence")
async def get_influence_stats(current_user: dict = Depends(get_current_user)) -> Dict[str, int]:
    """
    Get article counts by country code for the influence map.
    Only counts articles that were actually published in the user's newspapers.
    Returns a dictionary mapping country codes to article counts.
    
    Requires authentication.
    """
    try:
        # Use the user_id from current_user to filter published editions
        user_id = current_user.get("id")
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="User ID not found in authentication token"
            )
        
        # Get authenticated PocketBase client
        pb_client = await get_pb_client()
        
        # Step 1: Fetch all published_editions for this user
        try:
            editions = await pb_client.get_list(
                "published_editions",
                filter=f'user="{user_id}"',
                per_page=500,
            )
            print(f"[Influence] Found {len(editions)} published editions for user {user_id}")
        except Exception as e:
            print(f"[Influence] Error fetching published_editions: {e}")
            return {}
        
        # Step 2: Extract all unique article IDs from grid_layout.placedItems
        published_article_ids: Set[str] = set()
        
        for edition in editions:
            grid_layout = edition.get("grid_layout", {})
            
            # Handle stringified JSON
            if isinstance(grid_layout, str):
                try:
                    grid_layout = json.loads(grid_layout)
                except json.JSONDecodeError:
                    print(f"[Influence] Failed to parse grid_layout for edition {edition.get('id')}")
                    continue
            
            # Extract placedItems
            placed_items = grid_layout.get("placedItems", [])
            print(f"[Influence] Edition {edition.get('id')} has {len(placed_items)} placed items")
            
            for item in placed_items:
                # Only count articles (not ads)
                if not item.get("isAd", False) and item.get("articleId"):
                    article_id = item.get("articleId")
                    if article_id:
                        published_article_ids.add(str(article_id))
        
        print(f"[Influence] Found {len(published_article_ids)} unique published article IDs: {list(published_article_ids)[:10]}...")
        
        if not published_article_ids:
            # No published articles, return empty counts
            print("[Influence] No published article IDs found, returning empty counts")
            return {}
        
        # Step 3: Fetch the specific published articles
        # Fetch all articles and filter to only published ones
        all_articles = []
        try:
            all_articles_raw = await pb_client.get_list(
                "articles",
                per_page=500,
            )
            
            # Filter to only published articles
            for article in all_articles_raw:
                article_id = article.get("id", "")
                if article_id in published_article_ids:
                    all_articles.append(article)
                    print(f"[Influence] Found published article: {article_id} - {article.get('original_title', 'No title')[:50]} - country_code: {article.get('country_code', 'XX')}")
        except Exception as e:
            print(f"[Influence] Error fetching articles: {e}")
            import traceback
            traceback.print_exc()
        
        print(f"[Influence] Total published articles found: {len(all_articles)}")
        
        # Step 4: Aggregate by country code
        counts: Dict[str, int] = {}
        for article in all_articles:
            country_code = article.get("country_code", "XX") or "XX"
            print(f"[Influence] Article {article.get('id')}: country_code={country_code}")
            if country_code and country_code != "" and country_code != "XX":
                counts[country_code] = counts.get(country_code, 0) + 1
        
        print(f"[Influence] Final counts: {counts}")
        return counts
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching influence stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch influence statistics: {str(e)}"
        )

