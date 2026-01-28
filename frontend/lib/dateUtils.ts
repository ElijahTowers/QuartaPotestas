/**
 * Utility functions for parsing Dutch date/time formats
 */

/**
 * Parse a Dutch date/time string (DD-MM-YYYY HH:MM:SS) to a Date object
 * Also handles ISO format and other common formats as fallback
 */
export function parseDutchDateTime(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  // Try ISO format first (most common)
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try Dutch format: DD-MM-YYYY HH:MM:SS
  // Pattern: 23-01-2026 14:13:24
  const dutchPattern = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/;
  const match = dateString.match(dutchPattern);
  
  if (match) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
    // Create ISO string: YYYY-MM-DDTHH:MM:SS
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Try Dutch date only: DD-MM-YYYY
  const dateOnlyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const dateMatch = dateString.match(dateOnlyPattern);
  
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const isoString = `${year}-${month}-${day}`;
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // If all parsing fails, return null
  return null;
}

/**
 * Format a Date object to Dutch time format (HH:MM)
 */
export function formatDutchTime(date: Date | null): string {
  if (!date || isNaN(date.getTime())) {
    return '--:--';
  }
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a Date object to Dutch date format (DD-MM-YYYY)
 */
export function formatDutchDate(date: Date | null): string {
  if (!date || isNaN(date.getTime())) {
    return '--';
  }
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

