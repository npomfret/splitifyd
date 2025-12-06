import { toUserId, USD } from '@billsplit-wl/shared';
import { ExpenseSplitBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../../errors';
import { PercentageSplitStrategy } from '../../../../services/splits/PercentageSplitStrategy';

describe('PercentageSplitStrategy', () => {
    const strategy = new PercentageSplitStrategy();

    const userId1 = toUserId('user1');
    const userId2 = toUserId('user2');
    const userId3 = toUserId('user3');

    describe('validateSplits', () => {
        const participants = [userId1, userId2, userId3];

        it('should validate correct percentage splits', () => {
            // 30% of 100 = 30, 40% = 40, 30% = 30
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '30', 30)
                .withSplit(userId2, '40', 40)
                .withSplit(userId3, '30', 30)
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits('100', participants, undefined as any, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error if percentages do not sum to 100', () => {
            // 30% + 40% + 20% = 90%, not 100%
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '30', 30)
                .withSplit(userId2, '40', 40)
                .withSplit(userId3, '20', 20) // Total = 90%, not 100%
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should allow high precision percentages that still sum to 100', () => {
            // 33.333% + 33.333% + 33.334% = 100%
            // For total=100: 33.33 + 33.33 + 33.34 = 100.00
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '33.33', 33.333)
                .withSplit(userId2, '33.33', 33.333)
                .withSplit(userId3, '33.34', 33.334)
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });
    });
});
