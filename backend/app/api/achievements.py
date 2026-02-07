"""
Achievements API endpoints
Handles tracking and unlocking achievements for users
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import sys
import json
import httpx

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient, serialize_for_pb
from app.api.auth import get_current_user, get_auth_headers

router = APIRouter(prefix="/achievements", tags=["achievements"])

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
    
    # Always verify admin token is still valid
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


async def _pb_get_list_with_user_token(
    collection: str,
    headers: Dict[str, str],
    per_page: int = 200,
    filter_expr: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch list from PocketBase using the user's token (avoids superuser-only API rules)."""
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090").rstrip("/")
    params = {"perPage": per_page}
    if filter_expr:
        params["filter"] = filter_expr
    async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
        response = await client.get(
            f"/api/collections/{collection}/records",
            params=params,
            headers=headers,
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.text or f"PocketBase list {collection} failed",
            )
        data = response.json()
        if isinstance(data, dict) and "items" in data:
            return data["items"]
        return data if isinstance(data, list) else []


class AchievementProgress(BaseModel):
    achievement_id: str
    name: str
    description: str
    category: str
    rarity: str
    points: int
    unlocked: bool
    unlocked_at: Optional[str] = None
    progress: Optional[float] = None  # 0.0 to 1.0 for progress-based achievements


class UserAchievementsResponse(BaseModel):
    unlocked_achievements: List[str]
    total_points: int
    achievements: List[AchievementProgress]
    completion_percentage: float


class CheckAchievementsRequest(BaseModel):
    event_type: str = ""
    event_data: Dict[str, Any] = {}


def _parse_purchased_upgrades(val: Any) -> list:
    """Parse purchased_upgrades from user record (may be JSON string or list)."""
    import json
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val) if val else []
        except Exception:
            return []
    return []


async def _get_user_game_state(pb: PocketBaseClient, user_id: str) -> Dict[str, Any]:
    """Get game state from users record (treasury, readers, credibility, purchased_upgrades)."""
    try:
        user = await pb.get_record_by_id("users", user_id)
        if not user:
            return {}
        purchased = _parse_purchased_upgrades(user.get("purchased_upgrades"))
        return {
            "treasury": float(user.get("treasury", 0) or 0),
            "readers": int(user.get("readers", 0) or 0),
            "credibility": float(user.get("credibility", 0) or 0),
            "purchased_upgrades": purchased,
        }
    except Exception:
        return {}


# Shop item costs for computing total spent
_SHOP_COSTS = {"interns": 500, "slander_license": 1000, "coffee_machine": 200}

# Faction id -> achievement_id mapping
_FACTION_ACHIEVEMENTS = {
    "elite": (("elite_favorite", 10), ("elite_enemy", -10)),
    "working_class": (("working_class_hero", 10), ("working_class_enemy", -10)),
    "patriots": (("patriot_ally", 10),),
    "syndicate": (("syndicate_member", 10),),
    "technocrats": (("technocrat_friend", 10),),
    "faithful": (("faithful_supporter", 10),),
    "resistance": (("resistance_agent", 10),),
    "doomers": (("doomer_ally", 10),),
}


def _parse_edition(edition: Dict[str, Any]) -> Dict[str, Any]:
    """Parse grid_layout and stats from an edition record."""
    grid = edition.get("grid_layout", {})
    if isinstance(grid, str):
        try:
            grid = json.loads(grid)
        except Exception:
            grid = {}
    stats = edition.get("stats", {})
    if isinstance(stats, str):
        try:
            stats = json.loads(stats)
        except Exception:
            stats = {}
    placed = grid.get("placedItems", []) if isinstance(grid, dict) else []
    date_str = edition.get("date") or edition.get("published_at", "")[:10]
    return {"placed": placed, "stats": stats, "date": date_str}


