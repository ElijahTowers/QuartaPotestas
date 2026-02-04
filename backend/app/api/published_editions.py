"""
Published Editions API endpoints
Handles saving and retrieving user-published newspaper editions
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import sys
import json

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient, serialize_for_pb
from app.api.auth import get_current_user
from app.utils.date_format import format_datetime_dutch, format_date_dutch

router = APIRouter(prefix="/published-editions", tags=["published-editions"])

# Global PocketBase client (initialized on first use)
_pb_client: PocketBaseClient | None = None


async def get_pb_client() -> PocketBaseClient:
    """Get or create PocketBase client"""
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
    
    # Always verify admin token is still valid, re-authenticate if needed
    if not _pb_client.admin_token:
        admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
        admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
        if admin_email and admin_password:
            authenticated = await _pb_client.authenticate_admin(admin_email, admin_password)
            if not authenticated:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to re-authenticate with PocketBase admin credentials"
                )
    
    return _pb_client


# Request/Response Models
class PublishStats(BaseModel):
    cash: float
    credibility: float
    readers: int


class GridPlacement(BaseModel):
    articleId: str | None  # Changed from int to str for PocketBase IDs
    variant: str | None  # "factual", "sensationalist", "propaganda"
    isAd: bool
    adId: str | None  # Changed from int to str
    headline: str | None = None  # NEW: Store displayed headline
    body: str | None = None  # NEW: Store displayed body text
    row: int | None = None  # Row number: 1, 2, or 3
    position: int | None = None  # Position within row: 0, 1, or 2


class PublishRequest(BaseModel):
    stats: PublishStats
    placedItems: List[GridPlacement]
    newspaper_name: Optional[str] = None


class PublishedEditionResponse(BaseModel):
    id: str
    user: str
    date: str
    newspaper_name: Optional[str] = None
    grid_layout: Dict[str, Any]
    stats: Dict[str, Any]
    published_at: str
    created: Optional[str] = None
    updated: Optional[str] = None


class TransactionResponse(BaseModel):
    date: str
    description: str
    amount: float
    type: str  # "income" or "expense"


class LeaderboardEntry(BaseModel):
    rank: int
    edition_id: str
    newspaper_name: str
    user_email: str
    profit: float
    readers: int
    credibility: float
    date: str


class PublicPublishedItem(BaseModel):
    type: str  # "article" | "ad"
    headline: str
    body: str
    variant: Optional[str] = None
    source: Optional[str] = None
    location: Optional[str] = None
    row: Optional[int] = None  # Row number: 1, 2, or 3
    position: Optional[int] = None  # Position within row: 0, 1, or 2


class PublicEditionResponse(BaseModel):
    id: str
    newspaper_name: str
    date: str
    published_at: str
    stats: Dict[str, Any]
    published_items: List[PublicPublishedItem]
    username: Optional[str] = None


@router.post("", response_model=PublishedEditionResponse)
async def publish_edition(
    request: PublishRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Publish a newspaper edition and save it to PocketBase.
    
    Requires authentication.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in authentication token"
        )
    
    try:
        pb_client = await get_pb_client()
        
        # Prepare data for PocketBase
        now = datetime.now()
        edition_data = serialize_for_pb({
            "user": user_id,
            "date": now.date().isoformat(),
            "newspaper_name": request.newspaper_name or "Untitled Edition",
            "grid_layout": {
                "placedItems": [item.dict() for item in request.placedItems]
            },
            "stats": {
                "cash": request.stats.cash,
                "credibility": request.stats.credibility,
                "readers": request.stats.readers,
            },
            "published_at": now.isoformat(),
        })
        
        # Convert JSON fields to strings for PocketBase
        edition_data["grid_layout"] = json.dumps(edition_data["grid_layout"])
        edition_data["stats"] = json.dumps(edition_data["stats"])
        
        # Create record in PocketBase
        published_edition = await pb_client.create_record("published_editions", edition_data)
        
        # Update user's game state (readers, credibility, and treasury) from published edition stats
        if published_edition:
            try:
                # Get current user record to get existing treasury
                user_record = await pb_client.get_record_by_id("users", user_id)
                current_treasury = 0.0
                if user_record:
                    current_treasury = float(user_record.get("treasury", 0.0) or 0.0)
                
                # Treasury is cumulative: add cash from this edition to existing treasury
                new_treasury = current_treasury + request.stats.cash
                
                # Update user record with latest stats
                await pb_client.update_record(
                    "users",
                    user_id,
                    {
                        "readers": request.stats.readers,
                        "credibility": request.stats.credibility,
                        "treasury": new_treasury,  # Cumulative treasury
                    }
                )
            except Exception as e:
                # Log error but don't fail the publish
                print(f"Warning: Failed to update user game state: {e}")
        
        if not published_edition:
            raise HTTPException(
                status_code=500,
                detail="Failed to create published edition in PocketBase"
            )
        
        # Parse JSON fields back for response
        published_edition["grid_layout"] = json.loads(published_edition.get("grid_layout", "{}"))
        published_edition["stats"] = json.loads(published_edition.get("stats", "{}"))
        
        return PublishedEditionResponse(
            id=published_edition.get("id", ""),
            user=published_edition.get("user", user_id),
            date=format_date_dutch(published_edition.get("date", "")),
            newspaper_name=published_edition.get("newspaper_name"),
            grid_layout=published_edition.get("grid_layout", {}),
            stats=published_edition.get("stats", {}),
            published_at=format_datetime_dutch(published_edition.get("published_at")),
            created=format_datetime_dutch(published_edition.get("created")),
            updated=format_datetime_dutch(published_edition.get("updated")),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to publish edition: {str(e)}"
        )


@router.get("", response_model=List[PublishedEditionResponse])
async def get_user_publications(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all published editions for the current user.
    
    Requires authentication.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in authentication token"
        )
    
    try:
        pb_client = await get_pb_client()
        
        # Get all published editions for this user
        editions = await pb_client.get_list(
            "published_editions",
            filter=f'user = "{user_id}"',
            sort="-published_at",
            per_page=100
        )
        
        # Parse JSON fields and format dates
        result = []
        for edition in editions:
            # Parse JSON fields
            grid_layout = edition.get("grid_layout", "{}")
            stats = edition.get("stats", "{}")
            
            if isinstance(grid_layout, str):
                try:
                    grid_layout = json.loads(grid_layout)
                except:
                    grid_layout = {}
            
            if isinstance(stats, str):
                try:
                    stats = json.loads(stats)
                except:
                    stats = {}
            
            result.append(PublishedEditionResponse(
                id=edition.get("id", ""),
                user=edition.get("user", user_id),
                date=format_date_dutch(edition.get("date", "")),
                newspaper_name=edition.get("newspaper_name"),
                grid_layout=grid_layout,
                stats=stats,
                published_at=format_datetime_dutch(edition.get("published_at")),
                created=format_datetime_dutch(edition.get("created")),
                updated=format_datetime_dutch(edition.get("updated")),
            ))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch published editions: {str(e)}"
        )


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    """
    Get the top 5 published newspapers with highest profit from the latest available day.
    Public endpoint (no authentication required).
    Uses admin authentication to access PocketBase data.
    """
    try:
        # Ensure admin authentication is set up
        pb_client = await get_pb_client()

        # Verify admin token is available
        if not pb_client.admin_token:
            # Try to re-authenticate
            admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
            admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
            if not admin_email or not admin_password:
                raise HTTPException(
                    status_code=500,
                    detail="POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment"
                )
            authenticated = await pb_client.authenticate_admin(admin_email, admin_password)
            if not authenticated:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to authenticate with PocketBase admin credentials"
                )

        # Get all published editions, sorted by date descending
        all_editions = await pb_client.get_list(
            "published_editions",
            per_page=500,
            sort="-date,-published_at",
        )

        if not all_editions:
            return []

        # Find the latest date (most recent day with publications)
        # Since editions are sorted by -date, the first edition has the latest date
        latest_date = None
        for edition in all_editions:
            edition_date = edition.get("date")
            if edition_date:
                latest_date = edition_date
                break  # Since sorted descending, first one is latest

        if not latest_date:
            return []

        # Filter editions from the latest date
        latest_day_editions = []
        for edition in all_editions:
            if edition.get("date") == latest_date:
                # Parse stats
                stats = edition.get("stats", "{}")
                if isinstance(stats, str):
                    try:
                        stats = json.loads(stats)
                    except Exception:
                        stats = {}

                cash = stats.get("cash", 0.0) or 0.0
                readers = stats.get("readers", 0) or 0
                credibility = stats.get("credibility", 0.0) or 0.0

                # Get user email
                user_id = edition.get("user", "")
                user_email = "Unknown"
                if user_id:
                    try:
                        user_record = await pb_client.get_record_by_id("users", user_id)
                        if user_record:
                            user_email = user_record.get("email", "Unknown")
                    except Exception:
                        pass  # If user not found, use "Unknown"

                latest_day_editions.append({
                    "edition_id": edition.get("id", ""),
                    "newspaper_name": edition.get("newspaper_name", "Untitled"),
                    "user_email": user_email,
                    "profit": cash,
                    "readers": readers,
                    "credibility": credibility,
                    "date": latest_date,
                })

        # Sort by profit (cash) descending
        latest_day_editions.sort(key=lambda x: x["profit"], reverse=True)

        # Get top 5
        top_5 = latest_day_editions[:5]

        # Format response with ranks
        result = []
        for idx, entry in enumerate(top_5, start=1):
            result.append(LeaderboardEntry(
                rank=idx,
                edition_id=entry["edition_id"],
                newspaper_name=entry["newspaper_name"],
                user_email=entry["user_email"],
                profit=entry["profit"],
                readers=entry["readers"],
                credibility=entry["credibility"],
                date=format_date_dutch(entry["date"]),
            ))

        return result

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        import traceback
        print(f"ERROR in get_leaderboard: {error_msg}")
        print(traceback.format_exc())
        # If it's a PocketBase auth error, provide more helpful message
        if "403" in error_msg or "authentication" in error_msg.lower() or "Not authenticated" in error_msg:
            # Check if admin credentials are available
            admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
            admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
            if not admin_email or not admin_password:
                raise HTTPException(
                    status_code=500,
                    detail="POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment"
                )
            raise HTTPException(
                status_code=503,
                detail="Leaderboard temporarily unavailable. Admin authentication failed."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch leaderboard: {error_msg}"
        )


@router.get("/public/{edition_id}", response_model=PublicEditionResponse)
async def get_public_edition(edition_id: str):
    """
    Public read-only endpoint for viewing a published newspaper edition by id.
    Uses PocketBase admin auth server-side; does NOT require user auth.
    """
    try:
        pb_client = await get_pb_client()

        edition = await pb_client.get_record_by_id("published_editions", edition_id)
        if not edition:
            raise HTTPException(status_code=404, detail="Published edition not found")

        # Parse JSON fields
        grid_layout = edition.get("grid_layout", {})
        stats = edition.get("stats", {})

        if isinstance(grid_layout, str):
            try:
                grid_layout = json.loads(grid_layout)
            except Exception:
                grid_layout = {}
        if isinstance(stats, str):
            try:
                stats = json.loads(stats)
            except Exception:
                stats = {}

        placed_items = []
        if isinstance(grid_layout, dict) and isinstance(grid_layout.get("placedItems"), list):
            placed_items = grid_layout.get("placedItems", [])
        elif isinstance(grid_layout, list):
            placed_items = grid_layout

        published_items: List[PublicPublishedItem] = []
        for item in placed_items:
            if not isinstance(item, dict):
                continue

            is_ad = bool(item.get("isAd"))
            headline = (item.get("headline") or "").strip()
            body = (item.get("body") or "").strip()
            variant = item.get("variant")

            # Fallbacks if headline/body were not stored (older editions)
            if not headline:
                headline = "UNTITLED"
            if not body:
                body = ""

            # Extract row and position from grid_layout item
            row = item.get("row")
            position = item.get("position")
            
            if is_ad:
                published_items.append(PublicPublishedItem(
                    type="ad",
                    headline=headline,
                    body=body,
                    variant=None,
                    source=None,
                    location=None,
                    row=row,
                    position=position,
                ))
            else:
                published_items.append(PublicPublishedItem(
                    type="article",
                    headline=headline,
                    body=body,
                    variant=variant,
                    source=None,
                    location=None,
                    row=row,
                    position=position,
                ))

        # Get username from user record
        username = None
        user_id = edition.get("user", "")
        if user_id:
            try:
                user_record = await pb_client.get_record_by_id("users", user_id)
                if user_record:
                    username = user_record.get("username", None)
            except Exception:
                pass  # If user not found or username not available, use None

        return PublicEditionResponse(
            id=edition.get("id", ""),
            newspaper_name=edition.get("newspaper_name") or "Untitled Edition",
            date=format_date_dutch(edition.get("date", "")),
            published_at=format_datetime_dutch(edition.get("published_at", "")),
            stats=stats if isinstance(stats, dict) else {},
            published_items=published_items,
            username=username,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch public edition: {str(e)}")


# IMPORTANT: This route must be defined BEFORE any /{edition_id} routes
# to prevent FastAPI from matching "audience-impact" as an edition_id
@router.get("/audience-impact", response_model=Dict[str, int])
async def get_audience_impact(
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate total audience impact from all published editions.
    Aggregates audience scores from all articles in published editions,
    using the variant that was actually published for each article.
    
    Requires authentication.
    """
    try:
        pb_client = await get_pb_client()
        user_id = current_user.get("id")
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="User ID not found in authentication token"
            )
        
        # Initialize faction totals
        faction_totals = {
            "elite": 0,
            "working_class": 0,
            "patriots": 0,
            "syndicate": 0,
            "technocrats": 0,
            "faithful": 0,
            "resistance": 0,
            "doomers": 0,
        }
        
        # Get all published editions for this user
        editions = await pb_client.get_list(
            "published_editions",
            filter=f'user="{user_id}"',
            per_page=500,
            sort="-published_at",
        )
        
        # Process each edition
        for edition in editions:
            # Parse grid_layout
            grid_layout = edition.get("grid_layout", {})
            if isinstance(grid_layout, str):
                try:
                    grid_layout = json.loads(grid_layout)
                except:
                    grid_layout = {}
            
            # Get placed items
            placed_items = []
            if isinstance(grid_layout, dict):
                placed_items = grid_layout.get("placedItems", [])
            elif isinstance(grid_layout, list):
                placed_items = grid_layout
            
            # Process each placed item
            for item in placed_items:
                if not isinstance(item, dict):
                    continue
                
                # Skip ads (they don't have audience scores)
                if item.get("isAd"):
                    continue
                
                # Get article ID and variant
                article_id = item.get("articleId")
                variant = item.get("variant")
                
                if not article_id or not variant:
                    continue
                
                # Validate variant
                if variant not in ["factual", "sensationalist", "propaganda"]:
                    continue
                
                # Fetch the article to get its audience scores
                try:
                    article = await pb_client.get_record_by_id("articles", article_id)
                    if not article:
                        continue
                    
                    # Parse audience_scores
                    audience_scores = article.get("audience_scores", {})
                    if isinstance(audience_scores, str):
                        try:
                            audience_scores = json.loads(audience_scores)
                        except:
                            continue
                    
                    if not isinstance(audience_scores, dict):
                        continue
                    
                    # Get scores for the published variant
                    variant_scores = audience_scores.get(variant, {})
                    if not isinstance(variant_scores, dict):
                        continue
                    
                    # Add scores to totals
                    for faction in faction_totals.keys():
                        score = variant_scores.get(faction, 0)
                        try:
                            score = int(score)
                            faction_totals[faction] += score
                        except (ValueError, TypeError):
                            pass
                            
                except Exception as e:
                    # Skip articles that can't be fetched
                    print(f"Warning: Could not fetch article {article_id}: {e}")
                    continue
        
        return faction_totals
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate audience impact: {str(e)}"
        )


