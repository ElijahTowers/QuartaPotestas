"""
RSS Service for fetching and parsing news feeds.
Uses Dutch time (Europe/Amsterdam): each run selects articles with pubDate
from yesterday 18:00 Dutch time up to and including the moment the job runs.
"""
import feedparser
from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone, time
from calendar import timegm

try:
    import pytz
    DUTCH_TZ = pytz.timezone("Europe/Amsterdam")
except ImportError:
    DUTCH_TZ = None  # fallback to naive comparison if pytz missing


class RSSService:
    """Service for fetching RSS feeds from various news sources."""

    DEFAULT_FEEDS = [
        "https://feeds.bbci.co.uk/news/world/rss.xml",  # BBC News World
    ]

    @staticmethod
    def _now_dutch() -> datetime:
        """Current time in Dutch timezone (Europe/Amsterdam)."""
        if DUTCH_TZ:
            return datetime.now(DUTCH_TZ)
        return datetime.now()

    @staticmethod
    def get_cutoff_start() -> datetime:
        """
        Start of the selection window: gisteren 18:00 Nederlandse tijd.
        Returns timezone-aware datetime in Europe/Amsterdam.
        """
        if DUTCH_TZ:
            now_dutch = datetime.now(DUTCH_TZ)
            yesterday = (now_dutch - timedelta(days=1)).date()
            return DUTCH_TZ.localize(datetime.combine(yesterday, time(18, 0, 0)))
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=18, minute=0, second=0, microsecond=0)

    @staticmethod
    def get_cutoff_end() -> datetime:
        """
        End of the selection window: moment van draaien, Nederlandse tijd.
        Returns timezone-aware datetime in Europe/Amsterdam.
        """
        return RSSService._now_dutch()

    @staticmethod
    def _parse_pubdate(entry) -> datetime | None:
        """Parse pubDate from RSS entry to timezone-aware datetime (UTC then comparable)."""
        # feedparser: published_parsed is UTC (struct_time)
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                utc_ts = timegm(entry.published_parsed)
                return datetime.fromtimestamp(utc_ts, tz=timezone.utc)
            except Exception:
                pass
        published_str = entry.get("published", "")
        if published_str:
            try:
                from dateutil import parser as date_parser
                parsed = date_parser.parse(published_str)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed
            except Exception:
                pass
        return None

    @staticmethod
    def _in_window(published_at: datetime, start_dutch: datetime, end_dutch: datetime) -> bool:
        """True if published_at falls in [start_dutch, end_dutch] (inclusive) in Dutch time."""
        if published_at is None:
            return False
        if DUTCH_TZ:
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)
            pub_dutch = published_at.astimezone(DUTCH_TZ)
            return start_dutch <= pub_dutch <= end_dutch
        return start_dutch <= published_at <= end_dutch

    @staticmethod
    def fetch_feed(feed_url: str, cutoff_start: datetime = None, cutoff_end: datetime = None) -> List[Dict[str, Any]]:
        """
        Fetch and parse a single RSS feed. Selects articles whose pubDate is in
        [cutoff_start, cutoff_end] Dutch time (default: gisteren 18:00 t/m nu).
        """
        if cutoff_start is None:
            cutoff_start = RSSService.get_cutoff_start()
        if cutoff_end is None:
            cutoff_end = RSSService.get_cutoff_end()
        try:
            feed = feedparser.parse(feed_url)
            articles = []
            for entry in feed.entries:
                published_at = RSSService._parse_pubdate(entry)
                article = {
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "summary": entry.get("summary", entry.get("description", "")),
                    "published": entry.get("published", ""),
                    "published_at": published_at,
                    "source": feed.feed.get("title", feed_url),
                }
                articles.append(article)

            filtered_articles = [
                a for a in articles
                if RSSService._in_window(a["published_at"], cutoff_start, cutoff_end)
            ]
            filtered_articles.sort(key=lambda x: x["published_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
            return filtered_articles
        except Exception as e:
            print(f"Error fetching feed {feed_url}: {e}")
            return []

    @staticmethod
    def fetch_all_feeds(feed_urls: List[str] = None, cutoff_start: datetime = None, cutoff_end: datetime = None) -> List[Dict[str, Any]]:
        """
        Fetch articles from multiple RSS feeds. Per run:
        - pubDate from gisteren 18:00 Nederlandse tijd t/m moment van draaien.
        - Compare with PB by source_url; only articles not yet in PB go through the pipeline.
        """
        if feed_urls is None:
            feed_urls = RSSService.DEFAULT_FEEDS
        if cutoff_start is None:
            cutoff_start = RSSService.get_cutoff_start()
        if cutoff_end is None:
            cutoff_end = RSSService.get_cutoff_end()

        all_articles = []
        for feed_url in feed_urls:
            articles = RSSService.fetch_feed(feed_url, cutoff_start=cutoff_start, cutoff_end=cutoff_end)
            all_articles.extend(articles)

        # Sort by published_at (newest first)
        all_articles.sort(key=lambda x: x["published_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

        if DUTCH_TZ:
            start_str = cutoff_start.strftime("%Y-%m-%d %H:%M:%S %Z")
            end_str = cutoff_end.strftime("%Y-%m-%d %H:%M:%S %Z")
        else:
            start_str = cutoff_start.strftime("%Y-%m-%d %H:%M:%S")
            end_str = cutoff_end.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[RSSService] Window: {start_str} t/m {end_str}")
        print(f"[RSSService] Articles in window (by pubDate): {len(all_articles)}")

        return all_articles

    @staticmethod
    def fetch_feed_raw(feed_url: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch and parse a single RSS feed without time filtering.
        Returns all items sorted by published_at (newest first), up to limit.
        Used for debug feeds.
        """
        try:
            feed = feedparser.parse(feed_url)
            articles = []
            for entry in feed.entries:
                published_at = RSSService._parse_pubdate(entry)
                article = {
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "summary": entry.get("summary", entry.get("description", "")),
                    "published": entry.get("published", ""),
                    "published_at": (published_at.isoformat() if published_at else ""),
                    "source": feed.feed.get("title", feed_url),
                }
                articles.append(article)

            articles.sort(
                key=lambda x: x["published_at"] or "1970-01-01",
                reverse=True
            )
            return articles[:limit]
        except Exception as e:
            print(f"Error fetching feed {feed_url}: {e}")
            return []

