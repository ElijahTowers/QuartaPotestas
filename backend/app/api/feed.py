"""
Public Feed API endpoints for viewing all scoops (articles)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import os
import httpx
import pytz

# Import auth dependencies
from app.api.auth import get_current_user, get_auth_headers
from app.utils.date_format import format_datetime_dutch, format_date_dutch

router = APIRouter(prefix="/feed", tags=["feed"])

# Dutch timezone
DUTCH_TZ = pytz.timezone("Europe/Amsterdam")


class ScoopResponse(BaseModel):
    """Response model for a scoop (article)"""
    id: str
    original_title: str
    processed_variants: dict
    tags: dict
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    location_city: Optional[str] = None
    date: str
    published_at: Optional[str] = None
    created: Optional[str] = None
    assistant_comment: Optional[str] = None
    audience_scores: Optional[dict] = None


class FeedResponse(BaseModel):
    """Response model for the feed endpoint"""
    items: List[ScoopResponse]
    total: int


@router.get("", response_model=FeedResponse)
async def get_feed(
    headers: Dict[str, str] = Depends(get_auth_headers),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get all scoops (articles) from the public feed (requires authentication).
    
    Returns unique scoops published between yesterday 18:00 and now (Dutch timezone).
    If it's before 18:00 today, returns articles from [yesterday 18:00, today 18:00).
    If it's after 18:00 today, returns articles from [yesterday 18:00, now] to include today's new articles.
    All authenticated users see the same shared feed.
    """
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    
    try:
        # Calculate time range: gisteren 18:00 tot nu (Nederlandse tijdzone)
        # Include articles from yesterday 18:00 onwards, including all of today
        now_dutch = datetime.now(DUTCH_TZ)
        today_18 = now_dutch.replace(hour=18, minute=0, second=0, microsecond=0)
        yesterday_18 = today_18 - timedelta(days=1)
        
        # If it's after 18:00 today, include all of today's articles
        # Otherwise, use the standard window (yesterday 18:00 to today 18:00)
        if now_dutch >= today_18:
            # After 18:00 today - include all articles from yesterday 18:00 to now
            time_cutoff = now_dutch
        else:
            # Before 18:00 today - use standard window
            time_cutoff = today_18
        
        # Convert to UTC for comparison (PocketBase stores in UTC)
        yesterday_18_utc = yesterday_18.astimezone(pytz.UTC)
        time_cutoff_utc = time_cutoff.astimezone(pytz.UTC)
        
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Fetch all articles (we'll filter in Python since created field may not be filterable)
            response = await client.get(
                "/api/collections/articles/records",
                params={
                    "perPage": 500,       # Get up to 500 records
                    "sort": "-published_at",  # Sort by published_at descending (newest first)
                },
                headers=headers,
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                # Filter by time range in Python
                # Filter: published between yesterday 18:00 and today 18:00 (Dutch timezone)
                filtered_items = []
                today_date = now_dutch.date()
                yesterday_date = (now_dutch - timedelta(days=1)).date()
                
                for item in items:
                    # Try published_at first (most accurate)
                    item_published = item.get("published_at")
                    if item_published:
                        try:
                            # Parse published_at to datetime
                            if item_published.endswith('Z'):
                                item_dt = datetime.fromisoformat(item_published.replace('Z', '+00:00'))
                            elif ' UTC' in item_published:
                                item_dt = datetime.strptime(item_published.replace(' UTC', ''), "%Y-%m-%d %H:%M:%S")
                                item_dt = pytz.UTC.localize(item_dt)
                            elif isinstance(item_published, str) and 'T' in item_published:
                                item_dt = datetime.fromisoformat(item_published)
                                if item_dt.tzinfo is None:
                                    item_dt = pytz.UTC.localize(item_dt)
                            else:
                                # Try parsing as date string
                                item_dt = datetime.strptime(str(item_published).split('T')[0], "%Y-%m-%d")
                                item_dt = pytz.UTC.localize(item_dt.replace(hour=12, minute=0))
                            
                            # Convert to Dutch timezone for comparison
                            item_dt_dutch = item_dt.astimezone(DUTCH_TZ)
                            
                            # Check if within time range: gisteren 18:00 tot nu
                            # This means: yesterday 18:00 <= published_at <= now (or today 18:00 if before 18:00)
                            if yesterday_18 <= item_dt_dutch <= time_cutoff:
                                filtered_items.append(item)
                        except Exception as e:
                            # If parsing fails, try date field as fallback
                            item_date_str = item.get("date")
                            if item_date_str:
                                try:
                                    # Parse date field (can be "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS.000Z")
                                    if 'T' in str(item_date_str) or ' ' in str(item_date_str):
                                        date_part = str(item_date_str).split('T')[0].split(' ')[0]
                                    else:
                                        date_part = str(item_date_str)
                                    item_date = datetime.strptime(date_part, "%Y-%m-%d").date()
                                    # Include if date is today or yesterday
                                    if item_date in [today_date, yesterday_date]:
                                        filtered_items.append(item)
                                except:
                                    pass
                    else:
                        # No published_at, use date field
                        item_date_str = item.get("date")
                        if item_date_str:
                            try:
                                # Parse date field
                                if 'T' in str(item_date_str) or ' ' in str(item_date_str):
                                    date_part = str(item_date_str).split('T')[0].split(' ')[0]
                                else:
                                    date_part = str(item_date_str)
                                item_date = datetime.strptime(date_part, "%Y-%m-%d").date()
                                # Include if date is today or yesterday
                                if item_date in [today_date, yesterday_date]:
                                    filtered_items.append(item)
                            except:
                                # If date parsing fails, include it (better to show than hide)
                                filtered_items.append(item)
                        else:
                            # No date info, include it
                            filtered_items.append(item)
                
                # Ensure uniqueness by ID (remove duplicates)
                seen_ids = set()
                unique_items = []
                for item in filtered_items:
                    item_id = item.get("id")
                    if item_id and item_id not in seen_ids:
                        seen_ids.add(item_id)
                        unique_items.append(item)
                
                # Parse JSON fields
                import json
                scoops = []
                for item in unique_items:
                    # Parse processed_variants and tags (can be string or dict)
                    processed_variants = item.get("processed_variants", {})
                    if isinstance(processed_variants, str):
                        try:
                            processed_variants = json.loads(processed_variants)
                        except:
                            processed_variants = {}
                    
                    tags = item.get("tags", {})
                    if isinstance(tags, str):
                        try:
                            tags = json.loads(tags)
                        except:
                            tags = {}
                    
                    # Parse audience_scores (can be string or dict)
                    audience_scores = item.get("audience_scores", {})
                    if isinstance(audience_scores, str):
                        try:
                            audience_scores = json.loads(audience_scores)
                        except:
                            audience_scores = {}
                    if not isinstance(audience_scores, dict):
                        audience_scores = {}
                    
                    scoops.append(ScoopResponse(
                        id=item.get("id", ""),
                        original_title=item.get("original_title", ""),
                        processed_variants=processed_variants,
                        tags=tags,
                        location_lat=item.get("location_lat"),
                        location_lon=item.get("location_lon"),
                        location_city=item.get("location_city"),
                        date=format_date_dutch(item.get("date", "")),
                        published_at=format_datetime_dutch(item.get("published_at")),
                        created=format_datetime_dutch(item.get("created")),
                        assistant_comment=item.get("assistant_comment"),
                        audience_scores=audience_scores if audience_scores else None,
                    ))
                
                return FeedResponse(
                    items=scoops,
                    total=len(scoops),
                )
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_message = error_data.get("message", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch feed: {error_message}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

