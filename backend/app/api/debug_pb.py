"""
Debug API endpoints for PocketBase - Development and testing endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import date
import os
import sys
import asyncio
import uuid
from typing import Dict, Any, List
from datetime import datetime, timedelta

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient
from app.services.ingestion_service_pb import IngestionServicePB
from app.api.auth import get_current_user

router = APIRouter(prefix="/debug", tags=["debug"])

# RSS poll scheduler (started from main.py startup if RSS_POLL_ENABLED=true)
_rss_scheduler = None

# RSS poll run history (last run + log for visibility)
_rss_poll_state: Dict[str, Any] = {
    "last_run_started_at": None,
    "last_run_finished_at": None,
    "last_run_result": None,
    "last_run_error": None,
    "last_run_log": [],  # last ~50 lines, newest last
}
# Bounded history of completed runs (newest first for API)
_rss_run_history: List[Dict[str, Any]] = []
_MAX_RSS_LOG_LINES = 50
_MAX_RSS_RUN_HISTORY = 30

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


def _append_run_to_history(started_at: str, finished_at: str, success: bool, result: dict = None, error: str = None):
    """Append one run to _rss_run_history (used by both scheduled and manual trigger)."""
    global _rss_run_history
    if success and result is not None:
        entry = {
            "started_at": started_at,
            "finished_at": finished_at,
            "success": True,
            "articles_processed": result.get("articles_processed", 0),
            "status": result.get("status", "unknown"),
            "duration_seconds": result.get("timing_stats", {}).get("total_seconds"),
        }
    else:
        entry = {
            "started_at": started_at,
            "finished_at": finished_at,
            "success": False,
            "error": error or "Unknown error",
        }
    _rss_run_history.insert(0, entry)
    _rss_run_history = _rss_run_history[:_MAX_RSS_RUN_HISTORY]


async def _run_trigger_ingest_job(job_id: str):
    """Background task: ingest only (no delete). Updates _job_storage and RSS run history."""
    global _rss_poll_state
    started_at = datetime.now().isoformat()
    _rss_poll_state["last_run_started_at"] = started_at
    _rss_poll_state["last_run_finished_at"] = None
    _rss_poll_state["last_run_result"] = None
    _rss_poll_state["last_run_error"] = None
    try:
        _job_storage[job_id]["status"] = "running"
        _job_storage[job_id]["progress"] = "Fetching RSS and processing articles..."
        _job_storage[job_id]["started_at"] = started_at
        steps = _job_storage[job_id]["steps"]

        def on_step(msg: str):
            steps.append({"ts": datetime.now().isoformat(), "message": msg})

        pb_client = await get_pb_client()
        await pb_client.ensure_articles_source_url_field()
        ingestion_service = IngestionServicePB(pb_client)
        result = await ingestion_service.ingest_daily_articles(on_step=on_step)
        finished_at = datetime.now().isoformat()
        _rss_poll_state["last_run_finished_at"] = finished_at
        _rss_poll_state["last_run_result"] = result
        _append_run_to_history(started_at, finished_at, True, result=result)
        _job_storage[job_id]["status"] = "completed"
        _job_storage[job_id]["progress"] = "Complete!"
        _job_storage[job_id]["result"] = result
        _job_storage[job_id]["completed_at"] = finished_at
    except Exception as e:
        finished_at = datetime.now().isoformat()
        _rss_poll_state["last_run_finished_at"] = finished_at
        _rss_poll_state["last_run_error"] = str(e)
        _append_run_to_history(started_at, finished_at, False, error=str(e))
        _job_storage[job_id]["status"] = "failed"
        _job_storage[job_id]["error"] = str(e)
        _job_storage[job_id]["completed_at"] = finished_at
        print(f"[trigger-ingest] Job {job_id} failed: {e}")


@router.post("/trigger-ingest")
async def trigger_ingest(
    current_user: dict = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    """
    Start ingestion in background (ingest only, no delete). Returns immediately with job_id.
    Same pattern as reset-and-ingest: avoids Cloudflare 524 timeout.
    Only accessible by admin user (lowiehartjes@gmail.com).
    Poll GET /api/debug/job-status/{job_id} for progress and result.
    """
    user_email = current_user.get("email")
    if user_email != ADMIN_EMAIL:
        raise HTTPException(
            status_code=403,
            detail=f"Only admin users can trigger ingestion. Your email: {user_email}, Required: {ADMIN_EMAIL}"
        )
    job_id = str(uuid.uuid4())
    _job_storage[job_id] = {
        "status": "pending",
        "progress": "Starting...",
        "steps": [],
        "created_at": datetime.now().isoformat(),
    }
    if background_tasks:
        background_tasks.add_task(_run_trigger_ingest_job, job_id)
    else:
        asyncio.create_task(_run_trigger_ingest_job(job_id))
    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Ingestion started. Poll GET /api/debug/job-status/{job_id} for progress.",
    }


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
        await pb_client.ensure_articles_source_url_field()
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


def _rss_log(msg: str):
    """Append a line to the RSS poll run log and keep size bounded."""
    global _rss_poll_state
    ts = datetime.now().strftime("%H:%M:%S")
    _rss_poll_state["last_run_log"].append(f"[{ts}] {msg}")
    if len(_rss_poll_state["last_run_log"]) > _MAX_RSS_LOG_LINES:
        _rss_poll_state["last_run_log"] = _rss_poll_state["last_run_log"][-_MAX_RSS_LOG_LINES:]
    print(f"[RSS poll] {msg}")


async def _fire_scheduled_ingestion():
    """
    Start scheduled ingestion in background without blocking the event loop.
    The scheduler calls this; it schedules _run_scheduled_ingestion and returns immediately
    so the site stays responsive while articles are being fetched/processed.
    """
    asyncio.create_task(_run_scheduled_ingestion())


async def _run_scheduled_ingestion():
    """Run ingestion in background (used by RSS poll scheduler)."""
    global _rss_poll_state, _rss_run_history
    print(f"[RSS poll] Scheduled job executed at {datetime.now().isoformat()}")
    started_at = datetime.now().isoformat()
    _rss_poll_state["last_run_started_at"] = started_at
    _rss_poll_state["last_run_finished_at"] = None
    _rss_poll_state["last_run_result"] = None
    _rss_poll_state["last_run_error"] = None
    _rss_log("Run started")
    try:
        _rss_log("Connecting to PocketBase...")
        pb_client = await get_pb_client()
        await pb_client.ensure_articles_source_url_field()
        ingestion_service = IngestionServicePB(pb_client)
        result = await ingestion_service.ingest_daily_articles(on_step=_rss_log)
        finished_at = datetime.now().isoformat()
        _rss_poll_state["last_run_finished_at"] = finished_at
        _rss_poll_state["last_run_result"] = result
        n = result.get("articles_processed", 0)
        status = result.get("status", "unknown")
        _rss_log(f"Run finished: status={status}, new articles={n}")
        if result.get("timing_stats"):
            total_s = result["timing_stats"].get("total_seconds", 0)
            _rss_log(f"Total processing time: {total_s}s")
        _append_run_to_history(started_at, finished_at, True, result=result)
    except Exception as e:
        finished_at = datetime.now().isoformat()
        _rss_poll_state["last_run_finished_at"] = finished_at
        _rss_poll_state["last_run_error"] = str(e)
        _rss_log(f"Run failed: {e}")
        _append_run_to_history(started_at, finished_at, False, error=str(e))


def start_rss_poll_scheduler():
    """Start background scheduler that periodically fetches RSS and ingests new articles into PocketBase."""
    global _rss_scheduler
    enabled = os.getenv("RSS_POLL_ENABLED", "false").lower() == "true"
    if not enabled:
        print("[RSS poll] Scheduler disabled (RSS_POLL_ENABLED not true)")
        return
    interval_minutes = int(os.getenv("RSS_POLL_INTERVAL_MINUTES", "30"))
    if interval_minutes < 5:
        interval_minutes = 5
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        _rss_scheduler = AsyncIOScheduler()
        # Explicit trigger: first run at now + interval, then every interval
        trigger = IntervalTrigger(minutes=interval_minutes, start_date=datetime.now())
        _rss_scheduler.add_job(
            _fire_scheduled_ingestion,
            trigger,
            id="rss_ingestion",
        )
        _rss_scheduler.start()
        job = _rss_scheduler.get_job("rss_ingestion")
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else "?"
        print(f"[RSS poll] Scheduler started: every {interval_minutes} min, first run at {next_run}")
    except Exception as e:
        print(f"[RSS poll] Failed to start scheduler: {e}")
        import traceback
        traceback.print_exc()


def _compute_scheduled_runs(next_run_time, interval_minutes: int, count: int = 10) -> List[str]:
    """Return next N scheduled run times as ISO strings. If next_run_time is None, use now + interval as fallback."""
    if interval_minutes <= 0:
        return []
    out = []
    try:
        if next_run_time is not None:
            base = next_run_time
        else:
            # Fallback: scheduler job may not have next_run_time set yet; show "next in interval_min, then +interval, ..."
            base = datetime.now() + timedelta(minutes=interval_minutes)
        for i in range(count):
            run_dt = base + timedelta(minutes=interval_minutes * i)
            out.append(run_dt.isoformat())
    except Exception:
        return []
    return out


@router.get("/rss-poll-status")
async def rss_poll_status(current_user: dict = Depends(get_current_user)):
    """
    See when the next RSS ingest run is, when the last run was, and what happened.
    Returns scheduled runs (geplande) and run history (uitgevoerde).
    Requires authentication.
    """
    global _rss_scheduler, _rss_poll_state, _rss_run_history
    enabled = os.getenv("RSS_POLL_ENABLED", "false").lower() == "true"
    interval_minutes = int(os.getenv("RSS_POLL_INTERVAL_MINUTES", "30"))
    next_run_at = None
    next_run_time = None
    if _rss_scheduler is not None:
        try:
            job = _rss_scheduler.get_job("rss_ingestion")
            if job and hasattr(job, "next_run_time") and job.next_run_time:
                next_run_time = job.next_run_time
                next_run_at = next_run_time.isoformat()
        except Exception:
            pass
    # Always compute scheduled_runs when enabled (fallback: now + interval if job.next_run_time was None)
    scheduled_runs = _compute_scheduled_runs(next_run_time, interval_minutes, 10) if enabled else []
    if enabled and not next_run_at and scheduled_runs:
        next_run_at = scheduled_runs[0]
    return {
        "enabled": enabled,
        "interval_minutes": interval_minutes,
        "next_run_at": next_run_at,
        "scheduled_runs": scheduled_runs,
        "run_history": list(_rss_run_history),
        "last_run_started_at": _rss_poll_state.get("last_run_started_at"),
        "last_run_finished_at": _rss_poll_state.get("last_run_finished_at"),
        "last_run_result": _rss_poll_state.get("last_run_result"),
        "last_run_error": _rss_poll_state.get("last_run_error"),
        "last_run_log": _rss_poll_state.get("last_run_log", []),
    }


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

