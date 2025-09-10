import { expect, describe, it } from 'vitest';
import { ExactSplitStrategy } from '../../../../services/splits/ExactSplitStrategy';
import { SplitTypes } from '@splitifyd/shared';
import { ApiError } from '../../../../utils/errors';

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
            const splits = [
                { userId: 'user1', amount: 30 },
                { userId: 'user2', amount: 40 },
                { userId: 'user3', amount: 30 },
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits(100, participants)).toThrow(
                new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants')
            );
        });

        it('should throw error if split amounts do not sum to total amount', () => {
            const splits = [
                { userId: 'user1', amount: 30 },
                { userId: 'user2', amount: 40 },
                { userId: 'user3', amount: 20 }, // Total = 90, not 100
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).toThrow(
                new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount')
            );
        });
    });

    describe('calculateSplits', () => {
        it('should return exact splits as provided', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { userId: 'user1', amount: 70 },
                { userId: 'user2', amount: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ userId: 'user1', amount: 70 });
            expect(result[1]).toEqual({ userId: 'user2', amount: 30 });
        });

        it('should preserve percentage if provided', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { userId: 'user1', amount: 70, percentage: 70 },
                { userId: 'user2', amount: 30, percentage: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ userId: 'user1', amount: 70, percentage: 70 });
            expect(result[1]).toEqual({ userId: 'user2', amount: 30, percentage: 30 });
        });

        it('should not include percentage field when undefined', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { userId: 'user1', amount: 70 },
                { userId: 'user2', amount: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ userId: 'user1', amount: 70 });
            expect(result[1]).toEqual({ userId: 'user2', amount: 30 });
            expect(result[0]).not.toHaveProperty('percentage');
            expect(result[1]).not.toHaveProperty('percentage');
        });

        it('should throw error if splits are not provided', () => {
            const participants = ['user1', 'user2'];
            expect(() => strategy.calculateSplits(100, participants)).toThrow(
                'Splits are required for exact split type'
            );
        });
    });
});