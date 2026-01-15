"""
Submissions API endpoints for player newspaper layouts.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.player_submission import PlayerSubmission
from app.models.user import User
from app.models.article import Article
from app.models.daily_edition import DailyEdition
from app.services.scoring_service import ScoringService

router = APIRouter(prefix="/submissions", tags=["submissions"])


class GridPlacement(BaseModel):
    articleId: int | None
    variant: str | None  # "factual", "sensationalist", "propaganda"
    isAd: bool
    adId: int | None


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
async def submit_grid(
    request: SubmitGridRequest,
    db: AsyncSession = Depends(get_db)
):
    """Submit a player's newspaper grid layout and get scoring results."""
    
    # Validate grid has 16 cells
    if len(request.grid) != 16:
        raise HTTPException(status_code=400, detail="Grid must have exactly 16 cells (4x4)")
    
    # Get or create user (for now, just use provided user_id)
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # Create default user if doesn't exist
        user = User(id=request.user_id, name=f"Player {request.user_id}", balance=0)
        db.add(user)
        await db.flush()
    
    # Get today's edition
    today = date.today()
    result = await db.execute(
        select(DailyEdition).where(DailyEdition.date == today)
    )
    edition = result.scalar_one_or_none()
    
    if not edition:
        raise HTTPException(status_code=404, detail="No daily edition found for today")
    
    # Get all articles for today
    result = await db.execute(
        select(Article).where(Article.daily_edition_id == edition.id)
    )
    articles = result.scalars().all()
    article_dict = {a.id: a for a in articles}
    
    # Convert grid to article_placements format
    article_placements = {}
    ad_placements = {}
    
    for index, cell in enumerate(request.grid):
        if cell.isAd and cell.adId:
            ad_placements[str(index)] = {"ad_id": cell.adId}
        elif cell.articleId and cell.articleId in article_dict:
            article_placements[str(index)] = {
                "article_id": cell.articleId,
                "variant": cell.variant or "factual"
            }
    
    # Calculate scores using ScoringService
    # Convert Pydantic models to dicts for scoring service
    grid_as_dicts = [
        {
            "articleId": cell.articleId,
            "variant": cell.variant,
            "isAd": cell.isAd,
            "adId": cell.adId,
        }
        for cell in request.grid
    ]
    
    scoring_service = ScoringService()
    scores = scoring_service.calculate_scores(
        article_placements,
        ad_placements,
        articles,
        grid_as_dicts
    )
    
    # Create submission
    submission = PlayerSubmission(
        user_id=user.id,
        date=today,
        article_placements=article_placements,
        ad_placements=ad_placements,
        final_score=scores["final_score"],
        sales=scores["sales"],
        outrage_meter=scores["outrage_meter"],
        faction_balance=scores["faction_balance"]
    )
    
    db.add(submission)
    await db.commit()
    await db.refresh(submission)
    
    return SubmitGridResponse(
        submission_id=submission.id,
        score=scores["final_score"],
        sales=scores["sales"],
        outrage_meter=scores["outrage_meter"],
        faction_balance=scores["faction_balance"]
    )

