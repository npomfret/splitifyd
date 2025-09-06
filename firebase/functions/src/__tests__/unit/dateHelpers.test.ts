import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import {
    createServerTimestamp,
    parseISOToTimestamp,
    timestampToISO,
    isDateInValidRange,
    getRelativeTime,
    dateToTimestamp,
    safeParseISOToTimestamp,
    formatForLog,
    isInDateRange,
    getStartOfDay,
    getEndOfDay,
} from '../../utils/dateHelpers';

// Mock Timestamp.now() for predictable testing
const mockNow = new Date('2024-01-15T12:00:00.000Z');

vi.mock('firebase-admin/firestore', async () => {
    const actual = await vi.importActual<typeof import('firebase-admin/firestore')>('firebase-admin/firestore');
    return {
        ...actual,
        Timestamp: {
            ...actual.Timestamp,
            now: () => actual.Timestamp.fromDate(mockNow),
        },
    };
});

describe('Date Helpers', () => {
    describe('createServerTimestamp', () => {
        it('should create a Firestore Timestamp', () => {
            const timestamp = createServerTimestamp();
            expect(timestamp).toBeInstanceOf(Timestamp);
        });

        it('should create timestamps with current server time', () => {
            const timestamp1 = createServerTimestamp();
            // Small delay
            const timestamp2 = createServerTimestamp();
            // Timestamps should be very close but potentially different
            expect(Math.abs(timestamp1.toMillis() - timestamp2.toMillis())).toBeLessThan(1000);
        });
    });

    describe('parseISOToTimestamp', () => {
        it('should parse valid ISO string to Timestamp', () => {
            const isoString = '2024-01-15T10:30:00.000Z';
            const timestamp = parseISOToTimestamp(isoString);

            expect(timestamp).toBeInstanceOf(Timestamp);
            expect(timestamp?.toDate().toISOString()).toBe(isoString);
        });

        it('should handle ISO strings without milliseconds', () => {
            const isoString = '2024-01-15T10:30:00Z';
            const timestamp = parseISOToTimestamp(isoString);

            expect(timestamp).toBeInstanceOf(Timestamp);
            expect(timestamp?.toDate().toISOString()).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should handle ISO strings with timezone offset', () => {
            const isoString = '2024-01-15T10:30:00+05:00';
            const timestamp = parseISOToTimestamp(isoString);

            expect(timestamp).toBeInstanceOf(Timestamp);
            // Should convert to UTC
            expect(timestamp?.toDate().toISOString()).toBe('2024-01-15T05:30:00.000Z');
        });

        it('should return null for invalid date strings', () => {
            expect(parseISOToTimestamp('not-a-date')).toBeNull();
            expect(parseISOToTimestamp('2024-13-45')).toBeNull();
            expect(parseISOToTimestamp('')).toBeNull();
        });

        it('should return null for invalid input types', () => {
            expect(parseISOToTimestamp(undefined as any)).toBeNull();
            expect(parseISOToTimestamp(null as any)).toBeNull();
            expect(parseISOToTimestamp(123 as any)).toBeNull();
        });
    });

    describe('timestampToISO', () => {
        it('should convert Timestamp to ISO string', () => {
            const date = new Date('2024-01-15T10:30:00.000Z');
            const timestamp = Timestamp.fromDate(date);
            const isoString = timestampToISO(timestamp);

            expect(isoString).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should preserve milliseconds', () => {
            const date = new Date('2024-01-15T10:30:00.123Z');
            const timestamp = Timestamp.fromDate(date);
            const isoString = timestampToISO(timestamp);

            expect(isoString).toBe('2024-01-15T10:30:00.123Z');
        });
    });

    describe('isDateInValidRange', () => {
        beforeEach(() => {
            // Reset Date mocking for each test
            vi.clearAllMocks();
        });

        it('should accept dates within valid range', () => {
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const lastYear = new Date();
            lastYear.setFullYear(lastYear.getFullYear() - 1);

            expect(isDateInValidRange(today)).toBe(true);
            expect(isDateInValidRange(yesterday)).toBe(true);
            expect(isDateInValidRange(lastYear)).toBe(true);
        });

        it('should reject future dates', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);

            expect(isDateInValidRange(tomorrow)).toBe(false);
            expect(isDateInValidRange(nextYear)).toBe(false);
        });

        it('should reject dates older than 10 years by default', () => {
            const elevenYearsAgo = new Date();
            elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);

            expect(isDateInValidRange(elevenYearsAgo)).toBe(false);
        });

        it('should accept dates at the 10-year boundary', () => {
            const tenYearsAgo = new Date();
            tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
            tenYearsAgo.setMonth(0); // January
            tenYearsAgo.setDate(2); // Not exactly on the boundary

            expect(isDateInValidRange(tenYearsAgo)).toBe(true);
        });

        it('should respect custom maxYearsAgo parameter', () => {
            const fiveYearsAgo = new Date();
            fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
            const sixYearsAgo = new Date();
            sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

            expect(isDateInValidRange(fiveYearsAgo, 5)).toBe(false);
            expect(isDateInValidRange(fiveYearsAgo, 6)).toBe(true);
            expect(isDateInValidRange(sixYearsAgo, 5)).toBe(false);
        });
    });

    describe('getRelativeTime', () => {
        it('should return "just now" for very recent timestamps', () => {
            const now = createServerTimestamp();
            expect(getRelativeTime(now)).toBe('just now');
        });

        it('should return minutes ago for recent timestamps', () => {
            const date = new Date();
            date.setMinutes(date.getMinutes() - 5);
            const timestamp = Timestamp.fromDate(date);

            expect(getRelativeTime(timestamp)).toContain('minutes ago');
        });

        it('should return hours ago for timestamps within a day', () => {
            const date = new Date();
            date.setHours(date.getHours() - 3);
            const timestamp = Timestamp.fromDate(date);

            expect(getRelativeTime(timestamp)).toContain('hours ago');
        });

        it('should return days ago for timestamps within a week', () => {
            const date = new Date();
            date.setDate(date.getDate() - 3);
            const timestamp = Timestamp.fromDate(date);

            expect(getRelativeTime(timestamp)).toContain('days ago');
        });

        it('should return formatted date for older timestamps', () => {
            const date = new Date('2023-01-15');
            const timestamp = Timestamp.fromDate(date);

            const result = getRelativeTime(timestamp);
            expect(result).toContain('2023');
        });
    });

    describe('dateToTimestamp', () => {
        it('should convert Date to Timestamp', () => {
            const date = new Date('2024-01-15T10:30:00.000Z');
            const timestamp = dateToTimestamp(date);

            expect(timestamp).toBeInstanceOf(Timestamp);
            expect(timestamp.toDate().toISOString()).toBe(date.toISOString());
        });

        it('should return current timestamp for null', () => {
            const timestamp = dateToTimestamp(null);

            expect(timestamp).toBeInstanceOf(Timestamp);
            // Should be close to now
            const now = Date.now();
            expect(Math.abs(timestamp.toMillis() - now)).toBeLessThan(10000);
        });

        it('should return current timestamp for undefined', () => {
            const timestamp = dateToTimestamp(undefined);

            expect(timestamp).toBeInstanceOf(Timestamp);
        });
    });

    describe('safeParseISOToTimestamp', () => {
        it('should parse valid ISO string', () => {
            const isoString = '2024-01-15T10:30:00.000Z';
            const timestamp = safeParseISOToTimestamp(isoString);

            expect(timestamp).toBeInstanceOf(Timestamp);
            expect(timestamp.toDate().toISOString()).toBe(isoString);
        });

        it('should return current timestamp for invalid string', () => {
            const timestamp = safeParseISOToTimestamp('invalid-date');

            expect(timestamp).toBeInstanceOf(Timestamp);
            // Should be close to now
            const now = Date.now();
            expect(Math.abs(timestamp.toMillis() - now)).toBeLessThan(10000);
        });

        it('should return current timestamp for undefined', () => {
            const timestamp = safeParseISOToTimestamp(undefined);

            expect(timestamp).toBeInstanceOf(Timestamp);
        });
    });

    describe('formatForLog', () => {
        it('should format timestamp for logging', () => {
            const date = new Date('2024-01-15T10:30:00.000Z');
            const timestamp = Timestamp.fromDate(date);
            const formatted = formatForLog(timestamp);

            expect(formatted).toContain('2024-01-15T10:30:00.000Z');
            expect(formatted).toContain('ago'); // Should include relative time
        });
    });

    describe('isInDateRange', () => {
        it('should return true for timestamp within range', () => {
            const timestamp = Timestamp.fromDate(new Date('2024-01-15'));
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            expect(isInDateRange(timestamp, startDate, endDate)).toBe(true);
        });

        it('should return false for timestamp before range', () => {
            const timestamp = Timestamp.fromDate(new Date('2023-12-31'));
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            expect(isInDateRange(timestamp, startDate, endDate)).toBe(false);
        });

        it('should return false for timestamp after range', () => {
            const timestamp = Timestamp.fromDate(new Date('2024-02-01'));
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            expect(isInDateRange(timestamp, startDate, endDate)).toBe(false);
        });

        it('should handle missing start date', () => {
            const timestamp = Timestamp.fromDate(new Date('2023-01-15'));
            const endDate = new Date('2024-01-31');

            expect(isInDateRange(timestamp, undefined, endDate)).toBe(true);
        });

        it('should handle missing end date', () => {
            const timestamp = Timestamp.fromDate(new Date('2025-01-15'));
            const startDate = new Date('2024-01-01');

            expect(isInDateRange(timestamp, startDate, undefined)).toBe(true);
        });

        it('should handle missing both dates', () => {
            const timestamp = Timestamp.fromDate(new Date('2024-01-15'));

            expect(isInDateRange(timestamp)).toBe(true);
        });
    });

    describe('getStartOfDay', () => {
        it('should return start of day for given date', () => {
            const date = new Date('2024-01-15T14:30:45.123Z');
            const startOfDay = getStartOfDay(date);

            expect(startOfDay.toDate().toISOString()).toBe('2024-01-15T00:00:00.000Z');
        });

        it('should return start of current day when no date provided', () => {
            const startOfDay = getStartOfDay();

            const startDate = startOfDay.toDate();
            expect(startDate.getUTCHours()).toBe(0);
            expect(startDate.getUTCMinutes()).toBe(0);
            expect(startDate.getUTCSeconds()).toBe(0);
            expect(startDate.getUTCMilliseconds()).toBe(0);
        });

        it('should not mutate the original date', () => {
            const originalDate = new Date('2024-01-15T14:30:45.123Z');
            const originalTime = originalDate.getTime();

            getStartOfDay(originalDate);

            expect(originalDate.getTime()).toBe(originalTime);
        });
    });

    describe('getEndOfDay', () => {
        it('should return end of day for given date', () => {
            const date = new Date('2024-01-15T14:30:45.123Z');
            const endOfDay = getEndOfDay(date);

            expect(endOfDay.toDate().toISOString()).toBe('2024-01-15T23:59:59.999Z');
        });

        it('should return end of current day when no date provided', () => {
            const endOfDay = getEndOfDay();

            const endDate = endOfDay.toDate();
            expect(endDate.getUTCHours()).toBe(23);
            expect(endDate.getUTCMinutes()).toBe(59);
            expect(endDate.getUTCSeconds()).toBe(59);
            expect(endDate.getUTCMilliseconds()).toBe(999);
        });

        it('should not mutate the original date', () => {
            const originalDate = new Date('2024-01-15T14:30:45.123Z');
            const originalTime = originalDate.getTime();

            getEndOfDay(originalDate);

            expect(originalDate.getTime()).toBe(originalTime);
        });
    });

    describe('Edge Cases', () => {
        it('should handle leap year dates correctly', () => {
            const leapYearDate = new Date('2024-02-29T12:00:00.000Z');
            const timestamp = Timestamp.fromDate(leapYearDate);
            const isoString = timestampToISO(timestamp);

            expect(isoString).toBe('2024-02-29T12:00:00.000Z');
            expect(isDateInValidRange(leapYearDate)).toBe(true);
        });

        it('should handle DST transitions', () => {
            // DST transition date (varies by timezone, using a common one)
            const dstDate = new Date('2024-03-10T02:00:00Z');
            const timestamp = Timestamp.fromDate(dstDate);

            expect(timestampToISO(timestamp)).toBe('2024-03-10T02:00:00.000Z');
            expect(isDateInValidRange(dstDate)).toBe(true);
        });

        it('should handle year boundaries', () => {
            const newYearsEve = new Date('2023-12-31T23:59:59.999Z');
            const newYearsDay = new Date('2024-01-01T00:00:00.000Z');

            const timestamp1 = Timestamp.fromDate(newYearsEve);
            const timestamp2 = Timestamp.fromDate(newYearsDay);

            expect(timestampToISO(timestamp1)).toBe('2023-12-31T23:59:59.999Z');
            expect(timestampToISO(timestamp2)).toBe('2024-01-01T00:00:00.000Z');

            // Should be exactly 1 millisecond apart
            expect(timestamp2.toMillis() - timestamp1.toMillis()).toBe(1);
        });

        it('should handle very old dates', () => {
            const oldDate = new Date('1970-01-01T00:00:00.000Z');
            const timestamp = Timestamp.fromDate(oldDate);

            expect(timestampToISO(timestamp)).toBe('1970-01-01T00:00:00.000Z');
            expect(isDateInValidRange(oldDate)).toBe(false); // Outside 10-year range
        });

        it('should handle maximum date precision', () => {
            const preciseDate = new Date('2024-01-15T12:34:56.789Z');
            const timestamp = Timestamp.fromDate(preciseDate);

            expect(timestampToISO(timestamp)).toBe('2024-01-15T12:34:56.789Z');
            expect(timestamp.toMillis()).toBe(preciseDate.getTime());
        });
    });

    describe('Performance', () => {
        it('should handle rapid timestamp creation efficiently', () => {
            const startTime = Date.now();
            const timestamps = [];

            for (let i = 0; i < 1000; i++) {
                timestamps.push(createServerTimestamp());
            }

            const endTime = Date.now();

            // Should complete in under 100ms
            expect(endTime - startTime).toBeLessThan(100);
            expect(timestamps).toHaveLength(1000);
        });

        it('should handle bulk date parsing efficiently', () => {
            const startTime = Date.now();
            const dates = [];

            for (let i = 0; i < 1000; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                dates.push(parseISOToTimestamp(date.toISOString()));
            }

            const endTime = Date.now();

            // Should complete in under 100ms
            expect(endTime - startTime).toBeLessThan(100);
            expect(dates.filter((d) => d !== null)).toHaveLength(1000);
        });
    });
});
