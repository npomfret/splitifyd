import { describe, it, expect, beforeAll } from '@jest/globals';
import { Timestamp } from 'firebase-admin/firestore';
import { parseISOToTimestamp, timestampToISO, createServerTimestamp, isDateInValidRange, getStartOfDay, getEndOfDay } from '../../../utils/dateHelpers';

describe('Firebase Date Handling Integration Tests', () => {
    beforeAll(async () => {

        // Admin is already initialized in firebase-test-setup
    });


    describe('Date Utility Functions', () => {
        it('should correctly parse ISO strings to Timestamps', () => {
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

        it('should convert Timestamps to ISO strings', () => {
            const now = createServerTimestamp();
            const isoString = timestampToISO(now);

            expect(typeof isoString).toBe('string');
            expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should validate date ranges correctly', () => {
            const validDate = new Date();
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 11);
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 2); // More than 24 hours in the future

            expect(isDateInValidRange(validDate)).toBe(true);
            expect(isDateInValidRange(oldDate)).toBe(false);
            expect(isDateInValidRange(futureDate)).toBe(false);
        });

        it('should calculate start and end of day correctly', () => {
            const testDate = new Date('2024-01-15T14:30:00.000Z');

            const startOfDay = getStartOfDay(testDate);
            expect(startOfDay.toDate().toISOString()).toBe('2024-01-15T00:00:00.000Z');

            const endOfDay = getEndOfDay(testDate);
            expect(endOfDay.toDate().toISOString()).toBe('2024-01-15T23:59:59.999Z');
        });
    });

    describe('Server-side Timestamp Generation', () => {
        it('should create server timestamps', () => {
            const timestamp = createServerTimestamp();
            expect(timestamp).toBeInstanceOf(Timestamp);

            // Verify timestamp is recent
            const now = Date.now();
            const timestampMs = timestamp.toMillis();
            expect(Math.abs(now - timestampMs)).toBeLessThan(10000); // Within 10 seconds
        });

        it('should create consistent timestamps', () => {
            const timestamp1 = createServerTimestamp();
            const timestamp2 = createServerTimestamp();

            // Timestamps should be very close but potentially different
            const diff = Math.abs(timestamp1.toMillis() - timestamp2.toMillis());
            expect(diff).toBeLessThan(1000); // Within 1 second
        });
    });

    describe('Date Validation Edge Cases', () => {
        it('should handle leap year dates correctly', () => {
            const leapYearDate = new Date('2024-02-29');
            expect(isDateInValidRange(leapYearDate)).toBe(true);

            const timestamp = parseISOToTimestamp(leapYearDate.toISOString());
            expect(timestamp).toBeInstanceOf(Timestamp);
        });

        it('should handle timezone edge cases', () => {
            const timezones = [
                '2024-01-15T10:30:00Z', // UTC
                '2024-01-15T10:30:00.000Z', // UTC with milliseconds
                '2024-01-15T10:30:00+00:00', // UTC with offset
                '2024-01-15T10:30:00-05:00', // EST
                '2024-01-15T10:30:00+09:00', // JST
            ];

            for (const dateString of timezones) {
                const timestamp = parseISOToTimestamp(dateString);
                expect(timestamp).toBeInstanceOf(Timestamp);

                const inputDate = new Date(dateString);
                expect(timestamp?.toMillis()).toBe(inputDate.getTime());
            }
        });
    });

    // Note: Full API integration tests require the Firebase emulator to be running
    // These tests focus on the date utility functions themselves
    // Run full integration tests with: npm run test:integration (with emulator running)
});
