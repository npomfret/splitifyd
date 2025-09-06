import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import {
    createOptimisticTimestamp,
    createServerTimestamp,
    createTrueServerTimestamp,
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
    isUTCFormat,
    parseUTCOnly,
    validateUTCDate,
} from '../../utils/dateHelpers';

describe('dateHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createOptimisticTimestamp', () => {
        it('should create a Timestamp instance', () => {
            const timestamp = createOptimisticTimestamp();
            expect(timestamp).toBeInstanceOf(Timestamp);
        });

        it('should create timestamps close to current time', () => {
            const before = Date.now();
            const timestamp = createOptimisticTimestamp();
            const after = Date.now();

            const timestampMillis = timestamp.toMillis();
            expect(timestampMillis).toBeGreaterThanOrEqual(before);
            expect(timestampMillis).toBeLessThanOrEqual(after);
        });
    });

    describe('createServerTimestamp', () => {
        it('should create a Timestamp instance', () => {
            const timestamp = createServerTimestamp();
            expect(timestamp).toBeInstanceOf(Timestamp);
        });
    });

    describe('createTrueServerTimestamp', () => {
        it('should create a FieldValue.serverTimestamp', () => {
            const serverTimestamp = createTrueServerTimestamp();
            expect(serverTimestamp).toBeInstanceOf(Object);
            // FieldValue.serverTimestamp() returns a special object - just verify it's not a regular timestamp
            expect(serverTimestamp).not.toBeInstanceOf(Timestamp);
            expect(typeof serverTimestamp).toBe('object');
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
            expect(timestamp?.toDate().toISOString()).toBe('2024-01-15T05:30:00.000Z');
        });

        it('should return null for invalid date strings', () => {
            expect(parseISOToTimestamp('not-a-date')).toBeNull();
            expect(parseISOToTimestamp('2024-13-45')).toBeNull();
            expect(parseISOToTimestamp('')).toBeNull();
        });
    });

    describe('timestampToISO', () => {
        it('should convert Timestamp to ISO string', () => {
            const date = new Date('2024-01-15T10:30:00.000Z');
            const timestamp = Timestamp.fromDate(date);
            const isoString = timestampToISO(timestamp);

            expect(isoString).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should convert Date to ISO string', () => {
            const date = new Date('2024-01-15T10:30:00.123Z');
            const isoString = timestampToISO(date);

            expect(isoString).toBe('2024-01-15T10:30:00.123Z');
        });
    });

    describe('isDateInValidRange', () => {
        it('should accept current dates', () => {
            const now = new Date();
            expect(isDateInValidRange(now)).toBe(true);
        });

        it('should accept recent dates', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(isDateInValidRange(yesterday)).toBe(true);
        });

        it('should reject dates too far in the past', () => {
            const elevenYearsAgo = new Date();
            elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);
            expect(isDateInValidRange(elevenYearsAgo)).toBe(false);
        });

        it('should reject future dates beyond buffer', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 2); // Beyond 24-hour buffer
            expect(isDateInValidRange(tomorrow)).toBe(false);
        });

        it('should accept dates within 24-hour future buffer', () => {
            const inOneHour = new Date();
            inOneHour.setHours(inOneHour.getHours() + 1);
            expect(isDateInValidRange(inOneHour)).toBe(true);
        });
    });

    describe('getRelativeTime', () => {
        it('should return "just now" for recent timestamps', () => {
            const now = Timestamp.now();
            expect(getRelativeTime(now)).toBe('just now');
        });

        it('should return minutes for timestamps within an hour', () => {
            const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
            expect(getRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
        });

        it('should return hours for timestamps within a day', () => {
            const twoHoursAgo = Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000);
            expect(getRelativeTime(twoHoursAgo)).toBe('2 hours ago');
        });

        it('should return days for timestamps within a week', () => {
            const threeDaysAgo = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
            expect(getRelativeTime(threeDaysAgo)).toBe('3 days ago');
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
            const timestamp = safeParseISOToTimestamp('invalid');
            expect(timestamp).toBeInstanceOf(Timestamp);
        });

        it('should return current timestamp for undefined', () => {
            const timestamp = safeParseISOToTimestamp(undefined);
            expect(timestamp).toBeInstanceOf(Timestamp);
        });
    });

    describe('formatForLog', () => {
        it('should format timestamp for logging', () => {
            // Use a timestamp from 2 minutes ago to ensure it shows "minutes ago"
            const twoMinutesAgo = Timestamp.fromMillis(Date.now() - 120000); // 2 minutes ago
            const formatted = formatForLog(twoMinutesAgo);

            expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/); // ISO format
            expect(formatted).toContain('minutes ago');
        });
    });

    describe('isInDateRange', () => {
        const baseDate = new Date('2024-01-15T10:30:00.000Z');
        const timestamp = Timestamp.fromDate(baseDate);

        it('should return true for timestamp within range', () => {
            const startDate = new Date('2024-01-14T00:00:00.000Z');
            const endDate = new Date('2024-01-16T00:00:00.000Z');

            expect(isInDateRange(timestamp, startDate, endDate)).toBe(true);
        });

        it('should return false for timestamp before range', () => {
            const startDate = new Date('2024-01-16T00:00:00.000Z');
            const endDate = new Date('2024-01-17T00:00:00.000Z');

            expect(isInDateRange(timestamp, startDate, endDate)).toBe(false);
        });

        it('should return false for timestamp after range', () => {
            const startDate = new Date('2024-01-13T00:00:00.000Z');
            const endDate = new Date('2024-01-14T00:00:00.000Z');

            expect(isInDateRange(timestamp, startDate, endDate)).toBe(false);
        });

        it('should handle missing start date', () => {
            const endDate = new Date('2024-01-16T00:00:00.000Z');
            expect(isInDateRange(timestamp, undefined, endDate)).toBe(true);
        });

        it('should handle missing end date', () => {
            const startDate = new Date('2024-01-14T00:00:00.000Z');
            expect(isInDateRange(timestamp, startDate, undefined)).toBe(true);
        });
    });

    describe('getStartOfDay', () => {
        it('should return start of day for given date', () => {
            const inputDate = new Date('2024-01-15T15:30:45.123Z');
            const startOfDay = getStartOfDay(inputDate);

            expect(startOfDay.toDate().toISOString()).toBe('2024-01-15T00:00:00.000Z');
        });

        it('should not mutate the original date', () => {
            const originalDate = new Date('2024-01-15T15:30:45.123Z');
            const originalISO = originalDate.toISOString();
            
            getStartOfDay(originalDate);
            
            expect(originalDate.toISOString()).toBe(originalISO);
        });
    });

    describe('getEndOfDay', () => {
        it('should return end of day for given date', () => {
            const inputDate = new Date('2024-01-15T10:30:00.000Z');
            const endOfDay = getEndOfDay(inputDate);

            expect(endOfDay.toDate().toISOString()).toBe('2024-01-15T23:59:59.999Z');
        });

        it('should not mutate the original date', () => {
            const originalDate = new Date('2024-01-15T10:30:00.000Z');
            const originalISO = originalDate.toISOString();
            
            getEndOfDay(originalDate);
            
            expect(originalDate.toISOString()).toBe(originalISO);
        });
    });

    describe('isUTCFormat', () => {
        it('should return true for UTC format with Z', () => {
            expect(isUTCFormat('2024-01-15T10:30:00.000Z')).toBe(true);
            expect(isUTCFormat('2024-01-15T10:30:00Z')).toBe(true);
        });

        it('should return true for UTC format with +00:00', () => {
            expect(isUTCFormat('2024-01-15T10:30:00.000+00:00')).toBe(true);
            expect(isUTCFormat('2024-01-15T10:30:00+00:00')).toBe(true);
        });

        it('should return false for non-UTC format', () => {
            expect(isUTCFormat('2024-01-15T10:30:00.000+05:00')).toBe(false);
            expect(isUTCFormat('2024-01-15T10:30:00-03:00')).toBe(false);
            expect(isUTCFormat('2024-01-15T10:30:00')).toBe(false);
        });
    });

    describe('parseUTCOnly', () => {
        it('should parse valid UTC format', () => {
            const isoString = '2024-01-15T10:30:00.000Z';
            const timestamp = parseUTCOnly(isoString);

            expect(timestamp).toBeInstanceOf(Timestamp);
            expect(timestamp?.toDate().toISOString()).toBe(isoString);
        });

        it('should throw error for non-UTC format', () => {
            expect(() => parseUTCOnly('2024-01-15T10:30:00+05:00')).toThrow(
                'Date must be in UTC format'
            );
        });
    });

    describe('validateUTCDate', () => {
        it('should validate correct UTC date', () => {
            const result = validateUTCDate('2024-01-15T10:30:00.000Z');
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject non-UTC format', () => {
            const result = validateUTCDate('2024-01-15T10:30:00+05:00');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('UTC format');
        });

        it('should reject invalid date format', () => {
            const result = validateUTCDate('2024-13-45T10:30:00.000Z');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid date format');
        });

        it('should reject future dates', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 2);
            const result = validateUTCDate(futureDate.toISOString());
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Date cannot be in the future');
        });

        it('should reject dates too far in the past', () => {
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 15);
            const result = validateUTCDate(oldDate.toISOString());
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('more than 10 years in the past');
        });
    });
});