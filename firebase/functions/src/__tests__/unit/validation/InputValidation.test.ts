import { toUserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateSettlementRequestBuilder, ExpenseSplitBuilder } from '@billsplit-wl/test-support';
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
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '0.01').withSplit('user2', '0.01').build())
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
                    .withSplits(
                        ExpenseSplitBuilder
                            .exactSplit([
                                { uid: toUserId('user1'), amount: '499999.99' },
                                { uid: toUserId('user2'), amount: '499999.99' },
                            ])
                            .build(),
                    )
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
                    .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: toUserId('user1'), amount: '0' }]).build())
                    .withAmount(0, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withPaidBy('user1')
                    .withSplits(
                        ExpenseSplitBuilder
                            .exactSplit([
                                { uid: toUserId('user1'), amount: '25' },
                                { uid: toUserId('user2'), amount: '25' },
                            ])
                            .build(),
                    )
                    .withAmount(-50, 'USD')
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject very small negative numbers', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withPaidBy('user1')
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '0.01').withSplit('user2', '0.01').build())
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
                    .withSplits([{ uid: toUserId('user1'), amount: '1' }])
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
                    .withSplits([{ uid: toUserId('user1'), amount: '1' }])
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
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '60').withSplit('user2', '30').build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept splits that allocate the exact remainder in smallest units', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '33.33').withSplit('user2', '33.33').withSplit('user3', '33.34').build())
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
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '50.0').withSplit('user2', '49.0').build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject negative split amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '120').withSplit('user2', '-20').build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject zero split amounts', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '100').withSplit('user2', '0').build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject duplicate users in splits', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2'])
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '50').withSplit('user1', '50').build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject splits for users not in participants list', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1']) // Only user1 is a participant
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '50').withSplit('user2', '50').build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in exact split type', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('exact')
                    .withParticipants(['user1', 'user2', 'user3']) // 3 participants
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '50').withSplit('user2', '50').build())
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
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '60', 60).withSplit('user2', '30', 30).build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should accept percentages that sum to 100 exactly after normalization', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2', 'user3'])
                    .withPaidBy('user1')
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '33.33', 33.33).withSplit('user2', '33.33', 33.33).withSplit('user3', '33.34', 33.34).build())
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
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '120', 120).withSplit('user2', '-20', -20).build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should reject percentages over 100%', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1'])
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '100', 150).build())
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });

            it('should require splits for all participants in percentage split type', () => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withAmount(100, 'USD')
                    .withSplitType('percentage')
                    .withParticipants(['user1', 'user2']) // 2 participants
                    .withSplits(new ExpenseSplitBuilder().withSplit('user1', '100', 100).build())
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

    describe('Label Validation', () => {
        it('should accept valid label', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100, 'USD')
                .withLabel('food')
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.groupId).toBeDefined();
            expect(result.label).toBe('food');
        });
    });
});
