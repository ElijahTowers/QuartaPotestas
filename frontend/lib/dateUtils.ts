/**
 * Utility functions for parsing Dutch date/time formats
 */

/**
 * Parse a Dutch date/time string (DD-MM-YYYY HH:MM:SS) to a Date object.
 * Tries DD-MM-YYYY first so "04-02-2025" is 4 February, not 2 April (avoid US mm-dd-yyyy).
 * Then handles ISO (YYYY-MM-DD) and other formats.
 */
export function parseDutchDateTime(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const s = dateString.trim();

  // Try Dutch format first: DD-MM-YYYY HH:MM:SS or DD-MM-YYYY (so we never interpret as US mm-dd-yyyy)
  const dutchPattern = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/;
  const match = s.match(dutchPattern);
  if (match) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) return date;
  }

  const dateOnlyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const dateMatch = s.match(dateOnlyPattern);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime())) return date;
  }

  // ISO or other format (YYYY-MM-DD...)
  const isoDate = new Date(s);
  if (!isNaN(isoDate.getTime())) return isoDate;

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

