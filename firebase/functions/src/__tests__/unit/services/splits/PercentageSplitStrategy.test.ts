import { ExpenseSplitBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { PercentageSplitStrategy } from '../../../../services/splits/PercentageSplitStrategy';
import { ApiError } from '../../../../utils/errors';

describe('PercentageSplitStrategy', () => {
    const strategy = new PercentageSplitStrategy();

    describe('validateSplits', () => {
        const participants = ['user1', 'user2', 'user3'];

        it('should validate correct percentage splits', () => {
            const splits = ExpenseSplitBuilder
                .percentageSplit(100, [
                    { uid: 'user1', percentage: 30 },
                    { uid: 'user2', percentage: 40 },
                    { uid: 'user3', percentage: 30 },
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, 'USD')).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits('100', participants, undefined as any, 'USD')).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if percentages do not sum to 100', () => {
            const splits = ExpenseSplitBuilder
                .percentageSplit(100, [
                    { uid: 'user1', percentage: 30 },
                    { uid: 'user2', percentage: 40 },
                    { uid: 'user3', percentage: 20 }, // Total = 90, not 100
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, 'USD')).toThrow(new ApiError(400, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100'));
        });

        it('should allow high precision percentages that still sum to 100', () => {
            const splits = ExpenseSplitBuilder
                .percentageSplit(100, [
                    { uid: 'user1', percentage: 33.333 },
                    { uid: 'user2', percentage: 33.333 },
                    { uid: 'user3', percentage: 33.334 },
                ])
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, 'USD')).not.toThrow();
        });
    });
});
