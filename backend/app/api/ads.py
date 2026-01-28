"""
Ads API endpoints - Public feed for all ads (similar to scoops feed)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import httpx

# Import auth dependencies
from app.api.auth import get_current_user

router = APIRouter(prefix="/ads", tags=["ads"])


class AdResponse(BaseModel):
    """Response model for an ad"""
    id: str  # Changed from int to str - use PocketBase string ID directly
    company: str
    tagline: str = ""
    description: str = ""
    tags: List[str] = []


class AdsResponse(BaseModel):
    """Response model for the ads endpoint"""
    items: List[AdResponse]
    total: int


@router.get("", response_model=AdsResponse)
async def get_ads(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get all ads from PocketBase (requires user authentication).
    
    All authenticated users see the same shared ads.
    Similar to the scoops feed, but for ads.
    """
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    
    try:
        print(f"[/api/ads] Fetching ads for user: {current_user.get('email', 'unknown')}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch all ads from PocketBase (no auth header needed - ads are public)
            url = f"{pocketbase_url}/api/collections/ads/records"
            print(f"[/api/ads] Requesting: {url}")
            
            response = await client.get(
                url,
                params={
                    "perPage": 100,  # Get up to 100 ads
                    # Note: PocketBase sort parameter can cause 400 errors, so we don't use it
                },
            )
            
            print(f"[/api/ads] Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                print(f"[/api/ads] Got {len(items)} items from PocketBase")
                
                # Map PocketBase records to AdResponse
                ads = []
                for item in items:
                    # Get tags - can be JSON string or list or empty
                    tags = item.get("tags", [])
                    if isinstance(tags, str):
                        try:
                            tags = json.loads(tags)
                        except:
                            tags = []
                    if not isinstance(tags, list):
                        tags = []
                    
                    # Convert string ID to numeric ID using hash function
                    string_id = item.get("id", "")
                    # Use string ID directly - it's unique and avoids precision loss
                    
                    # Get company name - use company field, fallback to headline
                    company = item.get("company", "") or item.get("headline", "") or "Unknown"
                    
                    # Get tagline - use headline field if available
                    tagline = item.get("headline", "")
                    
                    # Get description - use body field if available
                    description = item.get("body", "") or item.get("description", "")
                    
                    ads.append(AdResponse(
                        id=string_id,  # Use string ID directly
                        company=company,
                        tagline=tagline,
                        description=description,
                        tags=tags,
                    ))
                
                print(f"[/api/ads] Mapped {len(ads)} ads")
                return AdsResponse(
                    items=ads,
                    total=len(ads),
                )
            else:
                error_text = await response.atext() if hasattr(response, 'atext') else response.text
                print(f"[/api/ads] Error: {error_text[:300]}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch ads: {error_text[:100]}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[/api/ads] Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
