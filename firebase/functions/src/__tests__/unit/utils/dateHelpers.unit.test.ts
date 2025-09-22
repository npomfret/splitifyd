import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import {
    parseISOToTimestamp,
    timestampToISO,
    createOptimisticTimestamp,
    isDateInValidRange,
    getStartOfDay,
    getEndOfDay
} from '../../../utils/dateHelpers';

describe('Date Helpers - Unit Tests', () => {
    describe('parseISOToTimestamp', () => {
        it('should correctly parse valid ISO strings to Timestamps', () => {
            const isoString = '2024-01-15T10:30:00.000Z';
            const timestamp = parseISOToTimestamp(isoString);

            expect(timestamp).toBeInstanceOf(Timestamp);
            expect(timestamp?.toDate().toISOString()).toBe(isoString);
        });

        it('should handle invalid ISO strings gracefully', () => {
            const invalidString = 'not-a-date';
            const timestamp = parseISOToTimestamp(invalidString);

            expect(timestamp).toBeNull();
        });

        it('should handle null and undefined inputs', () => {
            // null creates a Date with timestamp 0 (epoch), which is valid
            const nullResult = parseISOToTimestamp(null as any);
            expect(nullResult).toBeInstanceOf(Timestamp);
            expect(nullResult?.toMillis()).toBe(0);

            // undefined creates an invalid Date, so returns null
            expect(parseISOToTimestamp(undefined as any)).toBeNull();
        });
    });

    describe('timestampToISO', () => {
        it('should convert Timestamps to ISO strings', () => {
            const now = createOptimisticTimestamp();
            const isoString = timestampToISO(now);

            expect(typeof isoString).toBe('string');
            expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should handle specific timestamp values correctly', () => {
            const specificDate = new Date('2024-01-15T10:30:00.000Z');
            const timestamp = Timestamp.fromDate(specificDate);
            const isoString = timestampToISO(timestamp);

            expect(isoString).toBe('2024-01-15T10:30:00.000Z');
        });
    });

    describe('createOptimisticTimestamp', () => {
        it('should create server timestamps', () => {
            const timestamp = createOptimisticTimestamp();
            expect(timestamp).toBeInstanceOf(Timestamp);

            // Verify timestamp is recent
            const now = Date.now();
            const timestampMs = timestamp.toMillis();
            expect(Math.abs(now - timestampMs)).toBeLessThan(10000); // Within 10 seconds
        });

        it('should create consistent timestamps', () => {
            const timestamp1 = createOptimisticTimestamp();
            const timestamp2 = createOptimisticTimestamp();

            // Timestamps should be very close but potentially different
            const diff = Math.abs(timestamp1.toMillis() - timestamp2.toMillis());
            expect(diff).toBeLessThan(1000); // Within 1 second
        });
    });

    describe('isDateInValidRange', () => {
        it('should validate current date as valid', () => {
            const validDate = new Date();
            expect(isDateInValidRange(validDate)).toBe(true);
        });

        it('should reject dates older than 10 years', () => {
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 11);
            expect(isDateInValidRange(oldDate)).toBe(false);
        });

        it('should reject dates more than 24 hours in the future', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 2);
            expect(isDateInValidRange(futureDate)).toBe(false);
        });

        it('should accept dates within 24 hours in the future', () => {
            const nearFutureDate = new Date();
            nearFutureDate.setHours(nearFutureDate.getHours() + 12);
            expect(isDateInValidRange(nearFutureDate)).toBe(true);
        });

        it('should handle edge case dates correctly', () => {
            // Create a date that's just under 10 years ago to ensure it's valid
            const almostTenYearsAgo = new Date();
            almostTenYearsAgo.setFullYear(almostTenYearsAgo.getFullYear() - 10);
            almostTenYearsAgo.setDate(almostTenYearsAgo.getDate() + 1); // Add 1 day to make it less than 10 years
            expect(isDateInValidRange(almostTenYearsAgo)).toBe(true);

            // Test exactly 24 hours from now (should be rejected)
            const exactly24HoursFromNow = new Date();
            exactly24HoursFromNow.setHours(exactly24HoursFromNow.getHours() + 24);
            exactly24HoursFromNow.setMinutes(exactly24HoursFromNow.getMinutes() + 1); // Add 1 minute to exceed the 24-hour buffer
            expect(isDateInValidRange(exactly24HoursFromNow)).toBe(false);
        });
    });

    describe('getStartOfDay and getEndOfDay', () => {
        it('should calculate start and end of day correctly', () => {
            const testDate = new Date('2024-01-15T14:30:00.000Z');

            const startOfDay = getStartOfDay(testDate);
            expect(startOfDay.toDate().toISOString()).toBe('2024-01-15T00:00:00.000Z');

            const endOfDay = getEndOfDay(testDate);
            expect(endOfDay.toDate().toISOString()).toBe('2024-01-15T23:59:59.999Z');
        });

        it('should handle different timezones consistently', () => {
            const testDate = new Date('2024-06-15T06:30:00.000Z'); // Different time

            const startOfDay = getStartOfDay(testDate);
            const endOfDay = getEndOfDay(testDate);

            expect(startOfDay.toDate().getUTCHours()).toBe(0);
            expect(startOfDay.toDate().getUTCMinutes()).toBe(0);
            expect(startOfDay.toDate().getUTCSeconds()).toBe(0);
            expect(startOfDay.toDate().getUTCMilliseconds()).toBe(0);

            expect(endOfDay.toDate().getUTCHours()).toBe(23);
            expect(endOfDay.toDate().getUTCMinutes()).toBe(59);
            expect(endOfDay.toDate().getUTCSeconds()).toBe(59);
            expect(endOfDay.toDate().getUTCMilliseconds()).toBe(999);
        });

        it('should handle leap year dates correctly', () => {
            const leapYearDate = new Date('2024-02-29T12:00:00.000Z');
            expect(isDateInValidRange(leapYearDate)).toBe(true);

            const timestamp = parseISOToTimestamp(leapYearDate.toISOString());
            expect(timestamp).toBeInstanceOf(Timestamp);

            const startOfDay = getStartOfDay(leapYearDate);
            expect(startOfDay.toDate().toISOString()).toBe('2024-02-29T00:00:00.000Z');
        });
    });

    describe('Integration between date functions', () => {
        it('should maintain consistency across conversions', () => {
            const originalDate = new Date('2024-01-15T10:30:00.000Z');

            // Convert to timestamp, then back to ISO
            const timestamp = Timestamp.fromDate(originalDate);
            const isoString = timestampToISO(timestamp);
            const backToTimestamp = parseISOToTimestamp(isoString);

            expect(backToTimestamp?.toDate().getTime()).toBe(originalDate.getTime());
        });

        it('should handle edge cases in date range validation', () => {
            const validDate = new Date();
            const timestamp = createOptimisticTimestamp();

            expect(isDateInValidRange(validDate)).toBe(true);
            expect(isDateInValidRange(timestamp.toDate())).toBe(true);
        });
    });
});