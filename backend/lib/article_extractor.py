"""
Extract full article text from news URLs using newspaper3k.
Falls back to None on failure (caller should use RSS summary instead).
"""
from newspaper import Article


def extract_full_text(url: str) -> str | None:
    """
    Fetch and parse a news article to extract full body text.
    
    Args:
        url: Article URL to fetch
        
    Returns:
        Full article text, or None if extraction fails (timeout, parse error, etc.)
    """
    if not url or not url.strip():
        return None
    try:
        article = Article(url)
        article.download()
        article.parse()
        text = (article.text or "").strip()
        return text if text else None
    except Exception:
        return None
