import { describe, it, expect } from 'vitest';
import { validateCreateExpense } from '../../../expenses/validation';
import { createSettlementSchema } from '../../../settlements/validation';
import { ApiError } from '../../../utils/errors';
import { CreateExpenseRequestBuilder, CreateSettlementRequestBuilder } from '@splitifyd/test-support';

describe('Input Validation Unit Tests', () => {
    describe('Amount Validation', () => {
        describe('Decimal Precision Edge Cases', () => {
            it('should handle very small amounts with proper precision', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(0.01).withParticipants(['user1', 'user2']).withPaidBy('user1').build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(0.01);
                expect(result.participants).toHaveLength(2);
            });

            it('should handle amounts with many decimal places', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(33.333333).withParticipants(['user1', 'user2', 'user3']).withPaidBy('user1').build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(33.333333);
                expect(result.participants).toHaveLength(3);
            });

            it('should handle very large amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(999999.99).withParticipants(['user1', 'user2']).withPaidBy('user1').build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(999999.99);
                expect(result.participants).toHaveLength(2);
            });
        });

        describe('Invalid Amount Validation', () => {
            it('should reject zero amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(0).build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(-50).build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject very small negative numbers', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(-0.01).build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative infinity', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(Number.NEGATIVE_INFINITY).build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should handle NaN values gracefully', () => {
                const expenseData = new CreateExpenseRequestBuilder().withAmount(NaN).build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Split Validation', () => {
        describe('Exact Split Validation', () => {
            it('should reject splits that do not add up to total amount', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 60 },
                        { uid: 'user2', amount: 30 }, // Only adds up to 90, not 100
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept splits with minor rounding differences (within tolerance)', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: 33.33 },
                        { uid: 'user2', amount: 33.33 },
                        { uid: 'user3', amount: 33.34 }, // Total: 100.00
                    ])
                    .build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(100);
                expect(result.splits).toHaveLength(3);
            });

            it('should reject splits with differences greater than tolerance', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 50.0 },
                        { uid: 'user2', amount: 49.0 }, // Total: 99.00
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative split amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 120 },
                        { uid: 'user2', amount: -20 }, // Negative amount
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject zero split amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 100 },
                        { uid: 'user2', amount: 0 }, // Zero amount
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject duplicate users in splits', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 50 },
                        { uid: 'user1', amount: 50 }, // Duplicate user
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject splits for users not in participants list', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1']) // Only user1 is a participant
                    .withSplits([
                        { uid: 'user1', amount: 50 },
                        { uid: 'user2', amount: 50 }, // User2 is not a participant
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in exact split type', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2', 'user3']) // 3 participants
                    .withSplits([
                        { uid: 'user1', amount: 50 },
                        { uid: 'user2', amount: 50 }, // Missing split for user3
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });

        describe('Percentage Split Validation', () => {
            it('should reject percentages that do not add up to 100%', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 60, percentage: 60 },
                        { uid: 'user2', amount: 30, percentage: 30 }, // Only adds up to 90%
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept percentages with minor rounding differences (within tolerance)', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .withSplits([
                        { uid: 'user1', amount: 33.33, percentage: 33.33 },
                        { uid: 'user2', amount: 33.33, percentage: 33.33 },
                        { uid: 'user3', amount: 33.34, percentage: 33.34 }, // Total: 100.00%
                    ])
                    .build();

                const result = validateCreateExpense(expenseData);
                expect(result.amount).toBe(100);
                expect(result.splits).toHaveLength(3);
            });

            it('should reject negative percentages', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { uid: 'user1', amount: 120, percentage: 120 },
                        { uid: 'user2', amount: -20, percentage: -20 }, // Negative percentage
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject percentages over 100%', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('percentage')
                    .withParticipants(['user1'])
                    .withSplits([
                        { uid: 'user1', amount: 100, percentage: 150 }, // 150% is over limit
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in percentage split type', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100)
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2']) // 2 participants
                    .withSplits([
                        { uid: 'user1', amount: 100, percentage: 100 }, // Missing split for user2
                    ])
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Settlement Validation', () => {
        it('should reject negative settlement amounts', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(-50) // Negative amount
                .build();

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toContain('greater than 0');
        });

        it('should reject zero settlement amounts', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(0) // Zero amount
                .build();

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toContain('greater than 0');
        });

        it('should validate settlement amount does not exceed maximum', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(1000000) // Amount exceeds max of 999,999.99
                .build();

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toContain('999,999.99');
        });

        it('should accept valid settlement amounts', () => {
            const settlementData = new CreateSettlementRequestBuilder().withAmount(50.0).withPayerId('user1').withPayeeId('user2').build();

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

            const expenseData = new CreateExpenseRequestBuilder().withDate(futureDate.toISOString()).build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
        });

        it('should accept valid dates', () => {
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1);

            const expenseData = new CreateExpenseRequestBuilder().withDate(validDate.toISOString()).withAmount(100).build();

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBeDefined();
            expect(result.amount).toBe(100);
        });
    });

    describe('Category Validation', () => {
        it('should accept valid category', () => {
            const expenseData = new CreateExpenseRequestBuilder().withCategory('food').build();

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBeDefined();
            expect(result.category).toBe('food');
        });
    });
});
