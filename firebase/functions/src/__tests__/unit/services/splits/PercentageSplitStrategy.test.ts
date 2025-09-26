import { expect, describe, it } from 'vitest';
import { PercentageSplitStrategy } from '../../../../services/splits/PercentageSplitStrategy';
import { SplitTypes } from '@splitifyd/shared';
import { ApiError } from '../../../../utils/errors';

describe('PercentageSplitStrategy', () => {
    const strategy = new PercentageSplitStrategy();

    describe('getSplitType', () => {
        it('should return PERCENTAGE split type', () => {
            expect(strategy.getSplitType()).toBe(SplitTypes.PERCENTAGE);
        });
    });

    describe('requiresSplitsData', () => {
        it('should return true as percentage splits require splits data', () => {
            expect(strategy.requiresSplitsData()).toBe(true);
        });
    });

    describe('validateSplits', () => {
        const participants = ['user1', 'user2', 'user3'];

        it('should validate correct percentage splits', () => {
            const splits = [
                { uid: 'user1', amount: 30, percentage: 30 },
                { uid: 'user2', amount: 40, percentage: 40 },
                { uid: 'user3', amount: 30, percentage: 30 },
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits(100, participants)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if percentages do not sum to 100', () => {
            const splits = [
                { uid: 'user1', amount: 30, percentage: 30 },
                { uid: 'user2', amount: 40, percentage: 40 },
                { uid: 'user3', amount: 20, percentage: 20 }, // Total = 90, not 100
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(new ApiError(400, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100'));
        });
    });

    describe('calculateSplits', () => {
        it('should calculate splits based on percentages', () => {
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

        it('should handle decimal percentages', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 33.33, percentage: 33.33 },
                { uid: 'user2', amount: 66.67, percentage: 66.67 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 33.33, percentage: 33.33 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 66.67, percentage: 66.67 });
        });

        it('should throw error if splits are not provided', () => {
            const participants = ['user1', 'user2'];
            expect(() => strategy.calculateSplits(100, participants)).toThrow('Splits are required for percentage split type');
        });
    });
});
