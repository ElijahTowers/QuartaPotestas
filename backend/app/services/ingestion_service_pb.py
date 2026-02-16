"""
Ingestion Service for PocketBase - Writes articles to PocketBase instead of SQL
"""
from datetime import date, datetime
from typing import List, Dict, Any, Optional, Callable
import json
import os
import sys
import time

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import asyncio
from lib.pocketbase_client import PocketBaseClient, serialize_for_pb
from lib.article_extractor import extract_full_text
from app.services.rss_service import RSSService
from app.services.ai_service import AIService
from app.services.geo_service import GeoService


class IngestionServicePB:
    """Service that orchestrates the daily ingestion of articles into PocketBase."""
    
    # Test mode: limits articles per run for quick testing (set TEST_MODE=false to process all)
    TEST_MODE = os.getenv("TEST_MODE", "true").lower() == "true"
    # Max articles to process per run when TEST_MODE is true (set INGEST_MAX_ARTICLES=0 for no limit)
    MAX_ARTICLES_PER_RUN = int(os.getenv("INGEST_MAX_ARTICLES", "5") or "5")
    
    def __init__(self, pb_client: PocketBaseClient):
        self.pb = pb_client
        self.rss_service = RSSService()
        self.ai_service = AIService()
        self.geo_service = GeoService()
        
        if IngestionServicePB.TEST_MODE and IngestionServicePB.MAX_ARTICLES_PER_RUN > 0:
            print(f"[IngestionServicePB] TEST MODE - Processing up to {IngestionServicePB.MAX_ARTICLES_PER_RUN} articles per run")
    
    async def _get_or_create_system_user(self) -> str:
        """Get or create a system user for ingestion."""
        try:
            # Try to find existing system user
            print(f"[IngestionServicePB] Checking for existing system user...")
            users = await self.pb.get_list(
                "users",
                filter='email = "system@ingestion.local"',
            )
            
            if users and len(users) > 0:
                user_id = users[0]["id"]
                print(f"[IngestionServicePB] Found existing system user: {user_id}")
                return user_id
            
            # Check if admin token is available
            if not hasattr(self.pb, 'admin_token') or not self.pb.admin_token:
                raise Exception("Admin token not available. Cannot create system user without admin authentication.")
            
            # Create system user if it doesn't exist
            system_user_data = {
                "email": "system@ingestion.local",
                "password": "system_password_change_me",
                "passwordConfirm": "system_password_change_me",
            }
            
            print(f"[IngestionServicePB] Creating system user: {system_user_data['email']}")
            print(f"[IngestionServicePB] Admin token available: {bool(self.pb.admin_token)}")
            
            try:
                system_user = await self.pb.create_record("users", system_user_data)
            except Exception as create_error:
                error_details = str(create_error)
                # User may already exist (email unique) - refetch
                if "validation_not_unique" in error_details or "Value must be unique" in error_details or "unique" in error_details.lower():
                    print(f"[IngestionServicePB] User exists (email unique), fetching existing user...")
                    for use_filter in [True, False]:
                        users = await self.pb.get_list("users", per_page=500, filter='email = "system@ingestion.local"' if use_filter else None)
                        found = [u for u in (users or []) if (u.get("email") or "") == "system@ingestion.local"]
                        if found:
                            user_id = found[0]["id"]
                            print(f"[IngestionServicePB] Using existing system user: {user_id}")
                            return user_id
                print(f"[IngestionServicePB] create_record raised exception: {error_details}")
                raise Exception(f"Failed to create system user: {error_details}")
            
            if not system_user:
                raise Exception("Failed to create system user for ingestion: create_record returned None")
            
            user_id = system_user.get("id")
            if not user_id:
                raise Exception(f"System user created but no ID returned. Response: {system_user}")
            
            print(f"[IngestionServicePB] System user created successfully: {user_id}")
            return user_id
        except Exception as e:
            error_msg = f"Failed to get or create system user for ingestion: {str(e)}"
            print(f"[IngestionServicePB] ERROR: {error_msg}")
            raise Exception(error_msg)
    
    async def _get_existing_article_source_urls(self) -> set:
        """Fetch all articles' source_url from PocketBase (paginated) for incremental RSS check."""
        seen: set = set()
        page = 1
        per_page = 500
        while True:
            items = await self.pb.get_list("articles", page=page, per_page=per_page)
            if not items:
                break
            for item in items:
                url = (item.get("source_url") or "").strip()
                if url:
                    seen.add(url)
            if len(items) < per_page:
                break
            page += 1
        return seen
    
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
    
    def _step(self, on_step: Optional[Callable[[str], None]], message: str) -> None:
        """Emit a step message for live monitor if callback provided."""
        if on_step:
            try:
                on_step(message)
            except Exception:
                pass

    async def ingest_daily_articles(self, on_step: Optional[Callable[[str], None]] = None) -> dict:
        """
        Main ingestion function that processes articles for the day.
        Writes to PocketBase instead of SQL.
        on_step: optional callback(message) for live step-by-step progress on monitor.
        """
        today = date.today()
        self._step(on_step, "Run gestart.")

        # Get or create system user for ingestion
        self._step(on_step, "Systeemgebruiker ophalen…")
        system_user_id = await self._get_or_create_system_user()

        # Get or create today's daily edition in PocketBase
        self._step(on_step, "Dageditie ophalen of aanmaken…")
        existing_editions = await self.pb.get_list(
            "daily_editions",
            filter=f'date = "{today.isoformat()}"',
        )
        
        if existing_editions:
            daily_edition_id = existing_editions[0]["id"]
            # Continue to fetch RSS and process new articles (duplicates are skipped below)
        else:
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
        
        # Fetch articles from RSS: pubDate gisteren 18:00 NL t/m nu; daarna vergelijken met PB
        self._step(on_step, "RSS-feeds ophalen…")
        try:
            raw_articles = self.rss_service.fetch_all_feeds()  # window: yesterday 18:00 Dutch → now
            if not raw_articles:
                raise Exception("No articles fetched from RSS feeds")
        except Exception as e:
            print(f"Error fetching RSS feeds: {e}")
            raise Exception(f"Failed to fetch articles from RSS feeds: {e}")
        self._step(on_step, f"RSS opgehaald: {len(raw_articles)} artikelen.")

        # Get existing article source URLs from PocketBase (RSS link = unique id)
        self._step(on_step, "Bestaande artikelen in PB vergelijken…")
        existing_source_urls = await self._get_existing_article_source_urls()
        # Dedupe by link: same URL may appear in multiple feeds or from parallel runs
        seen_links: set = set()
        new_raw_articles = []
        for a in raw_articles:
            link = (a.get("link") or "").strip()
            if not link:
                continue
            if link in existing_source_urls or link in seen_links:
                continue
            seen_links.add(link)
            new_raw_articles.append(a)
        skipped_existing = len(raw_articles) - len(new_raw_articles)
        if skipped_existing:
            print(f"[IngestionServicePB] Skipping {skipped_existing} articles already in PocketBase (by source_url)")
        if not new_raw_articles:
            self._step(on_step, f"Geen nieuwe artikelen. Klaar. ({skipped_existing} al in PB.)")
            print(f"[IngestionServicePB] No new articles from RSS (all {len(raw_articles)} already in PB). Done.")
            return {
                "status": "success",
                "edition_id": daily_edition_id,
                "date": str(today),
                "articles_processed": 0,
                "ads_available": len(self.load_ads()),
                "scoop_timings": [],
                "timing_stats": {"total_seconds": 0, "average_seconds": 0, "min_seconds": 0, "max_seconds": 0, "total_scoops": 0},
                "skipped_already_in_pb": skipped_existing,
            }
        
        # Process only new articles (optionally limited per run when TEST_MODE + INGEST_MAX_ARTICLES)
        limit = IngestionServicePB.MAX_ARTICLES_PER_RUN if (IngestionServicePB.TEST_MODE and IngestionServicePB.MAX_ARTICLES_PER_RUN > 0) else None
        articles_to_process = new_raw_articles[:limit] if limit else new_raw_articles
        total_to_process = len(articles_to_process)
        if limit and len(new_raw_articles) > limit:
            print(f"[IngestionServicePB] Processing {limit} of {len(new_raw_articles)} new articles (set INGEST_MAX_ARTICLES=0 or TEST_MODE=false for all)")
        self._step(on_step, f"{total_to_process} nieuwe artikelen om te verwerken.")

        # Track timing for each scoop
        scoop_timings: List[Dict[str, Any]] = []
        processed_count = 0

        for idx, raw_article in enumerate(articles_to_process, start=1):
            scoop_start_time = time.time()
            scoop_title = raw_article.get("title", f"Article {idx}")[:50]  # Truncate for logging
            self._step(on_step, f"Artikel {idx}/{total_to_process}: {scoop_title}…")

            try:
                step_timings = {}
                
                original_title = raw_article.get("title", "")
                rss_summary = raw_article.get("summary", raw_article.get("description", ""))
                article_url = raw_article.get("link", "")
                
                # Try to fetch full article text first (runs in thread to avoid blocking)
                step_start = time.time()
                full_text = await asyncio.to_thread(extract_full_text, article_url) if article_url else None
                step_timings["extract_full_text"] = round(time.time() - step_start, 2)
                
                # Use full text if available, else fall back to RSS summary
                raw_content = full_text if full_text else rss_summary
                if full_text:
                    self._step(on_step, "  (full article text used)")
                    # Truncate to first ~500 words: main article is usually at top, sidebar/related later
                    words = raw_content.split()
                    if len(words) > 500:
                        raw_content = " ".join(words[:500]) + "…"
                
                # Simplify title (always)
                step_start = time.time()
                simplified_title = self.ai_service.simplify_english(original_title, max_words=10)
                step_timings["simplify_title"] = round(time.time() - step_start, 2)
                
                # Simplify content only when short (RSS summary); long full text goes direct to AI
                step_start = time.time()
                if raw_content and len(raw_content.split()) <= 150:
                    simplified_content = self.ai_service.simplify_english(raw_content)
                    step_timings["simplify_content"] = round(time.time() - step_start, 2)
                else:
                    simplified_content = raw_content or rss_summary
                    step_timings["simplify_content"] = 0
                
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
                # When using full article text, anchor the AI to RSS title + summary to prevent drift
                rss_title_anchor = original_title if full_text else None
                rss_summary_anchor = rss_summary if full_text else None
                ai_result = self.ai_service.generate_article_variants(
                    title, content,
                    rss_title_anchor=rss_title_anchor,
                    rss_summary_anchor=rss_summary_anchor
                )
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
                
                # Re-check source_url before create: another ingestion run may have added it (race condition)
                source_url = (raw_article.get("link") or "").strip()
                if source_url:
                    check = await self.pb.get_list("articles", per_page=1, filter=f'source_url = "{source_url}"')
                    if check:
                        self._step(on_step, "  (skipped: already exists, concurrent run?)")
                        continue
                step_timings["check_duplicate"] = 0

                # Create article in PocketBase (include source_url for incremental RSS runs)
                article_data = serialize_for_pb({
                    "daily_edition_id": daily_edition_id,
                    "original_title": title,
                    "source_url": (raw_article.get("link") or "").strip(),
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
                    self._step(on_step, f"Artikel {idx}/{total_to_process} opgeslagen.")
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
        
        self._step(on_step, f"Klaar. {processed_count} artikelen verwerkt.")

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
            },
            "skipped_already_in_pb": skipped_existing,
        }

