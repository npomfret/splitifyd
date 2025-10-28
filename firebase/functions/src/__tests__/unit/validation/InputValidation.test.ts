import { CreateExpenseRequestBuilder, CreateSettlementRequestBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { validateCreateExpense } from '../../../expenses/validation';
import { validateCreateSettlement } from '../../../settlements/validation';
import { ApiError } from '../../../utils/errors';

describe('Input Validation Unit Tests', () => {
    describe('Amount Validation', () => {
        describe('Decimal Precision Edge Cases', () => {
            it('should handle very small amounts with proper precision', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(0.02, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: '0.01' },
                        { uid: 'user2', amount: '0.01' },
                    ])
                    .build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe('0.02');
                expect(result.participants).toHaveLength(2);
            });

            it('should reject amounts with too many decimal places for currency', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(33.333333, 'USD')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
                expect(() => validateCreateExpense(expenseData)).toThrow(/at most 2 decimal/);
            });

            it('should handle very large amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(999999.98, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: '499999.99' },
                        { uid: 'user2', amount: '499999.99' },
                    ])
                    .build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe('999999.98');
                expect(result.participants).toHaveLength(2);
            });
        });

        describe('Invalid Amount Validation', () => {
            it('should reject zero amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withSplitType('exact')
                    .withParticipants(['user1'])
                    .withPaidBy('user1')
                    .withSplits([{ uid: 'user1', amount: '0' }])
                    .withAmount(0, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: '25' },
                        { uid: 'user2', amount: '25' },
                    ])
                    .withAmount(-50, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject very small negative numbers', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: '0.01' },
                        { uid: 'user2', amount: '0.01' },
                    ])
                    .withAmount(-0.01, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative infinity', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withCurrency('USD')
                    .withSplitType('exact')
                    .withParticipants(['user1'])
                    .withPaidBy('user1')
                    .withSplits([{ uid: 'user1', amount: '1' }])
                    .withAmount(Number.NEGATIVE_INFINITY, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should handle NaN values gracefully', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withCurrency('USD')
                    .withSplitType('exact')
                    .withParticipants(['user1'])
                    .withPaidBy('user1')
                    .withSplits([{ uid: 'user1', amount: '1' }])
                    .withAmount(NaN, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Split Validation', () => {
        describe('Exact Split Validation', () => {
            it('should reject splits that do not add up to total amount', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '60' },
                        { uid: 'user2', amount: '30' }, // Only adds up to 90, not 100
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept splits that allocate the exact remainder in smallest units', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: '33.33' },
                        { uid: 'user2', amount: '33.33' },
                        { uid: 'user3', amount: '33.34' }, // Total: 100.00
                    ])
                    .build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe('100');
                expect(result.splits).toHaveLength(3);
            });

            it('should reject splits that do not account for the full total', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '50.0' },
                        { uid: 'user2', amount: '49.0' }, // Total: 99.00
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative split amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '120' },
                        { uid: 'user2', amount: '-20' }, // Negative amount
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject zero split amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '100' },
                        { uid: 'user2', amount: '0' }, // Zero amount
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject duplicate users in splits', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '50' },
                        { uid: 'user1', amount: '50' }, // Duplicate user
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject splits for users not in participants list', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1']) // Only user1 is a participant
                    .withSplits([
                        { uid: 'user1', amount: '50' },
                        { uid: 'user2', amount: '50' }, // User2 is not a participant
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in exact split type', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2', 'user3']) // 3 participants
                    .withSplits([
                        { uid: 'user1', amount: '50' },
                        { uid: 'user2', amount: '50' }, // Missing split for user3
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });

        describe('Percentage Split Validation', () => {
            it('should reject percentages that do not add up to 100%', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '60', percentage: 60 },
                        { uid: 'user2', amount: '30', percentage: 30 }, // Only adds up to 90%
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept percentages that sum to 100 exactly after normalization', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: '33.33', percentage: 33.33 },
                        { uid: 'user2', amount: '33.33', percentage: 33.33 },
                        { uid: 'user3', amount: '33.34', percentage: 33.34 }, // Total: 100.00%
                    ])
                    .build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe('100');
                expect(result.splits).toHaveLength(3);
            });

            it('should reject negative percentages', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: '120', percentage: 120 },
                        { uid: 'user2', amount: '-20', percentage: -20 }, // Negative percentage
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject percentages over 100%', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1'])
                    .withSplits([
                        { uid: 'user1', amount: '100', percentage: 150 }, // 150% is over limit
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in percentage split type', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2']) // 2 participants
                    .withSplits([
                        { uid: 'user1', amount: '100', percentage: 100 }, // Missing split for user2
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Settlement Validation', () => {
        it('should reject negative settlement amounts', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(-50, 'USD')
                .build();

            expect(() => validateCreateSettlement(settlementData)).toThrow(/valid decimal number/);
        });

        it('should reject zero settlement amounts', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(0, 'USD')
                .build();

            expect(() => validateCreateSettlement(settlementData)).toThrow(/greater than zero/);
        });

        it('should validate settlement amount does not exceed maximum', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(1000000, 'USD')
                .build();

            expect(() => validateCreateSettlement(settlementData)).toThrow(/999,999\.99/);
        });

        it('should accept valid settlement amounts', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(50.0, 'USD')
                .withPayerId('user1')
                .withPayeeId('user2')
                .build();

            const value = validateCreateSettlement(settlementData);
            expect(value.amount).toBe('50');
            expect(value.payerId).toBe('user1');
            expect(value.payeeId).toBe('user2');
        });
    });

    describe('Date Validation', () => {
        it('should reject future dates', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100, 'USD')
                .withDate(futureDate.toISOString())
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
        });

        it('should accept valid dates', () => {
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1);

            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100, 'USD')
                .withDate(validDate.toISOString())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBeDefined();
            expect(result.amount).toBe('100');
        });
    });

    describe('Category Validation', () => {
        it('should accept valid category', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100, 'USD')
                .withCategory('food')
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBeDefined();
            expect(result.category).toBe('food');
        });
    });
});
