"""
Debug API endpoints for PocketBase - Development and testing endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import date
import os
import sys
import asyncio
import uuid
from typing import Dict, Any
from datetime import datetime

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

# In-memory job storage (for async ingestion jobs)
_job_storage: Dict[str, Dict[str, Any]] = {}


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


async def _run_ingestion_job(job_id: str):
    """Background task to run the ingestion process"""
    try:
        _job_storage[job_id]["status"] = "running"
        _job_storage[job_id]["progress"] = "Initializing..."
        _job_storage[job_id]["started_at"] = datetime.now().isoformat()
        
        pb_client = await get_pb_client()
        today = date.today()
        
        # Find today's daily edition
        _job_storage[job_id]["progress"] = "Deleting existing articles..."
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
        _job_storage[job_id]["progress"] = "Fetching and processing articles..."
        ingestion_service = IngestionServicePB(pb_client)
        result = await ingestion_service.ingest_daily_articles()
        
        _job_storage[job_id]["status"] = "completed"
        _job_storage[job_id]["progress"] = "Complete!"
        _job_storage[job_id]["result"] = {
            **result,
            "deleted_existing": deleted_existing
        }
        _job_storage[job_id]["completed_at"] = datetime.now().isoformat()
        
    except Exception as e:
        _job_storage[job_id]["status"] = "failed"
        _job_storage[job_id]["error"] = str(e)
        _job_storage[job_id]["completed_at"] = datetime.now().isoformat()
        print(f"[reset-and-ingest] Job {job_id} failed: {e}")


@router.post("/reset-and-ingest")
async def reset_and_ingest(
    current_user: dict = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """
    Delete today's articles and daily edition from PocketBase, then trigger a new ingestion.
    
    This endpoint now returns immediately with a job ID. Use /debug/job-status/{job_id} to check progress.
    
    Only accessible by admin user (lowiehartjes@gmail.com).
    
    Returns:
        Job ID and initial status
    """
    # Check if user is admin
    user_email = current_user.get("email")
    
    # Debug logging
    print(f"[DEBUG reset-and-ingest] User email: {user_email}, Admin email: {ADMIN_EMAIL}")
    
    if user_email != ADMIN_EMAIL:
        raise HTTPException(
            status_code=403,
            detail=f"Only admin users can trigger ingestion. Your email: {user_email}, Required: {ADMIN_EMAIL}"
        )
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Initialize job status
    _job_storage[job_id] = {
        "status": "pending",
        "progress": "Starting...",
        "created_at": datetime.now().isoformat(),
    }
    
    # Start background task
    if background_tasks:
        background_tasks.add_task(_run_ingestion_job, job_id)
    else:
        # Fallback: run in background using asyncio
        asyncio.create_task(_run_ingestion_job(job_id))
    
    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Ingestion job started. Use /debug/job-status/{job_id} to check progress."
    }


@router.get("/job-status/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the status of an ingestion job.
    
    Returns:
        Job status, progress, and result (if completed)
    """
    if job_id not in _job_storage:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = _job_storage[job_id].copy()
    
    # Clean up old completed jobs (older than 1 hour)
    current_time = datetime.now()
    for jid, data in list(_job_storage.items()):
        if data.get("status") in ["completed", "failed"]:
            completed_at = data.get("completed_at")
            if completed_at:
                try:
                    completed_dt = datetime.fromisoformat(completed_at)
                    if (current_time - completed_dt).total_seconds() > 3600:  # 1 hour
                        del _job_storage[jid]
                except:
                    pass
    
    return job_data


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

