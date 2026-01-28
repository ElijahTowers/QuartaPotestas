"""
Articles API endpoints for PocketBase.
"""
from fastapi import APIRouter, HTTPException
from datetime import date, datetime
from typing import List
from pydantic import BaseModel
import os
import sys
import json

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient
from app.utils.date_format import format_datetime_dutch, format_date_dutch

router = APIRouter(prefix="/articles", tags=["articles"])

# Global PocketBase client (initialized on first use)
_pb_client: PocketBaseClient | None = None


async def get_pb_client() -> PocketBaseClient:
    """Get or create PocketBase client"""
    global _pb_client
    if _pb_client is None:
        _pb_client = PocketBaseClient()
        # Load from .env file
        from dotenv import load_dotenv
        load_dotenv()
        
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


class ArticleResponse(BaseModel):
    id: str  # PocketBase uses string IDs
    original_title: str
    processed_variants: dict
    tags: dict
    location_lat: float | None
    location_lon: float | None
    location_city: str | None
    date: str
    published_at: str | None


class DailyEditionResponse(BaseModel):
    id: str  # PocketBase uses string IDs
    date: str
    global_mood: str | None
    articles: List[ArticleResponse]


def parse_json_field(value: str | dict) -> dict:
    """Parse JSON field from PocketBase (can be string or dict)"""
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except:
            return {}
    return {}


@router.get("/today", response_model=DailyEditionResponse)
async def get_today_articles():
    """Get today's daily edition with all articles from PocketBase."""
    today = date.today()
    pb = await get_pb_client()
    
    # Find today's edition
    # PocketBase filter syntax uses single quotes
    editions = await pb.get_list(
        "daily_editions",
        filter=f"date = '{today.isoformat()}'",
    )
    
    if not editions:
        raise HTTPException(status_code=404, detail="No daily edition found for today")
    
    edition = editions[0]
    edition_id = edition["id"]
    
    # Get articles for this edition
    # PocketBase filter syntax: use single quotes for relation IDs
    articles = await pb.get_list(
        "articles",
        filter=f"daily_edition_id = '{edition_id}'",
        sort="-published_at",
    )
    
    # Map PocketBase records to ArticleResponse
    article_responses = []
    for article in articles:
        article_responses.append(ArticleResponse(
            id=article["id"],
            original_title=article["original_title"],
            processed_variants=parse_json_field(article.get("processed_variants", {})),
            tags=parse_json_field(article.get("tags", {})),
            location_lat=article.get("location_lat"),
            location_lon=article.get("location_lon"),
            location_city=article.get("location_city"),
            date=format_date_dutch(article.get("date", edition.get("date", ""))),
            published_at=format_datetime_dutch(article.get("published_at")),
        ))
    
    return DailyEditionResponse(
        id=edition.get("id", ""),
        date=format_date_dutch(edition.get("date", "")),
        global_mood=edition.get("global_mood"),
        articles=article_responses,
    )


@router.get("/latest", response_model=DailyEditionResponse)
async def get_latest_edition():
    """Get the latest daily edition with all articles from PocketBase."""
    try:
        pb = await get_pb_client()
        
        # Get latest edition (sorted by date descending)
        # Get all editions and sort manually if needed
        editions = await pb.get_list(
            "daily_editions",
            per_page=100,  # Get more to find the latest
        )
        
        if not editions:
            # Debug: try without filter to see if we can connect
            raise HTTPException(
                status_code=404, 
                detail=f"No daily edition found. Total editions in DB: {len(editions)}"
            )
        
        # Sort by created timestamp (newest first) since date field might be empty
        # PocketBase IDs are time-ordered, so we can also sort by ID
        editions.sort(key=lambda x: x.get("created") or x.get("id") or "", reverse=True)
        edition = editions[0]
        
        print(f"DEBUG: Selected edition {edition.get('id')} with date={edition.get('date')}, created={edition.get('created')}")
        print(f"DEBUG: All editions: {[(e.get('id'), e.get('date'), e.get('created')) for e in editions]}")
        
        if not edition:
            raise HTTPException(status_code=404, detail="No daily edition found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching editions: {str(e)}")
    
    # Get edition ID - use the one we already selected
    edition_id = edition.get("id")
    if not edition_id:
        raise HTTPException(status_code=500, detail="Edition has no ID")
    
    # Get articles for this edition
    # PocketBase filter syntax: use single quotes for relation IDs
    articles = await pb.get_list(
        "articles",
        filter=f"daily_edition_id = '{edition_id}'",
        sort="-published_at",
        per_page=500,
    )
    
    print(f"DEBUG: Found {len(articles)} articles for edition {edition_id}")
    
    # Map PocketBase records to ArticleResponse
    article_responses = []
    for article in articles:
        article_responses.append(ArticleResponse(
            id=article["id"],
            original_title=article["original_title"],
            processed_variants=parse_json_field(article.get("processed_variants", {})),
            tags=parse_json_field(article.get("tags", {})),
            location_lat=article.get("location_lat"),
            location_lon=article.get("location_lon"),
            location_city=article.get("location_city"),
            date=format_date_dutch(article.get("date", edition.get("date", ""))),
            published_at=format_datetime_dutch(article.get("published_at")),
        ))
    
    return DailyEditionResponse(
        id=edition.get("id", ""),
        date=format_date_dutch(edition.get("date", "")),
        global_mood=edition.get("global_mood"),
        articles=article_responses,
    )

