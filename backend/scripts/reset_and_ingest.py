#!/usr/bin/env python3
"""
Script to delete today's articles and trigger a new ingestion.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.models.daily_edition import DailyEdition
from app.models.article import Article
from app.services.ingestion_service import IngestionService
from datetime import date


async def reset_and_ingest():
    """Delete today's articles and daily edition, then trigger new ingestion."""
    
    # Database connection
    DATABASE_URL = "postgresql+asyncpg://quarta:quarta_dev@localhost:5432/quarta_potestas"
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            today = date.today()
            
            # Find today's daily edition
            result = await db.execute(
                select(DailyEdition).where(DailyEdition.date == today)
            )
            daily_edition = result.scalar_one_or_none()
            
            if daily_edition:
                print(f"Found daily edition for {today} (ID: {daily_edition.id})")
                
                # Delete all articles for today's edition
                await db.execute(
                    delete(Article).where(Article.daily_edition_id == daily_edition.id)
                )
                print(f"Deleted articles for daily edition {daily_edition.id}")
                
                # Delete the daily edition
                await db.delete(daily_edition)
                print(f"Deleted daily edition for {today}")
                
                await db.commit()
                print("✓ Successfully deleted today's data")
            else:
                print(f"No daily edition found for {today}")
            
            # Trigger new ingestion
            print("\nStarting new ingestion...")
            ingestion_service = IngestionService()
            result = await ingestion_service.ingest_daily_articles(db)
            
            print(f"\n✓ Ingestion complete!")
            print(f"  Status: {result['status']}")
            print(f"  Edition ID: {result['edition_id']}")
            print(f"  Articles processed: {result['articles_processed']}")
            print(f"  Ads available: {result['ads_available']}")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error: {e}", file=sys.stderr)
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_and_ingest())

