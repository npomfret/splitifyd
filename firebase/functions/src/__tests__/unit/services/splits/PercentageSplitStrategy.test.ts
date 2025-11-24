import { toUserId, USD } from '@billsplit-wl/shared';
import { ExpenseSplitBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { PercentageSplitStrategy } from '../../../../services/splits/PercentageSplitStrategy';
import { ApiError } from '../../../../utils/errors';

describe('PercentageSplitStrategy', () => {
    const strategy = new PercentageSplitStrategy();

    const userId1 = toUserId('user1');
    const userId2 = toUserId('user2');
    const userId3 = toUserId('user3');

    describe('validateSplits', () => {
        const participants = [userId1, userId2, userId3];

        it('should validate correct percentage splits', () => {
            const splits = ExpenseSplitBuilder
                .percentageSplit(100, [
                    { uid: userId1, percentage: 30 },
                    { uid: userId2, percentage: 40 },
                    { uid: userId3, percentage: 30 },
                ], USD)
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits('100', participants, undefined as any, USD)).toThrow(new ApiError(400, 'INVALID_SPLITS', 'Splits must be provided for all participants'));
        });

        it('should throw error if percentages do not sum to 100', () => {
            const splits = ExpenseSplitBuilder
                .percentageSplit(100, [
                    { uid: userId1, percentage: 30 },
                    { uid: userId2, percentage: 40 },
                    { uid: userId3, percentage: 20 }, // Total = 90, not 100
                ], USD)
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(new ApiError(400, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100'));
        });

        it('should allow high precision percentages that still sum to 100', () => {
            const splits = ExpenseSplitBuilder
                .percentageSplit(100, [
                    { uid: userId1, percentage: 33.333 },
                    { uid: userId2, percentage: 33.333 },
                    { uid: userId3, percentage: 33.334 },
                ], USD)
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });
    });
});
