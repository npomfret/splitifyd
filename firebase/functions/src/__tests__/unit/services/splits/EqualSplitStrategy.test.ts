import { calculateEqualSplits } from '@splitifyd/shared';
import { describe, expect, it } from 'vitest';
import { EqualSplitStrategy } from '../../../../services/splits/EqualSplitStrategy';

describe('EqualSplitStrategy', () => {
    const strategy = new EqualSplitStrategy();

    describe('validateSplits', () => {
        it('should validate equal splits for two participants', () => {
            const participants = ['user1', 'user2'];
            const splits = calculateEqualSplits(100, 'USD', participants);

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).not.toThrow();
        });

        it('should validate equal splits for three participants', () => {
            const participants = ['user1', 'user2', 'user3'];
            const splits = calculateEqualSplits(100, 'USD', participants);

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).not.toThrow();
        });

        it('should validate equal splits for single participant', () => {
            const participants = ['user1'];
            const splits = calculateEqualSplits(100, 'USD', participants);

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).not.toThrow();
        });

        it('should validate equal splits with currency-aware precision (JPY)', () => {
            const participants = ['user1', 'user2', 'user3'];
            const splits = calculateEqualSplits(100, 'JPY', participants);

            expect(() => strategy.validateSplits(100, participants, splits, 'JPY')).not.toThrow();
        });

        it('should reject when splits array is missing', () => {
            const participants = ['user1', 'user2'];

            expect(() => strategy.validateSplits(100, participants, undefined as any, 'USD')).toThrow('Splits must be provided');
        });

        it('should reject when splits length does not match participants', () => {
            const participants = ['user1', 'user2', 'user3'];
            const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2']);

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).toThrow('Splits must be provided');
        });

        it('should reject when split amount is missing', () => {
            const participants = ['user1', 'user2'];
            const splits = [{ uid: 'user1', amount: 50 }, { uid: 'user2', amount: undefined as any }];

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).toThrow('Split amount is required');
        });

        it('should reject when splits do not sum to total', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 40 },
                { uid: 'user2', amount: 40 },
            ];

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).toThrow('Split amounts must equal total amount');
        });

        it('should reject when there are duplicate users', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user1', amount: 50 },
            ];

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).toThrow('Each participant can only appear once');
        });

        it('should reject when split user is not a participant', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user3', amount: 50 },
            ];

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).toThrow('Split user must be a participant');
        });

        it('should reject unequal splits for equal split type', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 70 },
                { uid: 'user2', amount: 30 },
            ];

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).toThrow('all participants should have equal amounts');
        });

        it('should allow remainder distribution (one person gets slightly more)', () => {
            const participants = ['user1', 'user2', 'user3'];
            // 100 / 3 = 33.33, 33.33, 33.34 (last person gets remainder)
            const splits = [
                { uid: 'user1', amount: 33.33 },
                { uid: 'user2', amount: 33.33 },
                { uid: 'user3', amount: 33.34 },
            ];

            expect(() => strategy.validateSplits(100, participants, splits, 'USD')).not.toThrow();
        });
    });
});
