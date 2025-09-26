import { expect, describe, it } from 'vitest';
import { EqualSplitStrategy } from '../../../../services/splits/EqualSplitStrategy';
import { SplitTypes } from '@splitifyd/shared';

describe('EqualSplitStrategy', () => {
    const strategy = new EqualSplitStrategy();

    describe('getSplitType', () => {
        it('should return EQUAL split type', () => {
            expect(strategy.getSplitType()).toBe(SplitTypes.EQUAL);
        });
    });

    describe('requiresSplitsData', () => {
        it('should return false as equal splits do not require splits data', () => {
            expect(strategy.requiresSplitsData()).toBe(false);
        });
    });

    describe('validateSplits', () => {
        it('should not throw error for valid participants', () => {
            const participants = ['user1', 'user2', 'user3'];
            expect(() => strategy.validateSplits(100, participants)).not.toThrow();
        });

        it('should not throw error when splits data is provided (but not required)', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 50 },
                { uid: 'user2', amount: 50 },
            ];
            expect(() => strategy.validateSplits(100, participants, splits)).not.toThrow();
        });

        it('should not throw error for single participant', () => {
            const participants = ['user1'];
            expect(() => strategy.validateSplits(100, participants)).not.toThrow();
        });
    });

    describe('calculateSplits', () => {
        it('should calculate equal splits for two participants', () => {
            const participants = ['user1', 'user2'];
            const result = strategy.calculateSplits(100, participants);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 50 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 50 });
        });

        it('should calculate equal splits for three participants', () => {
            const participants = ['user1', 'user2', 'user3'];
            const result = strategy.calculateSplits(100, participants);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ uid: 'user1', amount: 33.33 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 33.33 });
            expect(result[2]).toEqual({ uid: 'user3', amount: 33.33 });
        });

        it('should handle decimal amounts correctly', () => {
            const participants = ['user1', 'user2'];
            const result = strategy.calculateSplits(10.5, participants);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 5.25 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 5.25 });
        });

        it('should round amounts to 2 decimal places', () => {
            const participants = ['user1', 'user2', 'user3'];
            const result = strategy.calculateSplits(10, participants);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ uid: 'user1', amount: 3.33 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 3.33 });
            expect(result[2]).toEqual({ uid: 'user3', amount: 3.33 });
        });

        it('should handle single participant', () => {
            const participants = ['user1'];
            const result = strategy.calculateSplits(100, participants);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ uid: 'user1', amount: 100 });
        });

        it('should ignore provided splits data', () => {
            const participants = ['user1', 'user2'];
            const splits = [
                { uid: 'user1', amount: 70 },
                { uid: 'user2', amount: 30 },
            ];
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ uid: 'user1', amount: 50 });
            expect(result[1]).toEqual({ uid: 'user2', amount: 50 });
        });
    });
});
