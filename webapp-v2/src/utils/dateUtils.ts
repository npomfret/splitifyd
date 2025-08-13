/**
 * Date utilities for UTC-only client-server communication
 * 
 * IMPORTANT: All dates sent to the server MUST be in UTC format (ending with 'Z')
 * The UI should display dates in the user's local timezone
 */

/**
 * Convert a Date object to UTC ISO string for server communication
 * @param date - JavaScript Date object
 * @returns UTC ISO string (always ends with 'Z')
 */
export const toUTCString = (date: Date): string => {
  return date.toISOString(); // toISOString() always returns UTC
};

/**
 * Parse UTC string from server to local Date object
 * @param utcString - UTC ISO string from server
 * @returns JavaScript Date object (in local timezone for display)
 */
export const fromUTCString = (utcString: string): Date => {
  return new Date(utcString);
};

/**
 * Format UTC date string for local display with date and time
 * @param utcString - UTC ISO string from server
 * @returns Localized date and time string
 */
export const formatLocalDateTime = (utcString: string): string => {
  const date = new Date(utcString);
  return date.toLocaleString();
};

/**
 * Format UTC date string for local display (date only)
 * @param utcString - UTC ISO string from server
 * @returns Localized date string
 */
export const formatLocalDate = (utcString: string): string => {
  const date = new Date(utcString);
  return date.toLocaleDateString();
};

/**
 * Format UTC date string for local display (time only)
 * @param utcString - UTC ISO string from server
 * @returns Localized time string
 */
export const formatLocalTime = (utcString: string): string => {
  const date = new Date(utcString);
  return date.toLocaleTimeString();
};

/**
 * Convert a local date string (YYYY-MM-DD) to UTC midnight ISO string
 * This is used for date-only fields like expense dates
 * @param localDateString - Date string in YYYY-MM-DD format
 * @returns UTC ISO string at midnight UTC
 */
export const getUTCMidnight = (localDateString: string): string => {
  const [year, month, day] = localDateString.split('-').map(Number);
  // Create date at UTC midnight
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return date.toISOString();
};

/**
 * Convert a local date and time to UTC ISO string
 * @param localDateString - Date string in YYYY-MM-DD format
 * @param timeString - Time string in HH:mm format (24-hour)
 * @returns UTC ISO string with the specified time
 */
export const getUTCDateTime = (localDateString: string, timeString: string): string => {
  const [year, month, day] = localDateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Create date in local timezone
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // Convert to UTC
  return localDate.toISOString();
};

/**
 * Check if an ISO timestamp represents noon (12:00 PM) in UTC
 * @param isoString - ISO timestamp string
 * @returns true if the time component is 12:00:00
 */
export const isNoonTime = (isoString: string): boolean => {
  return isoString.includes('T12:00:00');
};

/**
 * Format an expense date/time for display
 * Shows time only if not default noon
 * @param isoString - ISO timestamp string
 * @returns Formatted date string with optional time
 */
export const formatExpenseDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  const isNoon = isNoonTime(isoString);
  
  // Get local date components
  const year = date.getFullYear();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  
  if (isNoon) {
    // Just show date for default noon time
    return `${month} ${day}, ${year}`;
  } else {
    // Show date and time
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${month} ${day}, ${year} at ${displayHours}:${minutes} ${ampm}`;
  }
};

/**
 * Extract time string from ISO timestamp
 * @param isoString - ISO timestamp string
 * @returns Time string in HH:mm format (24-hour)
 */
export const extractTimeFromISO = (isoString: string): string => {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Check if a date string represents a future date
 * Compares the input date at local midnight with today at local midnight
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns true if the date is in the future
 */
export const isDateInFuture = (dateString: string): boolean => {
  // Parse the date string to get year, month, day
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date at local midnight for the input
  const inputDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Get today at local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Compare dates
  return inputDate > today;
};

/**
 * Get today's date at UTC midnight
 * @returns UTC ISO string for today at midnight UTC
 */
export const getTodayUTCMidnight = (): string => {
  const now = new Date();
  const date = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  return date.toISOString();
};

/**
 * Convert a local Date to UTC date at midnight
 * @param localDate - JavaScript Date object in local timezone
 * @returns UTC ISO string at midnight UTC for that date
 */
export const localDateToUTCMidnight = (localDate: Date): string => {
  const date = new Date(Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    0, 0, 0, 0
  ));
  return date.toISOString();
};

/**
 * Check if a date string is in UTC format
 * @param dateString - Date string to check
 * @returns true if the string ends with 'Z' or '+00:00'
 */
export const isUTCFormat = (dateString: string): boolean => {
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]00:00)$/.test(dateString);
};

/**
 * Get a relative time string (e.g., "2 hours ago")
 * @param utcString - UTC ISO string from server
 * @returns Relative time string
 */
export const getRelativeTime = (utcString: string): string => {
  const date = new Date(utcString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  return date.toLocaleDateString();
};

/**
 * Format date for display with custom options
 * @param utcString - UTC ISO string from server
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string
 */
export const formatDateCustom = (
  utcString: string,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const date = new Date(utcString);
  return date.toLocaleDateString(undefined, options);
};

/**
 * Get timezone offset string for display
 * @returns Timezone offset string (e.g., "GMT-5" or "GMT+2")
 */
export const getTimezoneOffset = (): string => {
  const offset = new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const sign = offset <= 0 ? '+' : '-';
  return `GMT${sign}${hours}`;
};

/**
 * Get the user's timezone name
 * @returns IANA timezone name (e.g., "America/New_York")
 */
export const getTimezoneName = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Legacy function - kept for backward compatibility
 * Use getRelativeTime() instead for UTC dates
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
}