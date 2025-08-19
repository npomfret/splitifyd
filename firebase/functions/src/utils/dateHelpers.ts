import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Date handling utilities for consistent timestamp management across the application.
 *
 * IMPORTANT: With optimistic locking now implemented, timestamps are CRITICAL for data integrity.
 * Two approaches are provided depending on use case:
 *
 * 1. For optimistic locking: Use createPreciseTimestamp() - returns actual Timestamp for comparison
 * 2. For general updates: Use createServerTimestamp() - returns FieldValue for true server-side timing
 */

/**
 * 🎯 CRITICAL: Creates timestamps for optimistic locking - ALWAYS use this for updatedAt in optimistic scenarios
 * This ensures consistent timestamp creation across all optimistic locking operations.
 *
 * USE FOR: Any operation that uses optimistic locking (Groups, Expenses, Settlements, etc.)
 *
 * @returns Firestore Timestamp with current time (set at function execution for consistent comparison)
 */
export const createOptimisticTimestamp = (): Timestamp => {
    return Timestamp.now();
};

/**
 * Creates a server-side timestamp (maintains backward compatibility)
 * @deprecated Use createOptimisticTimestamp() for optimistic locking or createTrueServerTimestamp() for server timestamps
 * @returns Firestore Timestamp with current time
 */
export const createServerTimestamp = (): Timestamp => {
    return Timestamp.now();
};

/**
 * Creates a true server-side timestamp placeholder
 * USE FOR: Document creation or general updates where precise timing isn't critical for logic
 *
 * @returns FieldValue.serverTimestamp() - set when Firestore processes the write
 */
export const createTrueServerTimestamp = (): FieldValue => {
    return FieldValue.serverTimestamp();
};

/**
 * Safely parses an ISO date string to Firestore Timestamp
 * @param isoString - ISO 8601 date string
 * @returns Firestore Timestamp or null if invalid
 */
export const parseISOToTimestamp = (isoString: string): Timestamp | null => {
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            return null;
        }
        return Timestamp.fromDate(date);
    } catch {
        return null;
    }
};

/**
 * Converts Firestore Timestamp or Date to ISO string
 * @param value - Firestore Timestamp or Date
 * @returns ISO 8601 string
 */
export const timestampToISO = (value: Timestamp | Date): string => {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    return value.toISOString();
};

/**
 * Validates date is within acceptable range
 * @param date - Date to validate
 * @param maxYearsAgo - Maximum years in the past (default 10)
 * @returns boolean
 */
export const isDateInValidRange = (date: Date, maxYearsAgo: number = 10): boolean => {
    const now = Date.now();
    const dateTime = date.getTime();
    const minTime = now - maxYearsAgo * 365.25 * 24 * 60 * 60 * 1000; // Account for leap years

    // Allow up to 24 hours in the future to account for timezone differences
    // This prevents rejecting "today" when converted from different timezones
    const maxTime = now + 24 * 60 * 60 * 1000; // 24 hours buffer

    return dateTime >= minTime && dateTime <= maxTime;
};

/**
 * Gets a human-readable relative time string
 * @param timestamp - Firestore Timestamp
 * @returns Relative time string (e.g., "2 hours ago")
 */
export const getRelativeTime = (timestamp: Timestamp): string => {
    const seconds = Math.floor((Date.now() - timestamp.toMillis()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return timestamp.toDate().toLocaleDateString();
};

/**
 * Creates a Timestamp from a Date object or returns current timestamp if null
 * @param date - Date object or null
 * @returns Firestore Timestamp
 */
export const dateToTimestamp = (date: Date | null | undefined): Timestamp => {
    if (!date) {
        return createServerTimestamp();
    }
    return Timestamp.fromDate(date);
};

/**
 * Validates and converts an ISO string to Timestamp, with fallback to current time
 * @param isoString - ISO date string
 * @returns Firestore Timestamp (current time if invalid)
 */
export const safeParseISOToTimestamp = (isoString: string | undefined): Timestamp => {
    if (!isoString) {
        return createServerTimestamp();
    }

    const parsed = parseISOToTimestamp(isoString);
    return parsed || createServerTimestamp();
};

/**
 * Format a timestamp for display in logs
 * @param timestamp - Firestore Timestamp
 * @returns Formatted string for logging
 */
export const formatForLog = (timestamp: Timestamp): string => {
    return `${timestampToISO(timestamp)} (${getRelativeTime(timestamp)})`;
};

/**
 * Check if a timestamp is within a date range
 * @param timestamp - Timestamp to check
 * @param startDate - Start of range (optional)
 * @param endDate - End of range (optional)
 * @returns boolean
 */
export const isInDateRange = (timestamp: Timestamp, startDate?: Date, endDate?: Date): boolean => {
    const date = timestamp.toDate();

    if (startDate && date < startDate) {
        return false;
    }

    if (endDate && date > endDate) {
        return false;
    }

    return true;
};

/**
 * Get the start of day timestamp
 * @param date - Date to get start of day for (optional, defaults to today)
 * @returns Firestore Timestamp at 00:00:00
 */
export const getStartOfDay = (date?: Date): Timestamp => {
    const d = date ? new Date(date) : new Date(); // Create a copy to avoid mutating original
    d.setUTCHours(0, 0, 0, 0);
    return Timestamp.fromDate(d);
};

/**
 * Get the end of day timestamp
 * @param date - Date to get end of day for (optional, defaults to today)
 * @returns Firestore Timestamp at 23:59:59.999
 */
export const getEndOfDay = (date?: Date): Timestamp => {
    const d = date ? new Date(date) : new Date(); // Create a copy to avoid mutating original
    d.setUTCHours(23, 59, 59, 999);
    return Timestamp.fromDate(d);
};

/**
 * Validates that an ISO string is in UTC format (ends with 'Z' or '+00:00')
 * @param isoString - ISO 8601 date string to validate
 * @returns boolean indicating if the string is in UTC format
 */
export const isUTCFormat = (isoString: string): boolean => {
    // Check if string ends with 'Z' (Zulu time) or '+00:00'/'-00:00' (UTC offset)
    return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]00:00)$/.test(isoString);
};

/**
 * Parses an ISO date string but ONLY if it's in UTC format
 * Throws an error if the date is not in UTC format
 * @param isoString - ISO 8601 date string in UTC format
 * @returns Firestore Timestamp or null if invalid date
 * @throws Error if not in UTC format
 */
export const parseUTCOnly = (isoString: string): Timestamp | null => {
    if (!isUTCFormat(isoString)) {
        throw new Error(`Date must be in UTC format (ending with 'Z' or '+00:00'). Received: ${isoString}`);
    }

    return parseISOToTimestamp(isoString);
};

/**
 * Validates that a date string is in UTC format and within acceptable range
 * @param isoString - ISO 8601 date string
 * @param maxYearsAgo - Maximum years in the past (default 10)
 * @returns Object with validation result and error message if invalid
 */
export const validateUTCDate = (isoString: string, maxYearsAgo: number = 10): { valid: boolean; error?: string } => {
    // Check UTC format
    if (!isUTCFormat(isoString)) {
        return {
            valid: false,
            error: 'Date must be in UTC format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        };
    }

    // Parse date
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        return {
            valid: false,
            error: 'Invalid date format',
        };
    }

    // Check range
    if (!isDateInValidRange(date, maxYearsAgo)) {
        const now = new Date();
        if (date > now) {
            return {
                valid: false,
                error: 'Date cannot be in the future',
            };
        } else {
            return {
                valid: false,
                error: `Date cannot be more than ${maxYearsAgo} years in the past`,
            };
        }
    }

    return { valid: true };
};
