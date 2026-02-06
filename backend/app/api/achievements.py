"""
Achievements API endpoints
Handles tracking and unlocking achievements for users
"""
from fastapi import APIRouter, HTTPException, Depends
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


@router.get("/all", response_model=List[AchievementProgress])
async def get_all_achievements(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """Get all achievements with user's progress. Uses user token for PocketBase to avoid superuser-only rules."""
    user_id = current_user["id"]
    all_achievements: List[Dict[str, Any]] = []
    user_achievements: List[Dict[str, Any]] = []
    try:
        all_achievements = await _pb_get_list_with_user_token("achievements", headers, per_page=200)
        user_achievements = await _pb_get_list_with_user_token(
            "user_achievements", headers, per_page=200, filter_expr=f'user = "{user_id}"'
        )
    except HTTPException as e:
        if e.status_code == 403:
            try:
                pb = await get_pb_client()
                all_achievements = await pb.get_list("achievements", per_page=200)
                user_achievements = await pb.get_list(
                    "user_achievements", filter=f'user = "{user_id}"', per_page=200
                )
            except Exception:
                # Admin also 403 (e.g. not superuser) or other error – return empty list
                pass
        else:
            raise
    
    unlocked_ids = {ua.get("achievement_id") for ua in user_achievements if ua.get("achievement_id")}
    
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
        
        result.append(AchievementProgress(
            achievement_id=str(achievement_id),  # Ensure it's a string
            name=achievement.get("name", ""),
            description=achievement.get("description", ""),
            category=achievement.get("category", ""),
            rarity=achievement.get("rarity", "common"),
            points=achievement.get("points", 0),
            unlocked=is_unlocked,
            unlocked_at=unlocked_ua.get("unlocked_at") if unlocked_ua else None,
            progress=None,  # Progress calculation would be done client-side
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
        user_achievements = await _pb_get_list_with_user_token(
            "user_achievements", headers, per_page=200, filter_expr=f'user = "{user_id}"'
        )
    except HTTPException as e:
        if e.status_code == 403:
            try:
                pb = await get_pb_client()
                all_achievements = await pb.get_list("achievements", per_page=200)
                user_achievements = await pb.get_list(
                    "user_achievements", filter=f'user = "{user_id}"', per_page=200
                )
            except Exception:
                return _empty_achievements_summary()
        else:
            raise
    except Exception:
        return _empty_achievements_summary()
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
    event_type: str,
    event_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Check and unlock achievements based on game events.
    This is called after significant game events (publish, purchase, etc.)
    """
    pb = await get_pb_client()
    user_id = current_user["id"]
    
    # Get user's current unlocked achievements
    user_achievements = await pb.get_list(
        "user_achievements",
        filter=f'user = "{user_id}"',
        per_page=200,
    )
    unlocked_ids = {ua.get("achievement_id") for ua in user_achievements if ua.get("achievement_id")}
    
    # Get all achievements
    all_achievements = await pb.get_list("achievements", per_page=200)
    
    # Get user's game state for checking conditions
    game_state = await pb.get_list(
        "game_state",
        filter=f'user = "{user_id}"',
    )
    user_game_state = game_state[0] if game_state else {}
    
    # Get user's published editions for counting
    published_editions = await pb.get_list(
        "published_editions",
        filter=f'user = "{user_id}"',
        per_page=1000,
    )
    
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
            purchased = user_game_state.get("purchased_upgrades", [])
            should_unlock = len(purchased) >= 1
        elif achievement_id == "all_upgrades":
            purchased = user_game_state.get("purchased_upgrades", [])
            should_unlock = len(purchased) >= 3  # All 3 shop items
        
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

