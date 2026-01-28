from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Import PocketBase API modules
from app.api import debug_pb as debug, articles_pb as articles, ads, submissions, influence

app = FastAPI(
    title="Quarta Potestas API",
    description="Satirical Newspaper Simulation Game Backend",
    version="0.1.0"
)

# In-memory storage for published editions
editions_db: List[Dict[str, Any]] = []

# CORS middleware (will be needed for frontend)
# IMPORTANT: CORS middleware must be added BEFORE other middleware/routes
# Allow CORS from localhost and local network IPs
import os
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # Add your local network IP here (e.g., "http://192.168.1.209:3000")
    # Or use wildcard for development: "*" (less secure, but convenient)
]
# Allow all origins in development (comment out in production)
if os.getenv("ENV") != "production":
    allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(debug.router, prefix="/api")
app.include_router(articles.router, prefix="/api")
app.include_router(ads.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(influence.router, prefix="/api")

# Include auth router
from app.api import auth
app.include_router(auth.router, prefix="/api")

# Include feed router
from app.api import feed
app.include_router(feed.router, prefix="/api")

# Include published editions router
from app.api import published_editions
app.include_router(published_editions.router, prefix="/api")


@app.on_event("startup")
async def startup():
    print("✓ Using PocketBase as database backend")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure CORS headers are included even on errors."""
    import traceback
    print(f"Unhandled exception: {exc}")
    print(traceback.format_exc())
    # Get origin from request to allow CORS
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    )


@app.get("/")
async def root():
    return {"message": "Quarta Potestas API", "status": "operational"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Publish endpoint models
class GridCell(BaseModel):
    articleId: Optional[str] = None  # Changed from int to str for PocketBase IDs
    variant: Optional[str] = None  # "factual", "sensationalist", "propaganda"
    isAd: bool = False
    adId: Optional[str] = None  # Changed from int to str for string IDs
    headline: Optional[str] = None  # NEW: Store displayed headline
    body: Optional[str] = None  # NEW: Store displayed body text


class Stats(BaseModel):
    cash: float
    credibility: float
    readers: int


class PublishRequest(BaseModel):
    stats: Stats
    placedItems: List[GridCell]


@app.post("/publish")
async def publish(request: PublishRequest):
    """Publish the newspaper with the current stats and layout."""
    
    # Print received data to terminal for verification
    print("=" * 60)
    print("📰 NEWSPAPER PUBLISH REQUEST RECEIVED")
    print("=" * 60)
    print(f"💰 Stats:")
    print(f"   - Cash: ${request.stats.cash:,.2f}")
    print(f"   - Credibility: {request.stats.credibility:.1f}%")
    print(f"   - Readers: {request.stats.readers:,}")
    print(f"\n📋 Placed Items ({len(request.placedItems)} items):")
    
    for idx, item in enumerate(request.placedItems):
        if item.isAd and item.adId:
            print(f"   [{idx}] Ad ID: {item.adId}")
        elif item.articleId:
            print(f"   [{idx}] Article ID: {item.articleId}, Variant: {item.variant or 'factual'}")
        else:
            print(f"   [{idx}] Empty")
    
    print("=" * 60)
    
    # Create edition record
    edition_id = len(editions_db)  # Simple ID based on list length
    edition_data = {
        "id": edition_id,
        "published_at": datetime.now().isoformat(),
        "stats": {
            "cash": request.stats.cash,
            "credibility": request.stats.credibility,
            "readers": request.stats.readers,
        },
        "placedItems": [
            {
                "articleId": item.articleId,
                "variant": item.variant,
                "isAd": item.isAd,
                "adId": item.adId,
            }
            for item in request.placedItems
        ],
    }
    
    # Store in memory
    editions_db.append(edition_data)
    
    print(f"✅ Edition stored with ID: {edition_id}")
    print(f"📊 Total editions in database: {len(editions_db)}")
    
    return {
        "status": "success",
        "message": "Newspaper published!",
        "id": edition_id,
    }


@app.get("/edition/{edition_id}")
async def get_edition(edition_id: int):
    """Retrieve a published edition by ID."""
    
    # Validate ID
    if edition_id < 0 or edition_id >= len(editions_db):
        raise HTTPException(
            status_code=404,
            detail=f"Edition with ID {edition_id} not found. Available IDs: 0-{len(editions_db) - 1}"
        )
    
    edition = editions_db[edition_id]
    
    return edition

