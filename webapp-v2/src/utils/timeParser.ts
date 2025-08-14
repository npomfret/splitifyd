export interface ParsedTime {
  hours: number;
  minutes: number;
}

export function parseTimeString(input: string): ParsedTime | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const cleaned = input.trim().toLowerCase();
  
  if (cleaned.length === 0) {
    return null;
  }

  const format24Hour = /^(\d{1,2}):(\d{2})$/;
  const match24 = cleaned.match(format24Hour);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (isValidTime(hours, minutes)) {
      return { hours, minutes };
    }
  }

  const formatDot = /^(\d{1,2})\.(\d{2})$/;
  const matchDot = cleaned.match(formatDot);
  if (matchDot) {
    const hours = parseInt(matchDot[1], 10);
    const minutes = parseInt(matchDot[2], 10);
    if (isValidTime(hours, minutes)) {
      return { hours, minutes };
    }
  }

  const format12Hour = /^(\d{1,2})(?::(\d{2}))?\s*(am?|pm?|a\.m\.|p\.m\.)$/;
  const match12 = cleaned.match(format12Hour);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridiem = match12[3];
    
    if (meridiem.startsWith('p')) {
      if (hours !== 12) {
        hours += 12;
      }
    } else {
      if (hours === 12) {
        hours = 0;
      }
    }
    
    if (isValidTime(hours, minutes)) {
      return { hours, minutes };
    }
  }

  const formatHourOnly = /^(\d{1,2})\s*$/;
  const matchHour = cleaned.match(formatHourOnly);
  if (matchHour) {
    const hours = parseInt(matchHour[1], 10);
    if (hours >= 0 && hours <= 23) {
      return { hours, minutes: 0 };
    }
  }

  return null;
}

function isValidTime(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function formatTime24(time: ParsedTime): string {
  const h = time.hours.toString().padStart(2, '0');
  const m = time.minutes.toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function formatTime12(time: ParsedTime): string {
  const hours = time.hours;
  const minutes = time.minutes.toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${minutes} ${period}`;
}

export function generateTimeSuggestions(): string[] {
  const suggestions: string[] = [];
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  
  for (const hour of hours) {
    const time = { hours: hour, minutes: 0 };
    const formatted12 = formatTime12(time);
    suggestions.push(formatted12);
    
    if (hour >= 7 && hour <= 21) {
      const halfTime = { hours: hour, minutes: 30 };
      suggestions.push(formatTime12(halfTime));
    }
  }
  
  return suggestions;
}

export function filterTimeSuggestions(input: string, allSuggestions: string[]): string[] {
  if (!input) {
    return allSuggestions.slice(0, 8);
  }
  
  const searchTerm = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return allSuggestions.filter(suggestion => {
    const cleanSuggestion = suggestion.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanSuggestion.includes(searchTerm);
  }).slice(0, 8);
}

export function validateAndNormalizeTime(input: string): string | null {
  if (!input || !input.trim()) {
    return null;
  }
  
  const parsed = parseTimeString(input);
  if (!parsed) {
    return null;
  }
  
  return formatTime24(parsed);
}

export function convertTo12HourDisplay(time24: string): string {
  if (!time24 || !time24.includes(':')) {
    return '';
  }
  
  const parsed = parseTimeString(time24);
  if (!parsed) return '';
  
  return formatTime12(parsed);
}