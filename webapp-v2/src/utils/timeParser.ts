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

    // Generate suggestions for all hours from 12 AM to 11 PM
    for (let hour = 0; hour < 24; hour++) {
        // Add on-the-hour time
        suggestions.push(formatTime12({ hours: hour, minutes: 0 }));
        // Add half-hour time
        suggestions.push(formatTime12({ hours: hour, minutes: 30 }));
    }

    return suggestions;
}

export function filterTimeSuggestions(input: string, allSuggestions: string[]): string[] {
    if (!input) {
        // Show common times when no input
        return ['9:00 AM', '12:00 PM', '1:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];
    }

    const cleaned = input.trim().toLowerCase();

    // Special handling for single digit inputs (e.g., "3")
    const singleDigitMatch = cleaned.match(/^(\d)$/);
    if (singleDigitMatch) {
        const digit = singleDigitMatch[1];
        // Return exact hour matches for both AM and PM
        const exactMatches: string[] = [];

        // Add AM times
        const amHour = parseInt(digit);
        if (amHour >= 1 && amHour <= 12) {
            exactMatches.push(`${digit}:00 AM`);
            exactMatches.push(`${digit}:30 AM`);
        }

        // Add PM times
        if (amHour >= 1 && amHour <= 12) {
            exactMatches.push(`${digit}:00 PM`);
            exactMatches.push(`${digit}:30 PM`);
        }

        return exactMatches.slice(0, 8);
    }

    // Special handling for two digit hour inputs (e.g., "10", "11")
    const twoDigitMatch = cleaned.match(/^(\d{1,2})$/);
    if (twoDigitMatch) {
        const hour = parseInt(twoDigitMatch[1]);
        const exactMatches: string[] = [];

        if (hour === 0) {
            // Midnight
            exactMatches.push('12:00 AM', '12:30 AM');
        } else if (hour <= 12) {
            // Could be AM or PM
            const displayHour = hour === 0 ? 12 : hour;
            exactMatches.push(`${displayHour}:00 AM`);
            exactMatches.push(`${displayHour}:30 AM`);
            if (hour !== 12) {
                exactMatches.push(`${displayHour}:00 PM`);
                exactMatches.push(`${displayHour}:30 PM`);
            } else {
                // Noon
                exactMatches.push('12:00 PM');
                exactMatches.push('12:30 PM');
            }
        } else if (hour <= 23) {
            // 24-hour format input, convert to 12-hour
            const displayHour = hour > 12 ? hour - 12 : hour;
            exactMatches.push(`${displayHour}:00 PM`);
            exactMatches.push(`${displayHour}:30 PM`);
        }

        return exactMatches.slice(0, 8);
    }

    // For other inputs, filter normally but prioritize starts-with matches
    const searchTerm = cleaned.replace(/[^a-z0-9]/g, '');

    const startsWithMatches = allSuggestions.filter((suggestion) => {
        const cleanSuggestion = suggestion.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanSuggestion.startsWith(searchTerm);
    });

    const containsMatches = allSuggestions.filter((suggestion) => {
        const cleanSuggestion = suggestion.toLowerCase().replace(/[^a-z0-9]/g, '');
        return !cleanSuggestion.startsWith(searchTerm) && cleanSuggestion.includes(searchTerm);
    });

    return [...startsWithMatches, ...containsMatches].slice(0, 8);
}

export function convertTo12HourDisplay(time24: string): string {
    if (!time24 || !time24.includes(':')) {
        return '';
    }

    const parsed = parseTimeString(time24);
    if (!parsed) return '';

    return formatTime12(parsed);
}