def _compute_streaks(editions_parsed: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute publishing, profit, reader-growth, credibility streaks from editions."""
    if not editions_parsed:
        return {"publish_streak": 0, "profit_streak": 0, "reader_growth_streak": 0, "credibility_streak": 0}
    # Group by date (one edition per day - take best/latest)
    by_date: Dict[str, Dict] = {}
    for e in editions_parsed:
        d = e.get("date", "")
        if not d:
            continue
        stats = e.get("stats", {})
        cash = float(stats.get("cash", 0) or 0)
        readers = int(stats.get("readers", 0) or 0)
        cred = float(stats.get("credibility", 0) or 0)
        if d not in by_date or cash > float(by_date[d].get("cash", 0)):
            by_date[d] = {"cash": cash, "readers": readers, "credibility": cred}
    dates_sorted = sorted(by_date.keys())
    if not dates_sorted:
        return {"publish_streak": 0, "profit_streak": 0, "reader_growth_streak": 0, "credibility_streak": 0}
    # Publish streak
    publish_streak = 1
    max_pub = 1
    for i in range(1, len(dates_sorted)):
        from datetime import datetime, timedelta
        prev = datetime.fromisoformat(dates_sorted[i - 1]).date()
        curr = datetime.fromisoformat(dates_sorted[i]).date()
        if (curr - prev).days == 1:
            publish_streak += 1
            max_pub = max(max_pub, publish_streak)
        else:
            publish_streak = 1
    # Profit streak (consecutive days with cash > 0)
    profit_streak = 0
    max_profit = 0
    for d in dates_sorted:
        if by_date[d].get("cash", 0) > 0:
            profit_streak += 1
            max_profit = max(max_profit, profit_streak)
        else:
            profit_streak = 0
    # Reader growth streak
    reader_streak = 0
    max_reader = 0
    prev_readers = 0
    for d in dates_sorted:
        r = by_date[d].get("readers", 0)
        if r > prev_readers and prev_readers > 0:
            reader_streak += 1
            max_reader = max(max_reader, reader_streak)
        else:
            reader_streak = 0
        prev_readers = r
    # Credibility streak (consecutive days with cred >= 60 for "Trustworthy" achievement)
    cred_streak = 0
    max_cred = 0
    for d in dates_sorted:
        if by_date[d].get("credibility", 0) >= 60:
            cred_streak += 1
            max_cred = max(max_cred, cred_streak)
        else:
            cred_streak = 0
    return {
        "publish_streak": max_pub,
        "profit_streak": max_profit,
        "reader_growth_streak": max_reader,
        "credibility_streak": max_cred,
        "dates": dates_sorted,
        "by_date": by_date,
    }


async def _get_faction_totals(pb: PocketBaseClient, published_editions: List[Dict]) -> Dict[str, int]:
    """Aggregate faction scores from all published editions."""
    totals = {f: 0 for f in ["elite", "working_class", "patriots", "syndicate", "technocrats", "faithful", "resistance", "doomers"]}
    for edition in published_editions:
        parsed = _parse_edition(edition)
        for item in parsed.get("placed", []):
            if not isinstance(item, dict) or item.get("isAd"):
                continue
            aid = item.get("articleId")
            variant = item.get("variant")
            if not aid or variant not in ("factual", "sensationalist", "propaganda"):
                continue
            try:
                art = await pb.get_record_by_id("articles", aid)
                if not art:
                    continue
                ascores = art.get("audience_scores", {})
                if isinstance(ascores, str):
                    ascores = json.loads(ascores) if ascores else {}
                vs = ascores.get(variant, {}) if isinstance(ascores, dict) else {}
                for f in totals:
                    totals[f] += int(vs.get(f, 0) or 0)
            except Exception:
                continue
    return totals


def _compute_article_stats(_pb: PocketBaseClient, published_editions: List[Dict]) -> Dict:
    """Compute counts for top/middle/bottom, locations, variants, tags. Returns sync-compatible dict (no await)."""
    top_count = middle_count = bottom_count = 0
    locations: set = set()
    variants_used: Dict[str, int] = {"factual": 0, "sensationalist": 0, "propaganda": 0}
    tags_seen: set = set()
    perfect_grid_count = 0
    for edition in published_editions:
        parsed = _parse_edition(edition)
        placed = parsed.get("placed", [])
        if len(placed) >= 6:
            perfect_grid_count += 1
        for item in placed:
            if not isinstance(item, dict) or item.get("isAd"):
                continue
            row = item.get("row") or 1
            if row == 1:
                top_count += 1
            elif row == 2:
                middle_count += 1
            else:
                bottom_count += 1
            v = item.get("variant")
            if v in variants_used:
                variants_used[v] += 1
    return {
        "top_count": top_count,
        "middle_count": middle_count,
        "bottom_count": bottom_count,
        "locations": locations,
        "variants_used": variants_used,
        "tags_seen": tags_seen,
        "perfect_grid_count": perfect_grid_count,
    }


async def _get_article_stats_full(pb: PocketBaseClient, published_editions: List[Dict]) -> Dict:
    """Full stats including locations, tags, sentiments (requires fetching articles)."""
    base = _compute_article_stats(pb, published_editions)
    locations: set = set()
    location_counts: Dict[str, int] = {}
    tags_seen: set = set()
    sentiments_seen: set = set()
    for edition in published_editions:
        parsed = _parse_edition(edition)
        for item in parsed.get("placed", []):
            if not isinstance(item, dict) or item.get("isAd"):
                continue
            aid = item.get("articleId")
            if not aid:
                continue
            try:
                art = await pb.get_record_by_id("articles", aid)
                if art:
                    loc = (art.get("location_city") or "").strip()
                    if loc and loc != "Unknown":
                        locations.add(loc)
                        location_counts[loc] = location_counts.get(loc, 0) + 1
                    t = art.get("tags")
                    if isinstance(t, list):
                        tags_seen.update(str(x) for x in t)
                    elif isinstance(t, str):
                        try:
                            tags_seen.update(json.loads(t) if t else [])
                        except Exception:
                            pass
                    sent = art.get("sentiment") or ""
                    if sent:
                        sentiments_seen.add(str(sent).lower())
            except Exception:
                continue
    base["locations"] = locations
    base["location_counts"] = location_counts
    base["tags_seen"] = tags_seen
    base["sentiments_seen"] = sentiments_seen
    return base


def _compute_shop_spent(purchased: list) -> int:
    """Total spent based on purchased upgrade IDs."""
    return sum(_SHOP_COSTS.get(x, 0) for x in (purchased or []))


def _compute_progress(
    achievement_id: str,
    published_count: int,
    user_game_state: Dict[str, Any],
) -> Optional[float]:
    """Compute progress 0.0..1.0 for an achievement based on current stats."""
    treasury = user_game_state.get("treasury", 0) or 0
    readers = user_game_state.get("readers", 0) or 0
    credibility = user_game_state.get("credibility", 0) or 0
    purchased = user_game_state.get("purchased_upgrades", []) or []
    n_upgrades = len(purchased)

    thresholds = {
        "first_edition": (1, published_count),
        "ten_editions": (10, published_count),
        "fifty_editions": (50, published_count),
        "hundred_editions": (100, published_count),
        "five_hundred_editions": (500, published_count),
        "thousand_editions": (1000, published_count),
        "first_dollar": (1, int(treasury)),
        "hundred_dollars": (100, int(treasury)),
        "thousand_dollars": (1000, int(treasury)),
        "ten_thousand": (10000, int(treasury)),
        "hundred_thousand": (100000, int(treasury)),
        "millionaire": (1000000, int(treasury)),
        "first_readers": (1000, readers),
        "ten_thousand_readers": (10000, readers),
        "hundred_thousand_readers": (100000, readers),
        "million_readers": (1000000, readers),
        "ten_million_readers": (10000000, readers),
        "credible_source": (50, int(credibility)),
        "highly_credible": (80, int(credibility)),
        "perfect_credibility": (100, int(credibility)),
        "first_purchase": (1, n_upgrades),
        "upgrade_collector": (10, n_upgrades),
    }
    if achievement_id in thresholds:
        target, current = thresholds[achievement_id]
        if target <= 0:
            return None
        return min(1.0, float(current) / float(target))
    return None


@router.get("/all", response_model=List[AchievementProgress])
async def get_all_achievements(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """Get all achievements with user's progress and progress bars. Uses user token for PocketBase to avoid superuser-only rules."""
    user_id = current_user["id"]
    pb = await get_pb_client()
    all_achievements: List[Dict[str, Any]] = []
    user_achievements: List[Dict[str, Any]] = []
    try:
        all_achievements = await _pb_get_list_with_user_token("achievements", headers, per_page=200)
    except HTTPException as e:
        if e.status_code == 403:
            try:
                pb = await get_pb_client()
                all_achievements = await pb.get_list("achievements", per_page=200)
            except Exception:
                all_achievements = []
        else:
            raise

    try:
        user_achievements = await _pb_get_list_with_user_token(
            "user_achievements", headers, per_page=200, filter_expr=f'user = "{user_id}"'
        )
    except HTTPException as e:
        if e.status_code in (403, 404):
            try:
                pb = await get_pb_client()
                user_achievements = await pb.get_list(
                    "user_achievements", filter=f'user = "{user_id}"', per_page=200
                )
            except Exception:
                user_achievements = []
        else:
            user_achievements = []
    
    unlocked_ids = {ua.get("achievement_id") for ua in user_achievements if ua.get("achievement_id")}

    # Fetch user game state and published count for progress
    user_game_state = await _get_user_game_state(pb, user_id)
    published_editions: List[Dict[str, Any]] = []
    try:
        published_editions = await pb.get_list(
            "published_editions",
            filter=f'user = "{user_id}"',
            per_page=2000,
        )
    except Exception:
        pass
    published_count = len(published_editions)

    # Combine and format
    result = []
    for achievement in all_achievements:
        # Try different possible field names
        achievement_id = (
            achievement.get("achievement_id") or 
            achievement.get("id") or 
            achievement.get("achievementId")
        )
        
        # Skip if no achievement_id found (shouldn't happen, but be safe)
        if not achievement_id:
            print(f"[WARNING] Achievement missing achievement_id: {achievement}")
            continue
        
        is_unlocked = achievement_id in unlocked_ids
        
        unlocked_ua = next(
            (ua for ua in user_achievements if ua.get("achievement_id") == achievement_id),
            None
        )
        
        progress_val = None
        if not is_unlocked:
            progress_val = _compute_progress(
                achievement_id,
                published_count,
                user_game_state,
            )
        result.append(AchievementProgress(
            achievement_id=str(achievement_id),  # Ensure it's a string
            name=achievement.get("name", ""),
            description=achievement.get("description", ""),
            category=achievement.get("category", ""),
            rarity=achievement.get("rarity", "common"),
            points=achievement.get("points", 0),
            unlocked=is_unlocked,
            unlocked_at=unlocked_ua.get("unlocked_at") if unlocked_ua else None,
            progress=progress_val,
        ))
    
    return result


def _empty_achievements_summary() -> UserAchievementsResponse:
    """Return empty summary when PocketBase is inaccessible (e.g. 403 superuser-only)."""
    return UserAchievementsResponse(
        unlocked_achievements=[],
        total_points=0,
        achievements=[],
        completion_percentage=0.0,
    )


@router.get("/summary", response_model=UserAchievementsResponse)
async def get_achievements_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """Get summary of user's achievements. Returns empty summary on 403 (e.g. superuser-only collections)."""
    user_id = current_user["id"]
    all_achievements: List[Dict[str, Any]] = []
    user_achievements: List[Dict[str, Any]] = []
    try:
        all_achievements = await _pb_get_list_with_user_token("achievements", headers, per_page=200)
    except HTTPException as e:
        if e.status_code == 403:
            try:
                pb = await get_pb_client()
                all_achievements = await pb.get_list("achievements", per_page=200)
            except Exception:
                return _empty_achievements_summary()
        else:
            raise
    except Exception:
        return _empty_achievements_summary()

    try:
        user_achievements = await _pb_get_list_with_user_token(
            "user_achievements", headers, per_page=200, filter_expr=f'user = "{user_id}"'
        )
    except (HTTPException, Exception):
        try:
            pb = await get_pb_client()
            user_achievements = await pb.get_list(
                "user_achievements", filter=f'user = "{user_id}"', per_page=200
            )
        except Exception:
            user_achievements = []
    total_achievements = len(all_achievements)
    unlocked_ids = [ua.get("achievement_id") for ua in user_achievements if ua.get("achievement_id")]
    unlocked_achievement_records = [
        a for a in all_achievements if a.get("achievement_id") in unlocked_ids
    ]
    total_points = sum(a.get("points", 0) for a in unlocked_achievement_records)
    completion_percentage = (len(unlocked_ids) / total_achievements * 100) if total_achievements > 0 else 0.0
    return UserAchievementsResponse(
        unlocked_achievements=unlocked_ids,
        total_points=total_points,
        achievements=[],
        completion_percentage=round(completion_percentage, 2),
    )


@router.post("/unlock/{achievement_id}")
async def unlock_achievement(
    achievement_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Unlock an achievement for a user (called internally by tracking system)"""
    pb = await get_pb_client()
    user_id = current_user["id"]
    
    # Check if achievement exists
    achievements = await pb.get_list(
        "achievements",
        filter=f'achievement_id = "{achievement_id}"',
    )
    
    if not achievements:
        raise HTTPException(status_code=404, detail=f"Achievement {achievement_id} not found")
    
    achievement = achievements[0]
    
    # Check if already unlocked
    existing = await pb.get_list(
        "user_achievements",
        filter=f'user = "{user_id}" && achievement_id = "{achievement_id}"',
    )
    
    if existing:
        # Already unlocked
        return {"unlocked": True, "already_unlocked": True}
    
    # Create user_achievement record
    user_achievement_data = serialize_for_pb({
        "user": user_id,
        "achievement_id": achievement_id,
        "unlocked_at": datetime.now().isoformat(),
    })
    
    try:
        result = await pb.create_record("user_achievements", user_achievement_data)
        return {
            "unlocked": True,
            "already_unlocked": False,
            "achievement": {
                "id": achievement_id,
                "name": achievement.get("name"),
                "points": achievement.get("points"),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unlock achievement: {str(e)}")


@router.post("/check")
async def check_achievements(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    event_type: Optional[str] = Query(None, alias="event_type"),
):
    """
    Check and unlock achievements based on game events.
    This is called after significant game events (publish, purchase, etc.)
    Accepts event_type and event_data in JSON body, or event_type as query param.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    event_type = event_type or body.get("event_type", "")
    event_data = body.get("event_data") or {}
    pb = await get_pb_client()
    user_id = current_user["id"]

    # Get user's current unlocked achievements
    user_achievements: List[Dict[str, Any]] = []
    try:
        user_achievements = await pb.get_list(
            "user_achievements",
            filter=f'user = "{user_id}"',
            per_page=200,
        )
    except Exception:
        pass
    unlocked_ids = {ua.get("achievement_id") for ua in user_achievements if ua.get("achievement_id")}

    # All achievements
    all_achievements = await pb.get_list("achievements", per_page=200)

    # Get user's game state from users collection (treasury, readers, credibility, purchased_upgrades)
    user_game_state = await _get_user_game_state(pb, user_id)

    # Get user's published editions for counting
    published_editions: List[Dict[str, Any]] = []
    try:
        published_editions = await pb.get_list(
            "published_editions",
            filter=f'user = "{user_id}"',
            per_page=2000,
            sort="-published_at",
        )
    except Exception:
        pass

    editions_parsed = [_parse_edition(e) for e in published_editions]
    streaks = _compute_streaks(editions_parsed)
    faction_totals: Dict[str, int] = {}
    article_stats_full: Dict = {}
    try:
        faction_totals = await _get_faction_totals(pb, published_editions)
        article_stats_full = await _get_article_stats_full(pb, published_editions)
    except Exception:
        article_stats_full = _compute_article_stats(pb, published_editions)

    purchased = user_game_state.get("purchased_upgrades", []) or []
    shop_spent = _compute_shop_spent(purchased)
    treasury = user_game_state.get("treasury", 0) or 0
    readers = user_game_state.get("readers", 0) or 0
    credibility = user_game_state.get("credibility", 0) or 0
    by_date = streaks.get("by_date", {})
    dates_sorted = streaks.get("dates", [])
    
    newly_unlocked = []
    
    # Check each achievement condition
    for achievement in all_achievements:
        achievement_id = achievement.get("achievement_id")
        
        # Skip if already unlocked
        if achievement_id in unlocked_ids:
            continue
        
        # Check condition based on achievement_id
        should_unlock = False
        
        # Publishing milestones
        if achievement_id == "first_edition":
            should_unlock = len(published_editions) >= 1
        elif achievement_id == "ten_editions":
            should_unlock = len(published_editions) >= 10
        elif achievement_id == "fifty_editions":
            should_unlock = len(published_editions) >= 50
        elif achievement_id == "hundred_editions":
            should_unlock = len(published_editions) >= 100
        elif achievement_id == "five_hundred_editions":
            should_unlock = len(published_editions) >= 500
        elif achievement_id == "thousand_editions":
            should_unlock = len(published_editions) >= 1000
        
        # Financial achievements
        elif achievement_id == "first_dollar":
            should_unlock = user_game_state.get("treasury", 0) >= 1
        elif achievement_id == "hundred_dollars":
            should_unlock = user_game_state.get("treasury", 0) >= 100
        elif achievement_id == "thousand_dollars":
            should_unlock = user_game_state.get("treasury", 0) >= 1000
        elif achievement_id == "ten_thousand":
            should_unlock = user_game_state.get("treasury", 0) >= 10000
        elif achievement_id == "hundred_thousand":
            should_unlock = user_game_state.get("treasury", 0) >= 100000
        elif achievement_id == "millionaire":
            should_unlock = user_game_state.get("treasury", 0) >= 1000000
        
        # Readers & Credibility
        elif achievement_id == "first_readers":
            should_unlock = user_game_state.get("readers", 0) >= 1000
        elif achievement_id == "ten_thousand_readers":
            should_unlock = user_game_state.get("readers", 0) >= 10000
        elif achievement_id == "hundred_thousand_readers":
            should_unlock = user_game_state.get("readers", 0) >= 100000
        elif achievement_id == "million_readers":
            should_unlock = user_game_state.get("readers", 0) >= 1000000
        elif achievement_id == "credible_source":
            should_unlock = user_game_state.get("credibility", 0) >= 50
        elif achievement_id == "highly_credible":
            should_unlock = user_game_state.get("credibility", 0) >= 80
        elif achievement_id == "perfect_credibility":
            should_unlock = user_game_state.get("credibility", 0) >= 100
        
        # Shop achievements
        elif achievement_id == "first_purchase":
            should_unlock = len(purchased) >= 1
        elif achievement_id == "interns_buyer":
            should_unlock = "interns" in purchased
        elif achievement_id == "slander_license":
            should_unlock = "slander_license" in purchased
        elif achievement_id == "coffee_machine":
            should_unlock = "coffee_machine" in purchased
        elif achievement_id == "all_upgrades":
            unique = set(purchased) if isinstance(purchased, list) else set()
            should_unlock = unique >= {"interns", "slander_license", "coffee_machine"}
        elif achievement_id == "upgrade_collector":
            should_unlock = len(purchased) >= 10
        elif achievement_id == "expensive_taste":
            should_unlock = "slander_license" in purchased  # costs $1000
        elif achievement_id == "pack_opener":
            packs = event_data.get("packs_opened", 0) if event_type == "pack_open" else 0
            should_unlock = packs >= 1 or len(purchased) >= 1
        elif achievement_id == "pack_collector":
            packs = event_data.get("packs_opened", 0) if event_type == "pack_open" else 0
            should_unlock = packs >= 10 or len(purchased) >= 10
        elif achievement_id == "shop_regular":
            should_unlock = len(purchased) >= 20
        elif achievement_id == "big_spender":
            should_unlock = shop_spent >= 10000
        elif achievement_id == "treasury_tycoon":
            should_unlock = treasury >= 5_000_000

        # Financial (single-edition from event_data or max from history)
        elif achievement_id == "profitable_day":
            if event_type == "publish":
                cash = float((event_data.get("stats") or {}).get("cash", 0) or 0)
                should_unlock = cash >= 1000
            else:
                for e in editions_parsed:
                    c = float((e.get("stats") or {}).get("cash", 0) or 0)
                    if c >= 1000:
                        should_unlock = True
                        break
        elif achievement_id == "massive_profit":
            if event_type == "publish":
                cash = float((event_data.get("stats") or {}).get("cash", 0) or 0)
                should_unlock = cash >= 10000
            else:
                for e in editions_parsed:
                    if float((e.get("stats") or {}).get("cash", 0) or 0) >= 10000:
                        should_unlock = True
                        break
        elif achievement_id == "break_even":
            if event_type == "publish":
                cash = float((event_data.get("stats") or {}).get("cash", 0) or 0)
                should_unlock = cash == 0 and len(event_data.get("placed_items") or event_data.get("placedItems") or []) >= 1
            else:
                for e in editions_parsed:
                    if float((e.get("stats") or {}).get("cash", 0) or 0) == 0 and len(e.get("placed", [])) >= 1:
                        should_unlock = True
                        break
        elif achievement_id == "ad_revenue":
            total_from_ads = 0
            for e in editions_parsed:
                has_ad = any(p.get("isAd") for p in e.get("placed", []))
                if has_ad:
                    total_from_ads += float((e.get("stats") or {}).get("cash", 0) or 0)
            should_unlock = total_from_ads >= 5000
        elif achievement_id == "bonus_hunter":
            total_cash = sum(float((e.get("stats") or {}).get("cash", 0) or 0) for e in editions_parsed)
            should_unlock = total_cash >= 2000 and len(editions_parsed) >= 5
        elif achievement_id == "penalty_free":
            without_penalty = sum(1 for e in editions_parsed if float((e.get("stats") or {}).get("cash", 0) or 0) >= 0)
            should_unlock = without_penalty >= 10 and len(editions_parsed) >= 10
        elif achievement_id == "penalty_magnet":
            total_neg = sum(min(0, float((e.get("stats") or {}).get("cash", 0) or 0)) for e in editions_parsed)
            should_unlock = abs(total_neg) >= 5000

        # Readers & Credibility
        elif achievement_id == "ten_million_readers":
            should_unlock = readers >= 10_000_000
        elif achievement_id == "tabloid_trash":
            should_unlock = credibility <= 0
        elif achievement_id == "reader_spike":
            if len(dates_sorted) >= 2 and len(by_date) >= 2:
                d0, d1 = dates_sorted[-1], dates_sorted[-2]
                r0 = by_date.get(d0, {}).get("readers", 0) or 0
                r1 = by_date.get(d1, {}).get("readers", 0) or 0
                should_unlock = (r0 - r1) >= 50000
        elif achievement_id == "reader_loss":
            if len(dates_sorted) >= 2:
                d0, d1 = dates_sorted[-1], dates_sorted[-2]
                r0 = by_date.get(d0, {}).get("readers", 0) or 0
                r1 = by_date.get(d1, {}).get("readers", 0) or 0
                should_unlock = (r1 - r0) >= 20000
        elif achievement_id == "credibility_comeback":
            had_zero = any((by_date.get(d, {}).get("credibility", 0) or 0) <= 0 for d in dates_sorted)
            should_unlock = had_zero and credibility >= 50

        # Streaks
        elif achievement_id == "daily_publisher":
            should_unlock = streaks.get("publish_streak", 0) >= 3
        elif achievement_id == "week_warrior":
            should_unlock = streaks.get("publish_streak", 0) >= 7
        elif achievement_id == "month_marathon":
            should_unlock = streaks.get("publish_streak", 0) >= 30
        elif achievement_id == "hundred_day_streak":
            should_unlock = streaks.get("publish_streak", 0) >= 100
        elif achievement_id == "no_break":
            should_unlock = streaks.get("publish_streak", 0) >= 14
        elif achievement_id == "streak_master":
            should_unlock = streaks.get("publish_streak", 0) >= 50
        elif achievement_id == "consistent_earner":
            should_unlock = streaks.get("profit_streak", 0) >= 10
        elif achievement_id == "reader_growth_streak":
            should_unlock = streaks.get("reader_growth_streak", 0) >= 5
        elif achievement_id == "credibility_streak":
            should_unlock = streaks.get("credibility_streak", 0) >= 14
        elif achievement_id == "steady_growth":
            should_unlock = streaks.get("reader_growth_streak", 0) >= 7
        elif achievement_id == "perfect_week":
            pub = streaks.get("publish_streak", 0)
            prof = streaks.get("profit_streak", 0)
            should_unlock = pub >= 7 and prof >= 7

        # Faction achievements
        elif achievement_id in ("elite_favorite", "working_class_hero", "patriot_ally", "syndicate_member",
                               "technocrat_friend", "faithful_supporter", "resistance_agent", "doomer_ally"):
            fmap = {"elite_favorite": "elite", "working_class_hero": "working_class", "patriot_ally": "patriots",
                    "syndicate_member": "syndicate", "technocrat_friend": "technocrats", "faithful_supporter": "faithful",
                    "resistance_agent": "resistance", "doomer_ally": "doomers"}
            fac = fmap.get(achievement_id, "")
            should_unlock = faction_totals.get(fac, 0) >= 10
        elif achievement_id in ("elite_enemy", "working_class_enemy"):
            fmap = {"elite_enemy": "elite", "working_class_enemy": "working_class"}
            fac = fmap.get(achievement_id, "")
            should_unlock = faction_totals.get(fac, 0) <= -10
        elif achievement_id == "faction_pariah":
            should_unlock = any(faction_totals.get(f, 0) <= -10 for f in faction_totals)
        elif achievement_id == "universal_hate":
            should_unlock = all(faction_totals.get(f, 0) < 0 for f in faction_totals) and len(faction_totals) >= 8
        elif achievement_id == "universal_love":
            should_unlock = all(faction_totals.get(f, 0) > 0 for f in faction_totals) and len(faction_totals) >= 8
        elif achievement_id == "faction_diversity":
            pos = sum(1 for f in faction_totals if faction_totals.get(f, 0) > 0)
            should_unlock = pos >= 4
        elif achievement_id == "faction_master":
            pos = sum(1 for f in faction_totals if faction_totals.get(f, 0) >= 10)
            should_unlock = pos >= 4
        elif achievement_id == "faction_extremist":
            vals = list(faction_totals.values())
            should_unlock = max(vals) >= 8 and min(vals) <= -8
        elif achievement_id in ("neutral_ground", "faction_swing", "balanced_factions"):
            vals = [faction_totals.get(f, 0) for f in faction_totals]
            if achievement_id == "neutral_ground":
                should_unlock = all(-2 <= v <= 2 for v in vals) and len(dates_sorted) >= 10
            elif achievement_id == "balanced_factions":
                spread = max(vals) - min(vals) if vals else 99
                should_unlock = spread <= 5 and len(dates_sorted) >= 5
            else:
                pass  # faction_swing needs historical tracking

        # Publish event achievements (from event_data)
        elif event_type == "publish":
            placed = event_data.get("placed_items") or event_data.get("placedItems") or []
            stats = event_data.get("stats") or {}
            cred = float(stats.get("credibility", 0) or 0)
            rdrs = int(stats.get("readers", 0) or 0)
            articles = [p for p in placed if not p.get("isAd", False)]
            ads = [p for p in placed if p.get("isAd", False)]
            variants = {p.get("variant") for p in articles if p.get("variant")}

            if achievement_id == "perfect_grid":
                should_unlock = len(placed) >= 6
            elif achievement_id == "single_article":
                should_unlock = len(articles) == 1 and len(placed) == 1
            elif achievement_id == "articles_only":
                should_unlock = len(articles) >= 1 and len(ads) == 0 and len(placed) >= 1
            elif achievement_id == "ads_only":
                should_unlock = len(ads) >= 1 and len(articles) == 0 and len(placed) >= 1
            elif achievement_id == "all_factual":
                should_unlock = variants == {"factual"} and len(articles) >= 1
            elif achievement_id == "all_sensationalist":
                should_unlock = variants == {"sensationalist"} and len(articles) >= 1
            elif achievement_id == "all_propaganda":
                should_unlock = variants == {"propaganda"} and len(articles) >= 1
            elif achievement_id == "mixed_variants":
                should_unlock = variants >= {"factual", "sensationalist", "propaganda"}
            elif achievement_id == "same_variant_row":
                rows: Dict[int, List[str]] = {}
                for p in articles:
                    r = int(p.get("row") or 1)
                    v = p.get("variant", "")
                    if r not in rows:
                        rows[r] = []
                    rows[r].append(v)
                should_unlock = any(len(vs) >= 2 and len(set(vs)) == 1 for vs in rows.values())
            elif achievement_id == "balanced_metrics":
                should_unlock = cred >= 50 and rdrs >= 50000
            elif achievement_id == "jackpot":
                cash = float(stats.get("cash", 0) or 0)
                should_unlock = cash >= 10000 and rdrs >= 100000
            elif achievement_id == "contradiction":
                titles = {}
                for p in articles:
                    t = p.get("headline") or p.get("articleId") or ""
                    v = p.get("variant", "")
                    if t not in titles:
                        titles[t] = set()
                    titles[t].add(v)
                should_unlock = any("factual" in vs and "propaganda" in vs for vs in titles.values())

        # Aggregate stats (from all editions)
        elif achievement_id == "top_spot":
            should_unlock = article_stats_full.get("top_count", 0) >= 100
        elif achievement_id == "middle_row":
            should_unlock = article_stats_full.get("middle_count", 0) >= 100
        elif achievement_id == "bottom_row":
            should_unlock = article_stats_full.get("bottom_count", 0) >= 100
        elif achievement_id == "global_coverage":
            should_unlock = len(article_stats_full.get("locations", set())) >= 50
        elif achievement_id == "location_master":
            should_unlock = len(article_stats_full.get("locations", set())) >= 100
        elif achievement_id == "local_focus":
            lc = article_stats_full.get("location_counts", {})
            should_unlock = any(c >= 20 for c in lc.values())
        elif achievement_id == "variant_master":
            vu = article_stats_full.get("variants_used", {})
            should_unlock = all(vu.get(v, 0) >= 100 for v in ("factual", "sensationalist", "propaganda"))
        elif achievement_id == "tag_collector":
            should_unlock = len(article_stats_full.get("tags_seen", set())) >= 50
        elif achievement_id == "grid_artist":
            should_unlock = article_stats_full.get("perfect_grid_count", 0) >= 50
        elif achievement_id == "sentiment_analyst":
            s = article_stats_full.get("sentiments_seen", set())
            should_unlock = len(s) >= 3  # All different sentiment types
        elif achievement_id == "perfect_day":
            for e in editions_parsed:
                s = e.get("stats", {})
                c = float(s.get("cash", 0) or 0)
                r = int(s.get("readers", 0) or 0)
                cr = float(s.get("credibility", 0) or 0)
                if c >= 5000 and r >= 50000 and cr >= 90:
                    should_unlock = True
                    break

        # Completionist & Master Editor
        elif achievement_id == "completionist":
            should_unlock = len(unlocked_ids) >= 49
        elif achievement_id == "master_editor":
            should_unlock = len(unlocked_ids) >= 98  # All others

        # If condition met, unlock
        if should_unlock:
            try:
                user_achievement_data = serialize_for_pb({
                    "user": user_id,
                    "achievement_id": achievement_id,
                    "unlocked_at": datetime.now().isoformat(),
                })
                await pb.create_record("user_achievements", user_achievement_data)
                unlocked_ids.add(achievement_id)
                newly_unlocked.append({
                    "id": achievement_id,
                    "name": achievement.get("name"),
                    "points": achievement.get("points"),
                })
            except Exception as e:
                print(f"Error unlocking achievement {achievement_id}: {e}")
    
    return {
        "newly_unlocked": newly_unlocked,
        "total_unlocked": len(unlocked_ids),
    }

