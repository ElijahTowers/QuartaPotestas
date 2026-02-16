"""
Submissions API endpoints for player newspaper layouts.
Uses ScoringService to compute score/sales/outrage/faction_balance without publishing.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel
import os
import json

from app.services.scoring_service import ScoringService
from lib.pocketbase_client import PocketBaseClient

router = APIRouter(prefix="/submissions", tags=["submissions"])

# Lazy PocketBase client for fetching articles (admin auth)
_pb_client: PocketBaseClient | None = None


async def get_pb_client() -> PocketBaseClient:
    global _pb_client
    if _pb_client is None:
        _pb_client = PocketBaseClient()
        admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
        admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
        if not admin_email or not admin_password:
            raise HTTPException(
                status_code=500,
                detail="POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set",
            )
        ok = await _pb_client.authenticate_admin(admin_email, admin_password)
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to authenticate with PocketBase")
    return _pb_client


class GridPlacement(BaseModel):
    articleId: str | None  # PocketBase ID
    variant: str | None  # "factual", "sensationalist", "propaganda"
    isAd: bool
    adId: str | None = None
    headline: str | None = None
    body: str | None = None


class SubmitGridRequest(BaseModel):
    grid: list[GridPlacement]  # 16 items (4x4) or 6 (row1+row2+row3)
    user_id: int = 1


class SubmitGridResponse(BaseModel):
    submission_id: int
    score: float
    sales: int
    outrage_meter: float
    faction_balance: Dict[str, float]


def _normalize_grid(grid: list[GridPlacement]) -> List[Dict[str, Any]]:
    """Ensure grid is 16 cells for scoring (pad with empty cells if needed)."""
    raw = []
    for c in grid:
        if hasattr(c, "model_dump"):
            raw.append(c.model_dump())
        elif hasattr(c, "dict"):
            raw.append(c.dict())
        else:
            raw.append(dict(c) if c is not None else {})
    while len(raw) < 16:
        raw.append({"articleId": None, "variant": None, "isAd": False, "adId": None})
    return raw[:16]


def _build_placements(grid: List[Dict[str, Any]]) -> tuple[Dict[str, Dict], Dict[str, Dict]]:
    """Build article_placements and ad_placements from grid (position -> placement dict)."""
    article_placements: Dict[str, Dict[str, Any]] = {}
    ad_placements: Dict[str, Dict[str, Any]] = {}
    for i, cell in enumerate(grid):
        if cell.get("isAd") and cell.get("adId"):
            ad_placements[str(i)] = {"ad_id": cell.get("adId")}
        elif cell.get("articleId"):
            article_placements[str(i)] = {
                "article_id": cell["articleId"],
                "variant": cell.get("variant") or "factual",
            }
    return article_placements, ad_placements


@router.post("/submit", response_model=SubmitGridResponse)
async def submit_grid(request: SubmitGridRequest):
    """Submit a player's newspaper grid layout and return scoring results (no publish)."""
    grid = _normalize_grid(request.grid)
    article_placements, ad_placements = _build_placements(grid)

    # Fetch articles from PocketBase for synergy/tags
    article_ids = list({p["article_id"] for p in article_placements.values()})
    articles: List[Dict[str, Any]] = []
    if article_ids:
        try:
            pb = await get_pb_client()
            for aid in article_ids:
                rec = await pb.get_record_by_id("articles", aid)
                if rec:
                    tags = rec.get("tags")
                    if isinstance(tags, str):
                        try:
                            tags = json.loads(tags) if tags else {}
                        except Exception:
                            tags = {}
                    if not isinstance(tags, dict):
                        tags = {}
                    rec["tags"] = tags
                    articles.append(rec)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load articles: {str(e)}")

    scoring = ScoringService()
    result = scoring.calculate_scores(article_placements, ad_placements, articles, grid)

    return SubmitGridResponse(
        submission_id=0,
        score=result["final_score"],
        sales=result["sales"],
        outrage_meter=result["outrage_meter"],
        faction_balance=result["faction_balance"],
    )

