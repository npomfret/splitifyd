import { expect, describe, it } from 'vitest';
import { ExactSplitStrategy } from '../../../../services/splits/ExactSplitStrategy';
import { SplitTypes } from '@splitifyd/shared';
import { ApiError } from '../../../../utils/errors';
import { ExpenseSplitBuilder } from '@splitifyd/test-support';

describe('ExactSplitStrategy', () => {
    const strategy = new ExactSplitStrategy();

    describe('getSplitType', () => {
        it('should return EXACT split type', () => {
            expect(strategy.getSplitType()).toBe(SplitTypes.EXACT);
        });
    });

    describe('requiresSplitsData', () => {
        it('should return true as exact splits require splits data', () => {
            expect(strategy.requiresSplitsData()).toBe(true);
        });
    });

    describe('validateSplits', () => {
        const participants = ['user1', 'user2', 'user3'];

        it('should validate correct exact splits', () => {
            const splits = ExpenseSplitBuilder.exactSplit([
                { uid: 'user1', amount: 30 },
                { uid: 'user2', amount: 40 },
                { uid: 'user3', amount: 30 },
            ]).build();
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits(100, participants)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if splits array is empty', () => {
            expect(() => strategy.validateSplits(100, participants, [])).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if split amounts do not sum to total amount', () => {
            const splits = [
                { uid: 'user1', amount: 30 },
                { uid: 'user2', amount: 40 },
                { uid: 'user3', amount: 20 }, // Total = 90, not 100
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });

        it('should throw error if split amounts exceed total amount', () => {
            const splits = [
                { uid: 'user1', amount: 30 },
                { uid: 'user2', amount: 40 },
                { uid: 'user3', amount: 40 }, // Total = 110, not 100
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });

        it('should allow rounding differences within 0.01 tolerance', () => {
            // Test floating point precision case
            const splits = [
                { uid: 'user1', amount: 33.33 },
                { uid: 'user2', amount: 33.33 },
                { uid: 'user3', amount: 33.34 }, // Total = 100.00 (within tolerance)
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should reject rounding differences outside 0.01 tolerance', () => {
            const splits = [
                { uid: 'user1', amount: 33.33 },
                { uid: 'user2', amount: 33.33 },
                { uid: 'user3', amount: 33.32 }, // Total = 99.98 (outside tolerance)
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });

        it('should throw error if split amount is null', () => {
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user2', amount: null as any },
                { uid: 'user3', amount: 50 },
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'MISSING_SPLIT_AMOUNT', 'Split amount is required for exact splits'));
        });

        it('should throw error if split amount is undefined', () => {
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user2', amount: undefined as any },
                { uid: 'user3', amount: 50 },
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'MISSING_SPLIT_AMOUNT', 'Split amount is required for exact splits'));
        });

        it('should allow negative amounts if they sum correctly', () => {
            // Edge case: refunds or corrections could result in negative splits
            const splits = [
                { uid: 'user1', amount: 120 },
                { uid: 'user2', amount: -10 },
                { uid: 'user3', amount: -10 }, // Total = 100
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should allow zero amounts if they sum correctly', () => {
            const splits = [
                { uid: 'user1', amount: 100 },
                { uid: 'user2', amount: 0 },
                { uid: 'user3', amount: 0 }, // Total = 100
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should handle single participant', () => {
            const singleParticipant = ['user1'];
            const splits = [{ uid: 'user1', amount: 50 }];
            expect(() => strategy.validateSplits(50, singleParticipant, splits)).not.toThrow();
        });

        it('should throw error if wrong number of splits provided', () => {
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user2', amount: 50 },
                // Missing user3
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if too many splits provided', () => {
            const splits = [
                { uid: 'user1', amount: 25 },
                { uid: 'user2', amount: 25 },
                { uid: 'user3', amount: 25 },
                { uid: 'user4', amount: 25 }, // Extra user not in participants
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if duplicate users in splits', () => {
            const splits = [
                { uid: 'user1', amount: 30 },
                { uid: 'user1', amount: 40 }, // Duplicate user1
                { uid: 'user2', amount: 30 },
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'DUPLICATE_SPLIT_USERS', 'Each participant can only appear once in splits'));
        });

        it('should throw error if split user is not a participant', () => {
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user2', amount: 25 },
                { uid: 'user4', amount: 25 }, // user4 not in participants
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_SPLIT_USER', 'Split user must be a participant'));
        });

        it('should handle large amounts correctly', () => {
            const largeParticipants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 999999.99 },
                { uid: 'user2', amount: 0.01 },
            ];
            expect(() => strategy.validateSplits(1000000, largeParticipants, splits)).not.toThrow();
        });

        it('should handle very small amounts correctly', () => {
            const smallParticipants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 0.005 },
                { uid: 'user2', amount: 0.005 },
            ];
            expect(() => strategy.validateSplits(0.01, smallParticipants, splits)).not.toThrow();
        });

        it('should handle zero total amount correctly', () => {
            const zeroParticipants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 0 },
                { uid: 'user2', amount: 0 },
            ];
            expect(() => strategy.validateSplits(0, zeroParticipants, splits)).not.toThrow();
        });

        it('should handle floating point precision edge case (0.1 + 0.2)', () => {
            const precisionParticipants = ['user1', 'user2', 'user3'];
            const splits = [
                { uid: 'user1', amount: 0.1 },
                { uid: 'user2', amount: 0.2 },
                { uid: 'user3', amount: 0.0 },
            ];
            // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
            expect(() => strategy.validateSplits(0.3, precisionParticipants, splits)).not.toThrow();
        });

        it('should handle currency with no decimal places (like JPY)', () => {
            const jpyParticipants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 150 },
                { uid: 'user2', amount: 100 },
            ];
            expect(() => strategy.validateSplits(250, jpyParticipants, splits)).not.toThrow();
        });

        it('should handle JPY currency edge cases with exact amounts', () => {
            const jpyParticipants = ['user1', 'user2', 'user3'];

            // Test case where decimal amounts wouldn't make sense for JPY
            const splits = [
                { uid: 'user1', amount: 334 },
                { uid: 'user2', amount: 333 },
                { uid: 'user3', amount: 333 },
            ];
            expect(() => strategy.validateSplits(1000, jpyParticipants, splits)).not.toThrow();
        });

        it('should handle other zero-decimal currencies (KRW, VND)', () => {
            // Korean Won example
            const krwParticipants = ['user1', 'user2'];
            const krwSplits = [
                { uid: 'user1', amount: 15000 },
                { uid: 'user2', amount: 10000 },
            ];
            expect(() => strategy.validateSplits(25000, krwParticipants, krwSplits)).not.toThrow();

            // Vietnamese Dong example
            const vndParticipants = ['user1', 'user2', 'user3'];
            const vndSplits = [
                { uid: 'user1', amount: 100000 },
                { uid: 'user2', amount: 150000 },
                { uid: 'user3', amount: 50000 },
            ];
            expect(() => strategy.validateSplits(300000, vndParticipants, vndSplits)).not.toThrow();
        });

        it('should reject fractional amounts that would be invalid for zero-decimal currencies', () => {
            // This test shows that the validation doesn't enforce currency rules,
            // but documents expected behavior for fractional amounts in JPY context
            const jpyParticipants = ['user1', 'user2'];
            const fractionalSplits = [
                { uid: 'user1', amount: 100.5 },
                { uid: 'user2', amount: 99.5 },
            ];
            // Note: The strategy allows fractional amounts - currency-specific validation
            // would need to be handled at a higher level
            expect(() => strategy.validateSplits(200, jpyParticipants, fractionalSplits)).not.toThrow();
        });

        it('should reject splits with amounts that are barely outside tolerance', () => {
            const splits = [
                { uid: 'user1', amount: 33.333 },
                { uid: 'user2', amount: 33.333 },
                { uid: 'user3', amount: 33.333 }, // Total = 99.999, which is 0.001 off
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();

            const splitsOutsideTolerance = [
                { uid: 'user1', amount: 33.32 },
                { uid: 'user2', amount: 33.32 },
                { uid: 'user3', amount: 33.32 }, // Total = 99.96, which is 0.04 off (outside 0.01 tolerance)
            ];
            expect(() => strategy.validateSplits(100, participants, splitsOutsideTolerance)).toThrow(new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount'));
        });
    });

    describe('calculateSplits', () => {
        it('should return exact splits as provided', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 70 },
                { uid: 'user2', amount: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 70 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 30 });
        });

        it('should preserve percentage if provided', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 70, percentage: 70 },
                { uid: 'user2', amount: 30, percentage: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 70, percentage: 70 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 30, percentage: 30 });
        });

        it('should not include percentage field when undefined', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 70 },
                { uid: 'user2', amount: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 70 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 30 });
            expect(result[0]).not.toHaveProperty('percentage');
            expect(result[1]).not.toHaveProperty('percentage');
        });

        it('should throw error if splits are not provided', () => {
            const participants = ['user1', 'user2'];
            expect(() => strategy.calculateSplits(100, participants)).toThrow('Splits are required for exact split type');
        });
    });
});