@router.get("/transactions/recent", response_model=List[TransactionResponse])
async def get_recent_transactions(
    current_user: dict = Depends(get_current_user),
    limit: int = 10
):
    """
    Get recent transactions derived from published editions.
    Each published edition generates revenue based on its stats.cash.
    Requires authentication.
    """
    try:
        pb_client = await get_pb_client()
        user_id = current_user.get("id")
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="User ID not found in authentication token"
            )
        
        # Get user's published editions, sorted by date (oldest first to calculate changes correctly)
        editions = await pb_client.get_list(
            "published_editions",
            filter=f'user="{user_id}"',
            per_page=limit * 2,  # Get more to ensure we have enough after filtering
            sort="published_at",  # Oldest first
        )
        
        transactions = []
        previous_cash = None  # Use None to track if this is the first edition
        
        # Process from oldest to newest to calculate cash changes correctly
        for edition in editions:
            # Parse stats
            stats = edition.get("stats", "{}")
            if isinstance(stats, str):
                try:
                    stats = json.loads(stats)
                except:
                    stats = {}
            
            cash = stats.get("cash", 0.0) or 0.0
            
            # Format date first (we'll use it regardless)
            published_at = edition.get("published_at", "")
            if published_at:
                try:
                    from dateutil import parser as date_parser
                    pub_date = date_parser.parse(published_at)
                    # Format as "Today", "Yesterday", or date
                    now = datetime.now(pub_date.tzinfo) if pub_date.tzinfo else datetime.now()
                    days_diff = (now.date() - pub_date.date()).days
                    
                    if days_diff == 0:
                        date_str = "Today"
                    elif days_diff == 1:
                        date_str = "Yesterday"
                    else:
                        date_str = format_date_dutch(pub_date.isoformat())
                except:
                    date_str = format_date_dutch(published_at) if published_at else "Unknown"
            else:
                date_str = "Unknown"
            
            # Only calculate change if we have a previous cash value
            # Skip the first edition's cash as "income" - it's the starting amount
            if previous_cash is not None:
                cash_change = cash - previous_cash
                
                # Create transaction entry only if there's a meaningful change
                newspaper_name = edition.get("newspaper_name", "Newspaper")
                if cash_change > 0:
                    transactions.append(TransactionResponse(
                        date=date_str,
                        description=f"Revenue from {newspaper_name}",
                        amount=abs(cash_change),
                        type="income"
                    ))
                elif cash_change < 0:
                    transactions.append(TransactionResponse(
                        date=date_str,
                        description=f"Costs for {newspaper_name}",
                        amount=abs(cash_change),
                        type="expense"
                    ))
                # If cash_change is 0, skip (no transaction)
            
            # Update previous_cash for next iteration
            previous_cash = cash
        
        # Reverse transactions to show newest first
        transactions.reverse()
        
        # Limit to requested number
        return transactions[:limit]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transactions: {str(e)}"
        )
