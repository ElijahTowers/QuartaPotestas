"""
Ingestion Service - Orchestrates the daily ingestion process.
"""
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import json
import os

from app.services.rss_service import RSSService
from app.services.ai_service import AIService
from app.services.geo_service import GeoService
from app.models.daily_edition import DailyEdition
from app.models.article import Article


class IngestionService:
    """Service that orchestrates the daily ingestion of articles."""
    
    def __init__(self):
        self.rss_service = RSSService()
        self.ai_service = AIService()
        self.geo_service = GeoService()
    
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
    
    async def ingest_daily_articles(
        self,
        db: AsyncSession
    ) -> dict:
        """
        Main ingestion function that processes articles for the day.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with ingestion results
        """
        today = date.today()
        
        # Check if today's edition already exists
        result = await db.execute(
            select(DailyEdition).where(DailyEdition.date == today)
        )
        existing_edition = result.scalar_one_or_none()
        
        if existing_edition:
            # Return existing edition info
            return {
                "status": "already_exists",
                "edition_id": existing_edition.id,
                "date": str(today),
                "message": "Daily edition for today already exists"
            }
        
        # Create new daily edition
        daily_edition = DailyEdition(date=today, global_mood="Neutral")
        db.add(daily_edition)
        await db.flush()  # Get the ID
        
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
        for raw_article in raw_articles[:15]:  # Limit to 15 articles per day
            try:
                # Simplify the original article text using AI
                original_title = raw_article.get("title", "")
                original_content = raw_article.get("summary", raw_article.get("description", ""))
                
                # Simplify title and content to easier English
                simplified_title = self.ai_service.simplify_english(original_title)
                simplified_content = self.ai_service.simplify_english(original_content)
                
                # Use simplified text for variant generation
                title = simplified_title
                content = simplified_content
                
                # Get published timestamp from RSS (already parsed by feedparser)
                published_at = raw_article.get("published_at")
                if not published_at:
                    # Fallback: try to parse published string if available
                    published_str = raw_article.get("published", "")
                    if published_str:
                        try:
                            from dateutil import parser as date_parser
                            published_at = date_parser.parse(published_str)
                        except Exception:
                            # If parsing fails, use current time
                            from datetime import datetime
                            published_at = datetime.now()
                    else:
                        # No published string either, use current time
                        from datetime import datetime
                        published_at = datetime.now()
                
                # Debug: print published_at for first article
                if processed_count == 0:
                    print(f"First article published_at: {published_at} (type: {type(published_at)})")
                
                ai_result = self.ai_service.generate_article_variants(title, content)
                
                # Get coordinates
                location_city = ai_result.get("location_city", "Unknown")
                
                # If location is Unknown, try to extract it using Ollama
                if location_city == "Unknown" or not location_city:
                    print(f"Location is Unknown, attempting to extract location from article: {title[:50]}...")
                    location_city = self.ai_service.extract_location(title, content)
                    if location_city and location_city != "Unknown":
                        print(f"Extracted location: {location_city}")
                
                lat, lon = self.geo_service.get_coordinates(location_city)
                
                # Fallback coordinates if geocoding fails
                if lat is None or lon is None:
                    lat, lon = self.geo_service.get_fallback_coordinates(location_city)
                
                # If still no coordinates, try to detect country and use country center
                if lat is None or lon is None:
                    print(f"  No city coordinates found, attempting to detect country...")
                    country = self.ai_service.extract_country(title, content)
                    if country != "Unknown":
                        print(f"  Detected country: {country}, using country center")
                        lat, lon = self.geo_service.get_country_center(country)
                        # Update location_city to include country name for display
                        if lat and lon:
                            location_city = country
                
                # If still no coordinates, check if it's a global/worldwide article or truly unknown
                if lat is None or lon is None:
                    # Check if location mentions global/worldwide keywords
                    location_lower = location_city.lower() if location_city else ""
                    title_lower = title.lower()
                    content_lower = content.lower()
                    
                    global_keywords = ["global", "worldwide", "world", "international", "everywhere"]
                    is_global = any(keyword in title_lower or keyword in content_lower for keyword in global_keywords)
                    
                    if is_global or location_city == "Unknown":
                        print(f"  Article is global/worldwide or has no location, using Global marker")
                        lat, lon = self.geo_service.get_country_center("Global")
                        location_city = "Global"
                
                # Prepare tags with sentiment
                tags = {
                    "topic_tags": ai_result.get("tags", []),
                    "sentiment": ai_result.get("sentiment", "neutral"),
                }
                
                # Create article in database
                article = Article(
                    daily_edition_id=daily_edition.id,
                    original_title=title,
                    processed_variants=ai_result.get("processed_variants", {}),
                    tags=tags,
                    location_lat=lat,
                    location_lon=lon,
                    location_city=location_city,
                    date=today,
                    published_at=published_at,
                )
                
                db.add(article)
                processed_count += 1
                
            except Exception as e:
                print(f"Error processing article '{raw_article.get('title', 'Unknown')}': {e}")
                continue
        
        # Load ads (for later use in the game)
        ads = self.load_ads()
        
        await db.commit()
        
        return {
            "status": "success",
            "edition_id": daily_edition.id,
            "date": str(today),
            "articles_processed": processed_count,
            "ads_available": len(ads),
        }

