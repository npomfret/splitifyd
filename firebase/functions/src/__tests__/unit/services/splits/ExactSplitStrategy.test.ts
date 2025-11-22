import { toCurrencyISOCode, toUserId, USD } from '@billsplit-wl/shared';
import { ExpenseSplitBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { ExactSplitStrategy } from '../../../../services/splits/ExactSplitStrategy';
import { ApiError } from '../../../../utils/errors';


describe('ExactSplitStrategy', () => {
    const strategy = new ExactSplitStrategy();

    const userId1 = toUserId('user1');
    const userId2 = toUserId('user2');
    const userId3 = toUserId('user3');
    const userId4 = toUserId('user4');

    describe('validateSplits', () => {
        const participants = [userId1, userId2, userId3];

        it('should validate correct exact splits', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '30' },
                    { uid: userId2, amount: '40' },
                    { uid: userId3, amount: '30' },
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits('100', participants, undefined as any, USD)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if splits array is empty', () => {
            expect(() => strategy.validateSplits('100', participants, [], USD)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if split amounts do not sum to total amount', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '30' },
                    { uid: userId2, amount: '40' },
                    { uid: userId3, amount: '20' }, // Total = 90, not 100
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });

        it('should throw error if split amounts exceed total amount', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '30' },
                    { uid: userId2, amount: '40' },
                    { uid: userId3, amount: '40' }, // Total = 110, not 100
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });

        it('should allow remainder distribution that still sums exactly to the total', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '33.33' },
                    { uid: userId2, amount: '33.33' },
                    { uid: userId3, amount: '33.34' }, // Total = 100.00 exactly
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should reject splits that leave part of the total unassigned', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '33.33' },
                    { uid: userId2, amount: '33.33' },
                    { uid: userId3, amount: '33.32' }, // Total = 99.98 (missing remainder)
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });

        it('should throw error if split amount is null', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '50' },
                    { uid: userId2, amount: null as any },
                    { uid: userId3, amount: '50' },
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'MISSING_SPLIT_AMOUNT', 'Split amount is required for exact splits'));
        });

        it('should throw error if split amount is undefined', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '50' },
                    { uid: userId2, amount: undefined as any },
                    { uid: userId3, amount: '50' },
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'MISSING_SPLIT_AMOUNT', 'Split amount is required for exact splits'));
        });

        it('should allow negative amounts if they sum correctly', () => {
            // Edge case: refunds or corrections could result in negative splits
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '120' },
                    { uid: userId2, amount: '-10' },
                    { uid: userId3, amount: '-10' }, // Total = 100
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should allow zero amounts if they sum correctly', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '100' },
                    { uid: userId2, amount: '0' },
                    { uid: userId3, amount: '0' }, // Total = 100
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should handle single participant', () => {
            const singleParticipant = [userId1];
            const splits = ExpenseSplitBuilder
                .exactSplit([{ uid: userId1, amount: '50' }])
                .build();
            expect(() => strategy.validateSplits('50', singleParticipant, splits, USD)).not.toThrow();
        });

        it('should throw error if wrong number of splits provided', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '50' },
                    { uid: userId2, amount: '50' },
                    // Missing user3
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if too many splits provided', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '25' },
                    { uid: userId2, amount: '25' },
                    { uid: userId3, amount: '25' },
                    { uid: userId4, amount: '25' }, // Extra user not in participants
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if duplicate users in splits', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '30' },
                    { uid: userId1, amount: '40' }, // Duplicate user1
                    { uid: userId2, amount: '30' },
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'DUPLICATE_SPLIT_USERS', 'Each participant can only appear once in splits'));
        });

        it('should throw error if split user is not a participant', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '50' },
                    { uid: userId2, amount: '25' },
                    { uid: userId4, amount: '25' }, // user4 not in participants
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLIT_USER', 'Split user must be a participant'));
        });

        it('should handle large amounts correctly', () => {
            const largeParticipants = [userId1, userId2];
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '999999.99' },
                    { uid: userId2, amount: '0.01' },
                ])
                .build();
            expect(() => strategy.validateSplits('1000000', largeParticipants, splits, USD)).not.toThrow();
        });

        it('should handle very small amounts with proper rounding correctly', () => {
            const smallParticipants = [userId1, userId2];
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '0.01' },
                    { uid: userId2, amount: '0.00' },
                ])
                .build();
            expect(() => strategy.validateSplits('0.01', smallParticipants, splits, USD)).not.toThrow();
        });

        it('should handle zero total amount correctly', () => {
            const zeroParticipants = [userId1, userId2];
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '0' },
                    { uid: userId2, amount: '0' },
                ])
                .build();
            expect(() => strategy.validateSplits('0', zeroParticipants, splits, USD)).not.toThrow();
        });

        it('should handle floating point precision edge case (0.1 + 0.2)', () => {
            const precisionParticipants = [userId1, userId2, userId3];
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '0.1' },
                    { uid: userId2, amount: '0.2' },
                    { uid: userId3, amount: '0.0' },
                ])
                .build();
            // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
            expect(() => strategy.validateSplits('0.3', precisionParticipants, splits, USD)).not.toThrow();
        });

        it('should handle currency with no decimal places (like JPY)', () => {
            const jpyParticipants = [userId1, userId2];
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '150' },
                    { uid: userId2, amount: '100' },
                ])
                .build();
            expect(() => strategy.validateSplits('250', jpyParticipants, splits, toCurrencyISOCode('JPY'))).not.toThrow();
        });

        it('should handle JPY currency edge cases with exact amounts', () => {
            const jpyParticipants = [userId1, userId2, userId3];

            // Test case where decimal amounts wouldn't make sense for JPY
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '334' },
                    { uid: userId2, amount: '333' },
                    { uid: userId3, amount: '333' },
                ])
                .build();
            expect(() => strategy.validateSplits('1000', jpyParticipants, splits, toCurrencyISOCode('JPY'))).not.toThrow();
        });

        it('should handle other zero-decimal currencies (KRW, VND)', () => {
            // Korean Won example
            const krwParticipants = [userId1, userId2];
            const krwSplits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '15000' },
                    { uid: userId2, amount: '10000' },
                ])
                .build();
            expect(() => strategy.validateSplits('25000', krwParticipants, krwSplits, toCurrencyISOCode('KRW'))).not.toThrow();

            // Vietnamese Dong example
            const vndParticipants = [userId1, userId2, userId3];
            const vndSplits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '100000' },
                    { uid: userId2, amount: '150000' },
                    { uid: userId3, amount: '50000' },
                ])
                .build();
            expect(() => strategy.validateSplits('300000', vndParticipants, vndSplits, toCurrencyISOCode('VND'))).not.toThrow();
        });

        it('should reject fractional amounts that would be invalid for zero-decimal currencies', () => {
            const jpyParticipants = [userId1, userId2];
            const fractionalSplits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '100.5' },
                    { uid: userId2, amount: '99.5' },
                ])
                .build();
            expect(() => strategy.validateSplits('200', jpyParticipants, fractionalSplits, toCurrencyISOCode('JPY'))).toThrowError(ApiError);
        });

        it('should reject splits that depend on fractional rounding for currency precision', () => {
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '33.333' },
                    { uid: userId2, amount: '33.333' },
                    { uid: userId3, amount: '33.333' }, // Total = 99.999, which is 0.001 off
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));

            const splitsOutsideTolerance = ExpenseSplitBuilder
                .exactSplit([
                    { uid: userId1, amount: '33.32' },
                    { uid: userId2, amount: '33.32' },
                    { uid: userId3, amount: '33.32' }, // Total = 99.96, which is 0.04 off
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splitsOutsideTolerance, USD)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });
    });
});
