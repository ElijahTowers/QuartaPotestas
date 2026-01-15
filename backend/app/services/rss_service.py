"""
RSS Service for fetching and parsing news feeds.
"""
import feedparser
from typing import List, Dict, Any
from datetime import datetime


class RSSService:
    """Service for fetching RSS feeds from various news sources."""
    
    # RSS feed source
    DEFAULT_FEEDS = [
        "https://feeds.bbci.co.uk/news/world/rss.xml",  # BBC News World
    ]
    
    @staticmethod
    def fetch_feed(feed_url: str) -> List[Dict[str, Any]]:
        """
        Fetch and parse a single RSS feed.
        
        Args:
            feed_url: URL of the RSS feed
            
        Returns:
            List of article dictionaries with title, link, summary, published
        """
        try:
            feed = feedparser.parse(feed_url)
            articles = []
            
            for entry in feed.entries:
                # Parse published date from <pubDate> tag using feedparser
                published_at = None
                
                # First try: use feedparser's parsed time (from pubDate)
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    try:
                        published_at = datetime(*entry.published_parsed[:6])
                    except Exception:
                        pass
                
                # Fallback: try to parse the published string directly
                if not published_at:
                    published_str = entry.get("published", "")
                    if published_str:
                        try:
                            from dateutil import parser as date_parser
                            published_at = date_parser.parse(published_str)
                        except Exception:
                            # Last resort: use current time
                            published_at = datetime.now()
                
                article = {
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "summary": entry.get("summary", entry.get("description", "")),
                    "published": entry.get("published", ""),  # Original pubDate string
                    "published_at": published_at,  # Parsed datetime from pubDate
                    "source": feed.feed.get("title", feed_url),
                }
                articles.append(article)
            
            # Sort by published_at (newest first), then take the latest 10
            articles.sort(key=lambda x: x["published_at"] if x["published_at"] else datetime.min, reverse=True)
            return articles[:10]  # Return only the 10 newest articles
            
        except Exception as e:
            print(f"Error fetching feed {feed_url}: {e}")
            return []
    
    @staticmethod
    def fetch_all_feeds(feed_urls: List[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch articles from multiple RSS feeds.
        
        Args:
            feed_urls: List of RSS feed URLs. If None, uses DEFAULT_FEEDS.
            
        Returns:
            Combined list of articles from all feeds, sorted by published_at (newest first)
        """
        if feed_urls is None:
            feed_urls = RSSService.DEFAULT_FEEDS
        
        all_articles = []
        for feed_url in feed_urls:
            articles = RSSService.fetch_feed(feed_url)
            all_articles.extend(articles)
        
        # Sort all articles by published_at (newest first) to ensure we get the latest across all feeds
        all_articles.sort(key=lambda x: x["published_at"] if x["published_at"] else datetime.min, reverse=True)
        
        return all_articles
    

