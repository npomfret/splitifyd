import { CreateExpenseRequestBuilder, CreateSettlementRequestBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { validateCreateExpense } from '../../../expenses/validation';
import { createSettlementSchema } from '../../../settlements/validation';
import { ApiError } from '../../../utils/errors';

describe('Currency-Aware Amount Validation', () => {
    describe('Zero Decimal Currencies (JPY, KRW, VND, etc.)', () => {
        it('should accept whole numbers for JPY', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(1000)
                .withCurrency('JPY')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 500 },
                    { uid: 'user2', amount: 500 },
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(1000);
        });

        it('should reject decimal amounts for JPY', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.5)
                .withCurrency('JPY')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/whole number for JPY/);
        });

        it('should reject decimal split amounts for KRW', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10000)
                .withCurrency('KRW')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 5000.5 },
                    { uid: 'user2', amount: 4999.5 },
                ])
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/whole number for KRW/);
        });
    });

    describe('Two Decimal Currencies (USD, EUR, GBP, etc.)', () => {
        it('should accept 2 decimal places for USD', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(99.99)
                .withCurrency('USD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 49.99 },
                    { uid: 'user2', amount: 50.0 },
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(99.99);
        });

        it('should reject 3 decimal places for EUR', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.123)
                .withCurrency('EUR')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/at most 2 decimal.*EUR/);
        });
    });

    describe('Three Decimal Currencies (BHD, KWD, OMR, etc.)', () => {
        it('should accept 3 decimal places for BHD', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10.123)
                .withCurrency('BHD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 5.062 },
                    { uid: 'user2', amount: 5.061 },
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(10.123);
        });

        it('should reject 4 decimal places for KWD', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10.1234)
                .withCurrency('KWD')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/at most 3 decimal.*KWD/);
        });
    });

    describe('One Decimal Currencies (MGA, MRU)', () => {
        it('should accept 1 decimal place for MGA', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.5)
                .withCurrency('MGA')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 50.3 },
                    { uid: 'user2', amount: 50.2 },
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(100.5);
        });

        it('should reject 2 decimal places for MRU', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.55)
                .withCurrency('MRU')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .withPaidBy('user1')
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/at most 1 decimal.*MRU/);
        });
    });

    describe('Settlement Currency Validation', () => {
        it('should accept correct decimal precision for USD settlement', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(99.99)
                .withCurrency('USD')
                .build();

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeUndefined();
        });

        it('should reject incorrect decimal precision for JPY settlement', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(100.5)
                .withCurrency('JPY')
                .build();

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeDefined();
            expect(error?.message).toMatch(/whole number for JPY/);
        });

        it('should accept 3 decimals for BHD settlement', () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withAmount(10.123)
                .withCurrency('BHD')
                .build();

            const { error } = createSettlementSchema.validate(settlementData);
            expect(error).toBeUndefined();
        });
    });

    describe('Split Strategy Currency Tolerance', () => {
        it('should use correct tolerance for JPY exact splits (tolerance: 1)', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(1000)
                .withCurrency('JPY')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2', 'user3'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 334 },
                    { uid: 'user2', amount: 333 },
                    { uid: 'user3', amount: 333 }, // Total: 1000 (within tolerance)
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(1000);
        });

        it('should use correct tolerance for USD exact splits (tolerance: 0.01)', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(100.0)
                .withCurrency('USD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2', 'user3'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 33.34 },
                    { uid: 'user2', amount: 33.33 },
                    { uid: 'user3', amount: 33.33 }, // Total: 100.00 (within tolerance)
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(100.0);
        });

        it('should use correct tolerance for BHD exact splits (tolerance: 0.001)', () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withAmount(10.0)
                .withCurrency('BHD')
                .withSplitType('exact')
                .withParticipants(['user1', 'user2', 'user3'])
                .withPaidBy('user1')
                .withSplits([
                    { uid: 'user1', amount: 3.334 },
                    { uid: 'user2', amount: 3.333 },
                    { uid: 'user3', amount: 3.333 }, // Total: 10.000 (within tolerance)
                ])
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.amount).toBe(10.0);
        });
    });
});
