/**
 * Time parsing utilities for expense time input
 * No external libraries - uses native JavaScript
 * No fallbacks - returns null for invalid input (let it break)
 */

export interface ParsedTime {
  hours: number;  // 0-23
  minutes: number; // 0-59
}

/**
 * Parse various time formats into hours and minutes
 * Supports: "8pm", "20:00", "8:15a", "9.30", "8:15 PM", "8:15am"
 * Returns null for invalid input (no fallbacks)
 */
export function parseTimeString(input: string): ParsedTime | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Remove extra spaces and convert to lowercase for processing
  const cleaned = input.trim().toLowerCase();
  
  if (cleaned.length === 0) {
    return null;
  }

  // Try different parsing strategies
  
  // Strategy 1: Standard 24-hour format (20:00, 20:30)
  const format24Hour = /^(\d{1,2}):(\d{2})$/;
  const match24 = cleaned.match(format24Hour);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (isValidTime(hours, minutes)) {
      return { hours, minutes };
    }
  }

  // Strategy 2: Dot separator (9.30, 14.45)
  const formatDot = /^(\d{1,2})\.(\d{2})$/;
  const matchDot = cleaned.match(formatDot);
  if (matchDot) {
    const hours = parseInt(matchDot[1], 10);
    const minutes = parseInt(matchDot[2], 10);
    if (isValidTime(hours, minutes)) {
      return { hours, minutes };
    }
  }

  // Strategy 3: 12-hour format with am/pm (8pm, 8:15am, 8:30 pm)
  // Match patterns like: "8pm", "8:15am", "8:30 pm", "12:45pm"
  const format12Hour = /^(\d{1,2})(?::(\d{2}))?\s*(am?|pm?|a\.m\.|p\.m\.)$/;
  const match12 = cleaned.match(format12Hour);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridiem = match12[3];
    
    // Convert to 24-hour format
    if (meridiem.startsWith('p')) {
      // PM times
      if (hours !== 12) {
        hours += 12;
      }
    } else {
      // AM times
      if (hours === 12) {
        hours = 0;
      }
    }
    
    if (isValidTime(hours, minutes)) {
      return { hours, minutes };
    }
  }

  // Strategy 4: Simple hour only (8, 14, 23)
  const formatHourOnly = /^(\d{1,2})$/;
  const matchHour = cleaned.match(formatHourOnly);
  if (matchHour) {
    const hours = parseInt(matchHour[1], 10);
    if (isValidTime(hours, 0)) {
      return { hours, minutes: 0 };
    }
  }

  // No valid format matched
  return null;
}

/**
 * Validate that hours and minutes are in valid ranges
 */
function isValidTime(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Format ParsedTime to 24-hour string format (HH:mm)
 */
export function formatTime24(time: ParsedTime): string {
  const hours = time.hours.toString().padStart(2, '0');
  const minutes = time.minutes.toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format ParsedTime to 12-hour string format (h:mm AM/PM)
 */
export function formatTime12(time: ParsedTime): string {
  let hours = time.hours;
  const minutes = time.minutes.toString().padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  
  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours -= 12;
  }
  
  return `${hours}:${minutes} ${meridiem}`;
}

/**
 * Generate time suggestions at 15-minute intervals
 * Returns both 12-hour formatted strings for display
 */
export function generateTimeSuggestions(): string[] {
  const suggestions: string[] = [];
  
  // Generate times from 12:00 AM to 11:45 PM at 15-minute intervals
  for (let hours = 0; hours < 24; hours++) {
    for (let minutes = 0; minutes < 60; minutes += 15) {
      const time = { hours, minutes };
      suggestions.push(formatTime12(time));
    }
  }
  
  return suggestions;
}

/**
 * Filter time suggestions based on user input
 */
export function filterTimeSuggestions(input: string, suggestions: string[]): string[] {
  if (!input || input.trim().length === 0) {
    // Show a subset of suggestions when input is empty
    // Show morning (6am-12pm) and evening (5pm-10pm) times
    return suggestions.filter(time => {
      const hour = parseInt(time.split(':')[0]);
      const isPM = time.includes('PM');
      
      if (isPM) {
        return hour >= 5 && hour <= 10;
      } else {
        return hour >= 6 || hour === 12; // 6am-12pm (12am shows as 12)
      }
    });
  }

  const cleaned = input.toLowerCase().trim();
  
  // Filter suggestions that start with the input
  return suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(cleaned) ||
    suggestion.replace(/[:\s]/g, '').toLowerCase().includes(cleaned.replace(/[:\s]/g, ''))
  );
}

/**
 * Check if a time string represents noon (12:00 PM)
 */
export function isNoonTime(timeString: string): boolean {
  const parsed = parseTimeString(timeString);
  return parsed !== null && parsed.hours === 12 && parsed.minutes === 0;
}

/**
 * Get default time string (12:00 PM)
 */
export function getDefaultTime(): string {
  return '12:00';
}

/**
 * Convert 24-hour time string to 12-hour display format
 */
export function convertTo12HourDisplay(time24: string): string {
  const parsed = parseTimeString(time24);
  if (!parsed) {
    return time24; // Return as-is if can't parse
  }
  return formatTime12(parsed);
}