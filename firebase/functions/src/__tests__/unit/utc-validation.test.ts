import { CreateExpenseRequestBuilder, CreateSettlementRequestBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { validateCreateExpense } from '../../expenses/validation';
import { createSettlementSchema } from '../../settlements/validation';
import { isUTCFormat, parseUTCOnly, validateUTCDate } from '../../utils/dateHelpers';

describe('UTC Date Validation', () => {
    describe('dateHelpers', () => {
        describe('isUTCFormat', () => {
            it('should accept valid UTC formats', () => {
                expect(isUTCFormat('2025-01-11T00:00:00.000Z')).toBe(true);
                expect(isUTCFormat('2025-01-11T00:00:00Z')).toBe(true);
                expect(isUTCFormat('2025-01-11T00:00:00+00:00')).toBe(true);
                expect(isUTCFormat('2025-01-11T00:00:00-00:00')).toBe(true);
            });

            it('should reject non-UTC formats', () => {
                expect(isUTCFormat('2025-01-11T00:00:00-05:00')).toBe(false);
                expect(isUTCFormat('2025-01-11T00:00:00+02:00')).toBe(false);
                expect(isUTCFormat('2025-01-11')).toBe(false);
                expect(isUTCFormat('2025-01-11 00:00:00')).toBe(false);
                expect(isUTCFormat('invalid-date')).toBe(false);
            });
        });

        describe('parseUTCOnly', () => {
            it('should parse valid UTC dates', () => {
                const date1 = parseUTCOnly('2025-01-11T00:00:00.000Z');
                expect(date1).toBeDefined();
                expect(date1).not.toBeNull();
                // Check it's a valid Firestore Timestamp
                if (date1) {
                    const dateObj = date1.toDate();
                    expect(dateObj).toBeInstanceOf(Date);
                    expect(dateObj.toISOString()).toBe('2025-01-11T00:00:00.000Z');
                }

                const date2 = parseUTCOnly('2025-01-11T12:30:45Z');
                expect(date2).toBeDefined();
                expect(date2).not.toBeNull();
                if (date2) {
                    const dateObj = date2.toDate();
                    expect(dateObj).toBeInstanceOf(Date);
                    expect(dateObj.toISOString()).toBe('2025-01-11T12:30:45.000Z');
                }
            });

            it('should throw for non-UTC dates', () => {
                expect(() => parseUTCOnly('2025-01-11T00:00:00-05:00')).toThrow('Date must be in UTC format');
                expect(() => parseUTCOnly('2025-01-11')).toThrow('Date must be in UTC format');
                expect(() => parseUTCOnly('invalid')).toThrow('Date must be in UTC format');
            });
        });

        describe('validateUTCDate', () => {
            it('should accept valid UTC dates', () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayUTC = today.toISOString();

                const result1 = validateUTCDate(todayUTC);
                expect(result1.valid).toBe(true);
                expect(result1.error).toBeUndefined();

                const result2 = validateUTCDate('2024-01-01T00:00:00.000Z');
                expect(result2.valid).toBe(true);
                expect(result2.error).toBeUndefined();
            });

            it('should reject future dates', () => {
                const future = new Date();
                future.setDate(future.getDate() + 2); // 2 days in future, beyond 24h buffer
                const futureUTC = future.toISOString();

                const result = validateUTCDate(futureUTC);
                expect(result.valid).toBe(false);
                expect(result.error).toContain('Date cannot be in the future');
            });

            it('should reject non-UTC dates', () => {
                const result1 = validateUTCDate('2025-01-11T00:00:00-05:00');
                expect(result1.valid).toBe(false);
                expect(result1.error).toContain('Date must be in UTC format');

                const result2 = validateUTCDate('2025-01-11');
                expect(result2.valid).toBe(false);
                expect(result2.error).toContain('Date must be in UTC format');
            });

            it('should reject invalid dates', () => {
                const result1 = validateUTCDate('invalid-date');
                expect(result1.valid).toBe(false);
                expect(result1.error).toContain('Date must be in UTC format');

                const result2 = validateUTCDate('2025-13-01T00:00:00Z');
                expect(result2.valid).toBe(false);
                expect(result2.error).toContain('Invalid date');
            });
        });
    });

    describe('Expense Validation', () => {
        it('should accept expenses with UTC dates', () => {
            const validExpense = new CreateExpenseRequestBuilder()
                .withAmount(1)
                .withCurrency('USD')
                .withDate('2024-01-01T00:00:00.000Z')
                .build();

            expect(() => validateCreateExpense(validExpense)).not.toThrow();
        });

        it('should reject expenses with non-UTC dates', () => {
            const invalidExpense = new CreateExpenseRequestBuilder()
                .withAmount(1)
                .withCurrency('USD')
                .withDate('2024-01-01T00:00:00-05:00') // Non-UTC timezone
                .build();

            expect(() => validateCreateExpense(invalidExpense)).toThrow('Date must be in UTC format');
        });

        it('should reject expenses with future dates', () => {
            const future = new Date();
            future.setDate(future.getDate() + 2); // 2 days in future, beyond 24h buffer

            const futureExpense = new CreateExpenseRequestBuilder()
                .withAmount(1)
                .withCurrency('USD')
                .withDate(future.toISOString())
                .build();

            expect(() => validateCreateExpense(futureExpense)).toThrow('Date cannot be in the future');
        });
    });

    describe('Settlement Validation', () => {
        it('should accept settlements with UTC dates', () => {
            const validSettlement = new CreateSettlementRequestBuilder()
                .withDate('2024-01-01T00:00:00.000Z')
                .build();

            const result = createSettlementSchema.safeParse(validSettlement);
            expect(result.success).toBe(true);
        });

        it('should accept settlements without dates (server will use current time)', () => {
            const validSettlement = new CreateSettlementRequestBuilder()
                .withoutDate()
                .build();

            const result = createSettlementSchema.safeParse(validSettlement);
            expect(result.success).toBe(true);
        });

        it('should reject settlements with non-UTC dates', () => {
            const invalidSettlement = new CreateSettlementRequestBuilder()
                .withDate('2024-01-01T00:00:00-05:00') // Non-UTC timezone
                .build();

            const result = createSettlementSchema.safeParse(invalidSettlement);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid date format');
            }
        });

        it('should reject settlements with future dates', () => {
            const future = new Date();
            future.setDate(future.getDate() + 2); // 2 days in future, beyond 24h buffer

            const futureSettlement = new CreateSettlementRequestBuilder()
                .withDate(future.toISOString())
                .build();

            const result = createSettlementSchema.safeParse(futureSettlement);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid date format');
            }
        });
    });
});
