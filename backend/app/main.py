from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.database import engine, Base
from app.api import debug, articles, ads, submissions

app = FastAPI(
    title="Quarta Potestas API",
    description="Satirical Newspaper Simulation Game Backend",
    version="0.1.0"
)

# In-memory storage for published editions
editions_db: List[Dict[str, Any]] = []

# CORS middleware (will be needed for frontend)
# IMPORTANT: CORS middleware must be added BEFORE other middleware/routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js default ports
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


@app.on_event("startup")
async def startup():
    # Create tables (for development; use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure CORS headers are included even on errors."""
    import traceback
    print(f"Unhandled exception: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:3000",
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
    articleId: Optional[int] = None
    variant: Optional[str] = None  # "factual", "sensationalist", "propaganda"
    isAd: bool = False
    adId: Optional[int] = None


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

