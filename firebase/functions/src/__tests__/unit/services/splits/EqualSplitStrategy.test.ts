import { calculateEqualSplits, toAmount, toCurrencyISOCode, toUserId, USD } from '@billsplit-wl/shared';
import { ExpenseSplitBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { EqualSplitStrategy } from '../../../../services/splits/EqualSplitStrategy';

const user1 = toUserId('user1');
const user3 = toUserId('user3');
const user2 = toUserId('user2');

describe('EqualSplitStrategy', () => {
    const strategy = new EqualSplitStrategy();

    describe('validateSplits', () => {
        it('should validate equal splits for two participants', () => {
            const participants = [user1, user2];
            const splits = calculateEqualSplits(toAmount(100), USD, participants);

            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should validate equal splits for three participants', () => {
            const participants = [user1, user2, user3];
            const splits = calculateEqualSplits(toAmount(100), USD, participants);

            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should validate equal splits for single participant', () => {
            const participants = [user1];
            const splits = calculateEqualSplits(toAmount(100), USD, participants);

            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should validate equal splits with currency-aware precision (JPY)', () => {
            const participants = [user1, user2, user3];
            const splits = calculateEqualSplits(toAmount(100), toCurrencyISOCode('JPY'), participants);

            expect(() => strategy.validateSplits('100', participants, splits, toCurrencyISOCode('JPY'))).not.toThrow();
        });

        it('should reject when splits array is missing', () => {
            const participants = [user1, user2];

            expect(() => strategy.validateSplits('100', participants, undefined as any, USD)).toThrow('Splits must be provided');
        });

        it('should reject when splits length does not match participants', () => {
            const participants = [user1, user2, user3];
            const splits = calculateEqualSplits(toAmount(100), USD, [user1, user2]);

            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow('Splits must be provided');
        });

        it('should reject when split amount is missing', () => {
            const participants = [user1, user2];
            const splits = new ExpenseSplitBuilder().withSplit(user1, '50').withInvalidAmountSplit(user2, undefined).build();

            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow('Split amount is required');
        });

        it('should reject when splits do not sum to total', () => {
            const participants = [user1, user2];
            const splits = new ExpenseSplitBuilder().withSplit(user1, '40').withSplit(user2, '40').build();

            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow('Split amounts must equal total amount');
        });

        it('should reject when there are duplicate users', () => {
            const participants = [user1, user2];
            const splits = new ExpenseSplitBuilder().withSplit(user1, '50').withSplit(user1, '50').build();

            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow('Each participant can only appear once');
        });

        it('should reject when split user is not a participant', () => {
            const participants = [user1, user2];
            const splits = new ExpenseSplitBuilder().withSplit(user1, '50').withSplit(user3, '50').build();

            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow('Split user must be a participant');
        });

        it('should reject unequal splits for equal split type', () => {
            const participants = [user1, user2];
            const splits = new ExpenseSplitBuilder().withSplit(user1, '70').withSplit(user2, '30').build();

            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow('all participants should have equal amounts');
        });

        it('should allow remainder distribution (one person gets slightly more)', () => {
            const participants = [user1, user2, user3];
            // 100 / 3 = 33.33, 33.33, 33.34 (last person gets remainder)
            const splits = new ExpenseSplitBuilder().withSplit(user1, '33.33').withSplit(user2, '33.33').withSplit(user3, '33.34').build();

            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should allow remainder distribution across multiple participants', () => {
            const participants = [user1, user2, user3];
            const splits = new ExpenseSplitBuilder().withSplit(user1, '0.01').withSplit(user2, '0.01').withSplit(user3, '0.00').build();

            expect(() => strategy.validateSplits('0.02', participants, splits, USD)).not.toThrow();
        });
    });
});
