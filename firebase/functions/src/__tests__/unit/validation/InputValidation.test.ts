import { describe, it, expect } from 'vitest';
import { validateCreateExpense } from '../../../expenses/validation';
import { createSettlementSchema } from '../../../settlements/validation';
import { ApiError } from '../../../utils/errors';
import type { CreateExpenseRequest, CreateSettlementRequest } from '@splitifyd/shared';

describe('Input Validation Unit Tests', () => {
    describe('Amount Validation', () => {
        describe('Decimal Precision Edge Cases', () => {
            it('should handle very small amounts with proper precision', () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: 'test-group-id',
                    amount: 0.01,
                    description: 'Small amount test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(0.01);
                expect(result.participants).toHaveLength(2);
            });

            it('should handle amounts with many decimal places', () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: 'test-group-id',
                    amount: 33.333333,
                    description: 'Decimal places test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2', 'user3'],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(33.333333);
                expect(result.participants).toHaveLength(3);
            });

            it('should handle very large amounts', () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: 'test-group-id',
                    amount: 999999.99,
                    description: 'Large amount test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(999999.99);
                expect(result.participants).toHaveLength(2);
            });
        });

        describe('Invalid Amount Validation', () => {
            it('should reject zero amounts', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 0,
                    description: 'Zero amount test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative amounts', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: -50,
                    description: 'Negative amount test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject very small negative numbers', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: -0.01,
                    description: 'Tiny negative test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'food',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative infinity', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: Number.NEGATIVE_INFINITY,
                    description: 'Negative infinity test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'food',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should handle NaN values gracefully', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: NaN,
                    description: 'NaN test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'equal',
                    category: 'food',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Split Validation', () => {
        describe('Exact Split Validation', () => {
            it('should reject splits that do not add up to total amount', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Split validation test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 60 },
                        { uid: 'user2', amount: 30 }, // Only adds up to 90, not 100
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept splits with minor rounding differences (within tolerance)', () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Rounding test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2', 'user3'],
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 33.33 },
                        { uid: 'user2', amount: 33.33 },
                        { uid: 'user3', amount: 33.34 }, // Total: 100.00
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(100);
                expect(result.splits).toHaveLength(3);
            });

            it('should reject splits with differences greater than tolerance', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Large difference test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 50.0 },
                        { uid: 'user2', amount: 49.0 }, // Total: 99.00
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative split amounts', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Negative split test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 120 },
                        { uid: 'user2', amount: -20 }, // Negative amount
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject zero split amounts', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Zero split test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 100 },
                        { uid: 'user2', amount: 0 }, // Zero amount
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject duplicate users in splits', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Duplicate user test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 50 },
                        { uid: 'user1', amount: 50 }, // Duplicate user
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject splits for users not in participants list', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Invalid participant test',
                    paidBy: 'user1',
                    participants: ['user1'], // Only user1 is a participant
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 50 },
                        { uid: 'user2', amount: 50 }, // User2 is not a participant
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in exact split type', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Missing splits test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2', 'user3'], // 3 participants
                    splitType: 'exact',
                    splits: [
                        { uid: 'user1', amount: 50 },
                        { uid: 'user2', amount: 50 }, // Missing split for user3
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });

        describe('Percentage Split Validation', () => {
            it('should reject percentages that do not add up to 100%', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Percentage validation test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'percentage',
                    splits: [
                        { uid: 'user1', amount: 60, percentage: 60 },
                        { uid: 'user2', amount: 30, percentage: 30 }, // Only adds up to 90%
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept percentages with minor rounding differences (within tolerance)', () => {
                const expenseData: CreateExpenseRequest = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Percentage rounding test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2', 'user3'],
                    splitType: 'percentage',
                    splits: [
                        { uid: 'user1', amount: 33.33, percentage: 33.33 },
                        { uid: 'user2', amount: 33.33, percentage: 33.33 },
                        { uid: 'user3', amount: 33.34, percentage: 33.34 }, // Total: 100.00%
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(100);
                expect(result.splits).toHaveLength(3);
            });

            it('should reject negative percentages', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Negative percentage test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'],
                    splitType: 'percentage',
                    splits: [
                        { uid: 'user1', amount: 120, percentage: 120 },
                        { uid: 'user2', amount: -20, percentage: -20 }, // Negative percentage
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject percentages over 100%', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Percentage over 100 test',
                    paidBy: 'user1',
                    participants: ['user1'],
                    splitType: 'percentage',
                    splits: [
                        { uid: 'user1', amount: 100, percentage: 150 }, // 150% is over limit
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in percentage split type', () => {
                const expenseData = {
                    groupId: 'test-group-id',
                    amount: 100,
                    description: 'Missing percentage splits test',
                    paidBy: 'user1',
                    participants: ['user1', 'user2'], // 2 participants
                    splitType: 'percentage',
                    splits: [
                        { uid: 'user1', amount: 100, percentage: 100 }, // Missing split for user2
                    ],
                    category: 'other',
                    currency: 'USD',
                    date: new Date().toISOString(),
                };

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Settlement Validation', () => {
        it('should reject negative settlement amounts', () => {
            const settlementData = {
                groupId: 'test-group-id',
                payerId: 'user1',
                payeeId: 'user2',
                amount: -50, // Negative amount
                currency: 'USD',
                note: 'Test negative settlement',
            };

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toContain('greater than 0');
        });

        it('should reject zero settlement amounts', () => {
            const settlementData = {
                groupId: 'test-group-id',
                payerId: 'user1',
                payeeId: 'user2',
                amount: 0, // Zero amount
                currency: 'USD',
                note: 'Test zero settlement',
            };

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toContain('greater than 0');
        });

        it('should validate settlement amount does not exceed maximum', () => {
            const settlementData = {
                groupId: 'test-group-id',
                payerId: 'user1',
                payeeId: 'user2',
                amount: 1000000, // Amount exceeds max of 999,999.99
                currency: 'USD',
                note: 'Test max amount',
            };

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toContain('999,999.99');
        });

        it('should accept valid settlement amounts', () => {
            const settlementData: CreateSettlementRequest = {
                groupId: 'test-group-id',
                payerId: 'user1',
                payeeId: 'user2',
                amount: 50.0,
                currency: 'USD',
                note: 'Valid settlement test',
            };

            const { error, value } = createSettlementSchema.validate(settlementData);
            expect(error).toBeUndefined();
            expect(value.amount).toBe(50.0);
            expect(value.payerId).toBe('user1');
            expect(value.payeeId).toBe('user2');
        });
    });

    describe('Date Validation', () => {
        it('should reject future dates', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const expenseData = {
                groupId: 'test-group-id',
                amount: 100,
                description: 'Future date test',
                paidBy: 'user1',
                participants: ['user1'],
                splitType: 'equal',
                category: 'other',
                currency: 'USD',
                date: futureDate.toISOString(),
            };

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
        });

        it('should accept valid dates', () => {
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1);

            const expenseData: CreateExpenseRequest = {
                groupId: 'test-group-id',
                amount: 100,
                description: 'Valid date test',
                paidBy: 'user1',
                participants: ['user1'],
                splitType: 'equal',
                category: 'other',
                currency: 'USD',
                date: validDate.toISOString(),
            };

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBe('test-group-id');
            expect(result.amount).toBe(100);
        });
    });

    describe('Category Validation', () => {
        it('should accept valid category', () => {
            const expenseData: CreateExpenseRequest = {
                groupId: 'test-group-id',
                amount: 100,
                description: 'Valid category test',
                paidBy: 'user1',
                participants: ['user1'],
                splitType: 'equal',
                category: 'food',
                currency: 'USD',
                date: new Date().toISOString(),
            };

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBe('test-group-id');
            expect(result.category).toBe('food');
        });
    });
});