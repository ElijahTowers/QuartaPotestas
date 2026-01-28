"""
Submissions API endpoints for player newspaper layouts.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/submissions", tags=["submissions"])


class GridPlacement(BaseModel):
    articleId: str | None  # Changed from int to str for PocketBase IDs
    variant: str | None  # "factual", "sensationalist", "propaganda"
    isAd: bool
    adId: str | None  # Changed from int to str
    headline: str | None = None  # NEW: Store displayed headline
    body: str | None = None  # NEW: Store displayed body text


class SubmitGridRequest(BaseModel):
    grid: list[GridPlacement]  # 16 items representing 4x4 grid
    user_id: int = 1  # Default to user 1 for now (can be extended with auth)


class SubmitGridResponse(BaseModel):
    submission_id: int
    score: float
    sales: int
    outrage_meter: float
    faction_balance: Dict[str, float]


@router.post("/submit", response_model=SubmitGridResponse)
async def submit_grid(request: SubmitGridRequest):
    """Submit a player's newspaper grid layout and get scoring results."""
    raise HTTPException(status_code=501, detail="Submissions endpoint not yet implemented for PocketBase")

