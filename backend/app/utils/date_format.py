"""
Dutch date and time formatting utilities for PocketBase API responses.
Uses Europe/Amsterdam timezone and Dutch locale formatting.
"""
from datetime import datetime, date
from typing import Optional
import pytz


# Dutch timezone
DUTCH_TZ = pytz.timezone("Europe/Amsterdam")


def format_datetime_dutch(dt_string: Optional[str]) -> Optional[str]:
    """
    Convert ISO datetime string to Dutch format.
    
    Format: "DD-MM-YYYY HH:MM:SS" (e.g., "31-12-2024 23:59:59")
    
    Args:
        dt_string: ISO datetime string from PocketBase (e.g., "2024-12-31T23:59:59.123Z" or "2024-12-31 23:59:59 UTC")
    
    Returns:
        Formatted datetime string in Dutch format, or None if input is None/empty
    """
    if not dt_string:
        return None
    
    try:
        # Handle PocketBase format: "YYYY-MM-DD HH:MM:SS UTC"
        if ' UTC' in dt_string:
            dt_string = dt_string.replace(' UTC', '+00:00')
        
        # Parse ISO format (handles both with and without microseconds)
        if dt_string.endswith('Z'):
            dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        elif '+' in dt_string or dt_string.endswith('+00:00'):
            dt = datetime.fromisoformat(dt_string)
        else:
            # Try parsing as "YYYY-MM-DD HH:MM:SS" format (assume UTC)
            dt = datetime.strptime(dt_string, "%Y-%m-%d %H:%M:%S")
            dt = pytz.UTC.localize(dt)
        
        # Convert to Dutch timezone
        if dt.tzinfo is None:
            # Assume UTC if no timezone info
            dt = pytz.UTC.localize(dt)
        
        dt_dutch = dt.astimezone(DUTCH_TZ)
        
        # Format as DD-MM-YYYY HH:MM:SS
        return dt_dutch.strftime("%d-%m-%Y %H:%M:%S")
    except (ValueError, AttributeError):
        # If parsing fails, return original string
        return dt_string


def format_date_dutch(date_string: Optional[str]) -> Optional[str]:
    """
    Convert date string (YYYY-MM-DD) to Dutch format (DD-MM-YYYY).
    
    Args:
        date_string: Date string in YYYY-MM-DD format
    
    Returns:
        Formatted date string in DD-MM-YYYY format, or None if input is None/empty
    """
    if not date_string:
        return None
    
    try:
        # Parse YYYY-MM-DD format
        dt = datetime.strptime(date_string, "%Y-%m-%d")
        # Format as DD-MM-YYYY
        return dt.strftime("%d-%m-%Y")
    except (ValueError, AttributeError):
        # If parsing fails, return original string
        return date_string


def format_datetime_dutch_long(dt_string: Optional[str]) -> Optional[str]:
    """
    Convert ISO datetime string to Dutch long format with day name.
    
    Format: "maandag 31 december 2024, 23:59" (e.g., "maandag 31 december 2024, 23:59")
    
    Args:
        dt_string: ISO datetime string from PocketBase
    
    Returns:
        Formatted datetime string in Dutch long format, or None if input is None/empty
    """
    if not dt_string:
        return None
    
    try:
        # Parse ISO format
        if dt_string.endswith('Z'):
            dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(dt_string)
        
        # Convert to Dutch timezone
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        
        dt_dutch = dt.astimezone(DUTCH_TZ)
        
        # Dutch day and month names
        days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
        months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
                  'juli', 'augustus', 'september', 'oktober', 'november', 'december']
        
        day_name = days[dt_dutch.weekday()]
        month_name = months[dt_dutch.month - 1]
        
        # Format: "maandag 31 december 2024, 23:59"
        return f"{day_name} {dt_dutch.day} {month_name} {dt_dutch.year}, {dt_dutch.strftime('%H:%M')}"
    except (ValueError, AttributeError):
        # If parsing fails, return formatted datetime
        return format_datetime_dutch(dt_string)

