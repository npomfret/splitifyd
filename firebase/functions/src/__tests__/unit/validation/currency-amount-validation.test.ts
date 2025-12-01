import { CreateExpenseRequestBuilder, CreateSettlementRequestBuilder, ExpenseSplitBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { validateCreateExpense } from '../../../expenses/validation';
import { validateCreateSettlement } from '../../../settlements/validation';
import { ApiError } from '../../../errors';
import { ErrorCode } from '../../../errors';

describe('Currency-Aware Amount Validation', () => {
    describe('Zero Decimal Currencies (JPY, KRW, VND, etc.)', () => {
        it('should accept whole numbers for JPY', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(1000, 'JPY')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '500').withSplit('user2', '500').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('1000');
        });

        it('should reject decimal amounts for JPY', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.5, 'JPY')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            try {
                validateCreateExpense(expenseData);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });

        it('should reject decimal split amounts for KRW', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10000, 'KRW')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '5000.5').withSplit('user2', '4999.5').build())
                .build();

            try {
                validateCreateExpense(expenseData);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });
    });

    describe('Two Decimal Currencies (USD, EUR, GBP, etc.)', () => {
        it('should accept 2 decimal places for USD', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(99.99, 'USD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '49.99').withSplit('user2', '50.0').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('99.99');
        });

        it('should reject 3 decimal places for EUR', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.123, 'EUR')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            try {
                validateCreateExpense(expenseData);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });
    });

    describe('Three Decimal Currencies (BHD, KWD, OMR, etc.)', () => {
        it('should accept 3 decimal places for BHD', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10.123, 'BHD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '5.062').withSplit('user2', '5.061').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('10.123');
        });

        it('should reject 4 decimal places for KWD', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10.1234, 'KWD')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            try {
                validateCreateExpense(expenseData);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });
    });

    describe('One Decimal Currencies (MGA, MRU)', () => {
        it('should accept 1 decimal place for MGA', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.5, 'MGA')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '50.3').withSplit('user2', '50.2').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('100.5');
        });

        it('should reject 2 decimal places for MRU', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.55, 'MRU')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            try {
                validateCreateExpense(expenseData);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });
    });

    describe('Settlement Currency Validation', () => {
        it('should accept correct decimal precision for USD settlement', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(99.99, 'USD')
                .build();

            expect(() => validateCreateSettlement(settlementData)).not.toThrow();
        });

        it('should reject incorrect decimal precision for JPY settlement', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(100.5, 'JPY')
                .build();

            try {
                validateCreateSettlement(settlementData);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });

        it('should accept 3 decimals for BHD settlement', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(10.123, 'BHD')
                .build();

            expect(() => validateCreateSettlement(settlementData)).not.toThrow();
        });
    });

    describe('Split Strategy Currency Precision', () => {
        it('should validate remainder distribution for JPY exact splits', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(1000, 'JPY')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2', 'user3'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '334').withSplit('user2', '333').withSplit('user3', '333').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('1000');
        });

        it('should validate remainder distribution for USD exact splits', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.0, 'USD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2', 'user3'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '33.34').withSplit('user2', '33.33').withSplit('user3', '33.33').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('100');
        });

        it('should validate remainder distribution for BHD exact splits', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10.0, 'BHD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2', 'user3'])
                .withPaidBy('user1')
                .withSplits(new ExpenseSplitBuilder().withSplit('user1', '3.334').withSplit('user2', '3.333').withSplit('user3', '3.333').build())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe('10');
        });
    });
});
