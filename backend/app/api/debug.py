"""
Debug API endpoints for development and testing.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import date
from app.database import get_db
from app.services.ingestion_service import IngestionService
from app.models.daily_edition import DailyEdition
from app.models.article import Article

router = APIRouter(prefix="/debug", tags=["debug"])


@router.post("/trigger-ingest")
async def trigger_ingest(
    db: AsyncSession = Depends(get_db)
):
    """
    Manually trigger the ingestion process.
    
    Returns:
        Ingestion results
    """
    try:
        ingestion_service = IngestionService()
        result = await ingestion_service.ingest_daily_articles(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.post("/reset-and-ingest")
async def reset_and_ingest(
    db: AsyncSession = Depends(get_db)
):
    """
    Delete today's articles and daily edition, then trigger a new ingestion.
    
    Returns:
        Ingestion results
    """
    try:
        today = date.today()
        
        # Find today's daily edition
        result = await db.execute(
            select(DailyEdition).where(DailyEdition.date == today)
        )
        daily_edition = result.scalar_one_or_none()
        
        if daily_edition:
            # Delete all articles for today's edition
            await db.execute(
                delete(Article).where(Article.daily_edition_id == daily_edition.id)
            )
            
            # Delete the daily edition
            await db.delete(daily_edition)
            await db.commit()
        
        # Trigger new ingestion
        ingestion_service = IngestionService()
        result = await ingestion_service.ingest_daily_articles(db)
        
        return {
            **result,
            "deleted_existing": daily_edition is not None
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Reset and ingestion failed: {str(e)}")


@router.get("/check-ollama")
async def check_ollama():
    """
    Check if Ollama is available and the default model is installed.
    
    Returns:
        Status of Ollama availability
    """
    from app.services.ai_service import AIService
    
    is_available = AIService.check_ollama_available()
    return {
        "ollama_available": is_available,
        "model": AIService.DEFAULT_MODEL,
    }

