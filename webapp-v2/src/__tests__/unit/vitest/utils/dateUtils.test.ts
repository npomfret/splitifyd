import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    formatLocalDateTime,
    formatExpenseDateTime,
    formatDistanceToNow,
    formatDateTimeInUserTimeZone,
    getUTCMidnight,
    getUTCDateTime,
    extractTimeFromISO,
    isDateInFuture,
} from '@/utils/dateUtils';

// Mock i18n module
vi.mock('@/i18n', () => ({
    default: {
        language: 'en',
        t: (key: string, options?: { count?: number }) => {
            const translations: Record<string, string> = {
                'relativeTime.justNow': 'just now',
                'relativeTime.minuteAgo': options?.count === 1 ? '1 minute ago' : `${options?.count} minutes ago`,
                'relativeTime.hourAgo': options?.count === 1 ? '1 hour ago' : `${options?.count} hours ago`,
                'relativeTime.dayAgo': options?.count === 1 ? '1 day ago' : `${options?.count} days ago`,
                'relativeTime.monthAgo': options?.count === 1 ? '1 month ago' : `${options?.count} months ago`,
                'relativeTime.yearAgo': options?.count === 1 ? '1 year ago' : `${options?.count} years ago`,
            };
            return translations[key] || key;
        },
    },
}));

describe('dateUtils', () => {
    describe('formatLocalDateTime', () => {
        it('should format a UTC string to local date time', () => {
            const result = formatLocalDateTime('2024-06-15T14:30:00.000Z');
            // Result depends on local timezone, just verify it returns a non-empty string
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });
    });

    describe('formatDateTimeInUserTimeZone', () => {
        it('should return empty string for invalid date', () => {
            expect(formatDateTimeInUserTimeZone(new Date('invalid'))).toBe('');
        });

        it('should format valid date in ISO-like format', () => {
            const date = new Date('2024-06-15T14:30:00.000Z');
            const result = formatDateTimeInUserTimeZone(date);
            // Should be in YYYY-MM-DD HH:MM:SS format
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        });
    });

    describe('formatExpenseDateTime', () => {
        it('should format date only when time is noon (12:00:00)', () => {
            const result = formatExpenseDateTime('2024-06-15T12:00:00.000Z');
            // Should contain date parts but format varies by locale
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });

        it('should format date with time when not noon', () => {
            const result = formatExpenseDateTime('2024-06-15T14:30:00.000Z');
            // Should contain date and time
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('formatDistanceToNow', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return "just now" for dates less than 60 seconds ago', () => {
            const date = new Date('2024-06-15T11:59:30.000Z'); // 30 seconds ago
            expect(formatDistanceToNow(date)).toBe('just now');
        });

        it('should return minutes ago for dates less than 60 minutes ago', () => {
            const date = new Date('2024-06-15T11:55:00.000Z'); // 5 minutes ago
            expect(formatDistanceToNow(date)).toBe('5 minutes ago');
        });

        it('should return "1 minute ago" for singular', () => {
            const date = new Date('2024-06-15T11:59:00.000Z'); // 1 minute ago
            expect(formatDistanceToNow(date)).toBe('1 minute ago');
        });

        it('should return hours ago for dates less than 24 hours ago', () => {
            const date = new Date('2024-06-15T09:00:00.000Z'); // 3 hours ago
            expect(formatDistanceToNow(date)).toBe('3 hours ago');
        });

        it('should return "1 hour ago" for singular', () => {
            const date = new Date('2024-06-15T11:00:00.000Z'); // 1 hour ago
            expect(formatDistanceToNow(date)).toBe('1 hour ago');
        });

        it('should return days ago for dates less than 30 days ago', () => {
            const date = new Date('2024-06-10T12:00:00.000Z'); // 5 days ago
            expect(formatDistanceToNow(date)).toBe('5 days ago');
        });

        it('should return months ago for dates less than 12 months ago', () => {
            const date = new Date('2024-04-15T12:00:00.000Z'); // ~2 months ago
            expect(formatDistanceToNow(date)).toBe('2 months ago');
        });

        it('should return years ago for dates more than 12 months ago', () => {
            const date = new Date('2022-06-15T12:00:00.000Z'); // 2 years ago
            expect(formatDistanceToNow(date)).toBe('2 years ago');
        });
    });

    describe('getUTCMidnight', () => {
        it('should return ISO string at midnight UTC', () => {
            const result = getUTCMidnight('2024-06-15');
            expect(result).toBe('2024-06-15T00:00:00.000Z');
        });

        it('should handle single digit months and days', () => {
            const result = getUTCMidnight('2024-01-05');
            expect(result).toBe('2024-01-05T00:00:00.000Z');
        });
    });

    describe('getUTCDateTime', () => {
        it('should combine date and time into UTC ISO string', () => {
            const result = getUTCDateTime('2024-06-15', '14:30');
            // Result will vary based on local timezone offset
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('extractTimeFromISO', () => {
        it('should extract time in HH:MM format', () => {
            const result = extractTimeFromISO('2024-06-15T14:30:00.000Z');
            // Result depends on local timezone
            expect(result).toMatch(/^\d{2}:\d{2}$/);
        });
    });

    describe('isDateInFuture', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return true for future dates', () => {
            expect(isDateInFuture('2024-06-20')).toBe(true);
        });

        it('should return false for past dates', () => {
            expect(isDateInFuture('2024-06-10')).toBe(false);
        });

        it('should return false for today', () => {
            expect(isDateInFuture('2024-06-15')).toBe(false);
        });
    });
});
