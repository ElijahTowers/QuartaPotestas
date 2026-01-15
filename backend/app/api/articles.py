"""
Articles API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import date, datetime
from typing import List
from pydantic import BaseModel, model_serializer

from app.database import get_db
from app.models.daily_edition import DailyEdition
from app.models.article import Article


router = APIRouter(prefix="/articles", tags=["articles"])


class ArticleResponse(BaseModel):
    id: int
    original_title: str
    processed_variants: dict
    tags: dict
    location_lat: float | None
    location_lon: float | None
    location_city: str | None
    date: str
    published_at: str | None

    @model_serializer
    def serialize_model(self):
        """Serialize the model, converting date to string."""
        data = dict(self)
        if 'date' in data and isinstance(data['date'], date):
            data['date'] = data['date'].isoformat()
        if 'published_at' in data and data['published_at']:
            if isinstance(data['published_at'], datetime):
                data['published_at'] = data['published_at'].isoformat()
        return data

    class Config:
        from_attributes = True


class DailyEditionResponse(BaseModel):
    id: int
    date: str
    global_mood: str | None
    articles: List[ArticleResponse]

    @model_serializer
    def serialize_model(self):
        """Serialize the model, converting date to string."""
        data = dict(self)
        if 'date' in data and isinstance(data['date'], date):
            data['date'] = data['date'].isoformat()
        return data

    class Config:
        from_attributes = True


def serialize_daily_edition(daily_edition: DailyEdition) -> dict:
    """Convert DailyEdition SQLAlchemy model to dict with string dates, sorted by published_at (newest first)."""
    # Sort articles by published_at (newest first), then by id as fallback
    sorted_articles = sorted(
        daily_edition.articles,
        key=lambda a: (a.published_at if a.published_at else datetime.min, -a.id),
        reverse=True
    )
    
    return {
        "id": daily_edition.id,
        "date": daily_edition.date.isoformat() if isinstance(daily_edition.date, date) else str(daily_edition.date),
        "global_mood": daily_edition.global_mood,
        "articles": [
            {
                "id": article.id,
                "original_title": article.original_title,
                "processed_variants": article.processed_variants,
                "tags": article.tags,
                "location_lat": article.location_lat,
                "location_lon": article.location_lon,
                "location_city": article.location_city,
                "date": article.date.isoformat() if isinstance(article.date, date) else str(article.date),
                "published_at": article.published_at.isoformat() if article.published_at and isinstance(article.published_at, datetime) else None,
            }
            for article in sorted_articles
        ],
    }


@router.get("/today", response_model=DailyEditionResponse)
async def get_today_articles(db: AsyncSession = Depends(get_db)):
    """Get today's daily edition with all articles."""
    today = date.today()
    
    result = await db.execute(
        select(DailyEdition)
        .where(DailyEdition.date == today)
        .options(selectinload(DailyEdition.articles))
    )
    daily_edition = result.scalar_one_or_none()
    
    if not daily_edition:
        raise HTTPException(status_code=404, detail="No daily edition found for today")
    
    # Manually serialize to ensure dates are strings
    return serialize_daily_edition(daily_edition)


@router.get("/latest", response_model=DailyEditionResponse)
async def get_latest_edition(db: AsyncSession = Depends(get_db)):
    """Get the latest daily edition with all articles."""
    from sqlalchemy import desc
    
    result = await db.execute(
        select(DailyEdition)
        .order_by(desc(DailyEdition.date))
        .options(selectinload(DailyEdition.articles))
        .limit(1)
    )
    daily_edition = result.scalar_one_or_none()
    
    if not daily_edition:
        raise HTTPException(status_code=404, detail="No daily edition found")
    
    # Manually serialize to ensure dates are strings
    return serialize_daily_edition(daily_edition)

