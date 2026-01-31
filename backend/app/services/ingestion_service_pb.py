"""
Ingestion Service for PocketBase - Writes articles to PocketBase instead of SQL
"""
from datetime import date, datetime
from typing import List, Dict, Any
import json
import os
import sys
import time

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.pocketbase_client import PocketBaseClient, serialize_for_pb
from app.services.rss_service import RSSService
from app.services.ai_service import AIService
from app.services.geo_service import GeoService


class IngestionServicePB:
    """Service that orchestrates the daily ingestion of articles into PocketBase."""
    
    # Test mode: limits articles to 5 for quick testing
    TEST_MODE = os.getenv("TEST_MODE", "true").lower() == "true"
    
    def __init__(self, pb_client: PocketBaseClient):
        self.pb = pb_client
        self.rss_service = RSSService()
        self.ai_service = AIService()
        self.geo_service = GeoService()
        
        if IngestionServicePB.TEST_MODE:
            print("[IngestionServicePB] TEST MODE ENABLED - Only processing 5 articles")
    
    async def _get_or_create_system_user(self) -> str:
        """Get or create a system user for ingestion."""
        # Try to find existing system user
        users = await self.pb.get_list(
            "users",
            filter='email = "system@ingestion.local"',
        )
        
        if users:
            return users[0]["id"]
        
        # Create system user if it doesn't exist
        system_user_data = {
            "email": "system@ingestion.local",
            "password": "system_password_change_me",
            "passwordConfirm": "system_password_change_me",
        }
        
        system_user = await self.pb.create_record("users", system_user_data)
        if not system_user:
            raise Exception("Failed to create system user for ingestion")
        
        return system_user["id"]
    
    def load_ads(self) -> List[dict]:
        """Load predefined ads from JSON file."""
        ads_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "data",
            "ads.json"
        )
        try:
            with open(ads_path, "r") as f:
                ads = json.load(f)
            return ads
        except Exception as e:
            print(f"Error loading ads: {e}")
            return []
    
    async def ingest_daily_articles(self) -> dict:
        """
        Main ingestion function that processes articles for the day.
        Writes to PocketBase instead of SQL.
        """
        today = date.today()
        
        # Get or create system user for ingestion
        system_user_id = await self._get_or_create_system_user()
        
        # Check if today's edition already exists in PocketBase
        existing_editions = await self.pb.get_list(
            "daily_editions",
            filter=f'date = "{today.isoformat()}"',
        )
        
        if existing_editions:
            existing_edition = existing_editions[0]
            return {
                "status": "already_exists",
                "edition_id": existing_edition["id"],
                "date": str(today),
                "message": "Daily edition for today already exists"
            }
        
        # Create new daily edition in PocketBase
        edition_data = {
            "date": today.isoformat(),
            "global_mood": "Neutral",
            "user": system_user_id,  # Link to system user
        }
        daily_edition = await self.pb.create_record("daily_editions", edition_data)
        
        if not daily_edition:
            raise Exception("Failed to create daily edition in PocketBase")
        
        daily_edition_id = daily_edition["id"]
        
        # Fetch articles from RSS feeds
        try:
            raw_articles = self.rss_service.fetch_all_feeds()
            if not raw_articles:
                raise Exception("No articles fetched from RSS feeds")
        except Exception as e:
            print(f"Error fetching RSS feeds: {e}")
            raise Exception(f"Failed to fetch articles from RSS feeds: {e}")
        
        # Process articles
        processed_count = 0
        articles_to_process = raw_articles[:5] if IngestionServicePB.TEST_MODE else raw_articles
        if IngestionServicePB.TEST_MODE and len(raw_articles) > 5:
            print(f"[IngestionServicePB] TEST MODE: Processing only 5 of {len(raw_articles)} articles")
        
        # Track timing for each scoop
        scoop_timings: List[Dict[str, Any]] = []
        
        for idx, raw_article in enumerate(articles_to_process, start=1):
            scoop_start_time = time.time()
            scoop_title = raw_article.get("title", f"Article {idx}")[:50]  # Truncate for logging
            
            try:
                step_timings = {}
                
                # Simplify the original article text using AI
                original_title = raw_article.get("title", "")
                original_content = raw_article.get("summary", raw_article.get("description", ""))
                
                # Simplify title and content
                step_start = time.time()
                simplified_title = self.ai_service.simplify_english(original_title, max_words=10)
                step_timings["simplify_title"] = round(time.time() - step_start, 2)
                
                step_start = time.time()
                simplified_content = self.ai_service.simplify_english(original_content)
                step_timings["simplify_content"] = round(time.time() - step_start, 2)
                
                title = simplified_title
                content = simplified_content
                
                # Get published timestamp
                published_at = raw_article.get("published_at")
                if not published_at:
                    published_str = raw_article.get("published", "")
                    if published_str:
                        try:
                            from dateutil import parser as date_parser
                            published_at = date_parser.parse(published_str)
                        except Exception:
                            published_at = datetime.now()
                    else:
                        published_at = datetime.now()
                
                step_start = time.time()
                ai_result = self.ai_service.generate_article_variants(title, content)
                step_timings["generate_variants"] = round(time.time() - step_start, 2)
                
                # Get coordinates
                location_city = ai_result.get("location_city", "Unknown")
                
                step_start = time.time()
                if location_city == "Unknown" or not location_city:
                    location_city = self.ai_service.extract_location(title, content)
                    step_timings["extract_location"] = round(time.time() - step_start, 2)
                else:
                    step_timings["extract_location"] = 0
                
                step_start = time.time()
                lat, lon = self.geo_service.get_coordinates(location_city)
                step_timings["geocoding"] = round(time.time() - step_start, 2)
                
                # Fallback coordinates
                if lat is None or lon is None:
                    lat, lon = self.geo_service.get_fallback_coordinates(location_city)
                
                step_start = time.time()
                if lat is None or lon is None:
                    country = self.ai_service.extract_country(title, content)
                    step_timings["extract_country"] = round(time.time() - step_start, 2)
                    if country != "Unknown":
                        lat, lon = self.geo_service.get_country_center(country)
                        if lat and lon:
                            location_city = country
                else:
                    step_timings["extract_country"] = 0
                
                if lat is None or lon is None:
                    location_lower = location_city.lower() if location_city else ""
                    title_lower = title.lower()
                    content_lower = content.lower()
                    
                    global_keywords = ["global", "worldwide", "world", "international", "everywhere"]
                    is_global = any(keyword in title_lower or keyword in content_lower for keyword in global_keywords)
                    
                    if is_global or location_city == "Unknown":
                        lat, lon = self.geo_service.get_country_center("Global")
                        location_city = "Global"
                
                # Final fallback: if coordinates are still None, assign to Global location
                if lat is None or lon is None:
                    lat, lon = self.geo_service.get_country_center("Global")
                    location_city = "Global"
                
                # Get country code (NEW)
                country_code = ai_result.get("country_code", "XX")
                
                # Prepare tags
                tags = {
                    "topic_tags": ai_result.get("tags", []),
                    "sentiment": ai_result.get("sentiment", "neutral"),
                }
                
                # Get audience scores (NEW)
                audience_scores = ai_result.get("audience_scores", {
                    "elite": 0,
                    "working_class": 0,
                    "patriots": 0,
                    "syndicate": 0,
                    "technocrats": 0,
                    "faithful": 0,
                    "resistance": 0,
                    "doomers": 0,
                })
                
                # Create article in PocketBase
                article_data = serialize_for_pb({
                    "daily_edition_id": daily_edition_id,
                    "original_title": title,
                    "processed_variants": ai_result.get("processed_variants", {}),
                    "tags": tags,
                    "location_lat": lat,
                    "location_lon": lon,
                    "location_city": location_city,
                    "country_code": country_code,  # NEW: Add country code
                    "assistant_comment": ai_result.get("assistant_comment", "This looks like a solid lead."),  # NEW: Add assistant comment
                    "audience_scores": audience_scores,  # NEW: Add audience scores
                    "date": today.isoformat(),
                    "published_at": published_at.isoformat() if isinstance(published_at, datetime) else published_at,
                    "user": system_user_id,  # Link to system user
                })
                
                # Convert JSON fields to strings for PocketBase
                article_data["processed_variants"] = json.dumps(article_data["processed_variants"])
                article_data["tags"] = json.dumps(article_data["tags"])
                article_data["audience_scores"] = json.dumps(article_data["audience_scores"])
                
                step_start = time.time()
                article = await self.pb.create_record("articles", article_data)
                step_timings["save_to_db"] = round(time.time() - step_start, 2)
                
                scoop_end_time = time.time()
                scoop_duration = scoop_end_time - scoop_start_time
                
                if article:
                    processed_count += 1
                    scoop_timings.append({
                        "scoop_index": idx,
                        "title": scoop_title,
                        "duration_seconds": round(scoop_duration, 2),
                        "status": "success",
                        "step_timings": step_timings
                    })
                    print(f"[IngestionServicePB] ✅ Scoop {idx}/{len(articles_to_process)} processed in {scoop_duration:.2f}s: {scoop_title}")
                    print(f"  Step breakdown: {json.dumps(step_timings, indent=2)}")
                else:
                    scoop_timings.append({
                        "scoop_index": idx,
                        "title": scoop_title,
                        "duration_seconds": round(scoop_duration, 2),
                        "status": "failed",
                        "error": "Failed to create article record",
                        "step_timings": step_timings
                    })
                    print(f"[IngestionServicePB] ❌ Failed to create article: {title[:50]}... (took {scoop_duration:.2f}s)")
                
            except Exception as e:
                scoop_end_time = time.time()
                scoop_duration = scoop_end_time - scoop_start_time
                scoop_timings.append({
                    "scoop_index": idx,
                    "title": scoop_title,
                    "duration_seconds": round(scoop_duration, 2),
                    "status": "error",
                    "error": str(e),
                    "step_timings": step_timings if 'step_timings' in locals() else {}
                })
                print(f"[IngestionServicePB] ❌ Error processing article '{raw_article.get('title', 'Unknown')}': {e} (took {scoop_duration:.2f}s)")
                continue
        
        # Load ads (for later use)
        ads = self.load_ads()
        
        # Calculate timing statistics
        total_time = sum(s["duration_seconds"] for s in scoop_timings)
        avg_time = total_time / len(scoop_timings) if scoop_timings else 0
        min_time = min(s["duration_seconds"] for s in scoop_timings) if scoop_timings else 0
        max_time = max(s["duration_seconds"] for s in scoop_timings) if scoop_timings else 0
        
        return {
            "status": "success",
            "edition_id": daily_edition_id,
            "date": str(today),
            "articles_processed": processed_count,
            "ads_available": len(ads),
            "scoop_timings": scoop_timings,
            "timing_stats": {
                "total_seconds": round(total_time, 2),
                "average_seconds": round(avg_time, 2),
                "min_seconds": round(min_time, 2),
                "max_seconds": round(max_time, 2),
                "total_scoops": len(scoop_timings)
            }
        }

