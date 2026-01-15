"""
Ads API endpoints.
"""
from fastapi import APIRouter
import json
import os

router = APIRouter(prefix="/ads", tags=["ads"])


@router.get("/")
async def get_ads():
    """Get list of available ads."""
    # ads.json is in app/data/ads.json
    # __file__ is backend/app/api/ads.py
    # So we need to go: app/api -> app -> app/data
    ads_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),  # backend/app
        "data",
        "ads.json"
    )
    try:
        with open(ads_path, "r") as f:
            ads = json.load(f)
        return {"ads": ads}
    except Exception as e:
        return {"ads": [], "error": str(e)}

