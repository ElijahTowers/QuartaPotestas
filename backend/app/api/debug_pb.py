"""
Debug API endpoints for PocketBase - Development and testing endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import date
import os
import sys

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient
from app.services.ingestion_service_pb import IngestionServicePB
from app.api.auth import get_current_user

router = APIRouter(prefix="/debug", tags=["debug"])

# Admin email - only this user can trigger ingestion
ADMIN_EMAIL = "lowiehartjes@gmail.com"

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
    
    return _pb_client


@router.post("/trigger-ingest")
async def trigger_ingest(
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger the ingestion process (PocketBase version).
    
    Only accessible by admin user (lowiehartjes@gmail.com).
    
    Returns:
        Ingestion results
    """
    # Check if user is admin
    user_email = current_user.get("email")
    
    # Debug logging
    print(f"[DEBUG trigger-ingest] User email: {user_email}, Admin email: {ADMIN_EMAIL}")
    print(f"[DEBUG trigger-ingest] Current user data: {current_user}")
    
    if user_email != ADMIN_EMAIL:
        raise HTTPException(
            status_code=403,
            detail=f"Only admin users can trigger ingestion. Your email: {user_email}, Required: {ADMIN_EMAIL}"
        )
    
    try:
        pb_client = await get_pb_client()
        ingestion_service = IngestionServicePB(pb_client)
        result = await ingestion_service.ingest_daily_articles()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.post("/reset-and-ingest")
async def reset_and_ingest(
    current_user: dict = Depends(get_current_user)
):
    """
    Delete today's articles and daily edition from PocketBase, then trigger a new ingestion.
    
    Only accessible by admin user (lowiehartjes@gmail.com).
    
    Returns:
        Ingestion results
    """
    # Check if user is admin
    user_email = current_user.get("email")
    
    # Debug logging
    print(f"[DEBUG reset-and-ingest] User email: {user_email}, Admin email: {ADMIN_EMAIL}")
    print(f"[DEBUG reset-and-ingest] Current user data: {current_user}")
    
    if user_email != ADMIN_EMAIL:
        raise HTTPException(
            status_code=403,
            detail=f"Only admin users can trigger ingestion. Your email: {user_email}, Required: {ADMIN_EMAIL}"
        )
    
    try:
        pb_client = await get_pb_client()
        today = date.today()
        
        # Find today's daily edition
        editions = await pb_client.get_list(
            "daily_editions",
            filter=f'date = "{today.isoformat()}"',
        )
        
        deleted_existing = False
        if editions:
            daily_edition = editions[0]
            edition_id = daily_edition["id"]
            
            # Delete all articles for today's edition
            articles = await pb_client.get_list(
                "articles",
                filter=f'daily_edition_id = "{edition_id}"',
            )
            for article in articles:
                await pb_client.delete_record("articles", article["id"])
            
            # Delete the daily edition
            await pb_client.delete_record("daily_editions", edition_id)
            deleted_existing = True
        
        # Trigger new ingestion
        ingestion_service = IngestionServicePB(pb_client)
        result = await ingestion_service.ingest_daily_articles()
        
        return {
            **result,
            "deleted_existing": deleted_existing
        }
    except Exception as e:
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

