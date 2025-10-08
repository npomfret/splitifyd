import { ExpenseSplitBuilder, SplitAssertionBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { EqualSplitStrategy } from '../../../../services/splits/EqualSplitStrategy';

describe('EqualSplitStrategy', () => {
    const strategy = new EqualSplitStrategy();

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
            const splits = ExpenseSplitBuilder
                .equalSplit(['user1', 'user2'], 100)
                .build();
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
            expect(result[0]).toEqual(SplitAssertionBuilder.split('user1', 50));
            expect(result[1]).toEqual(SplitAssertionBuilder.split('user2', 50));
        });

        it('should calculate equal splits for three participants', () => {
            const participants = ['user1', 'user2', 'user3'];
            const result = strategy.calculateSplits(100, participants);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual(SplitAssertionBuilder.split('user1', 33.33));
            expect(result[1]).toEqual(SplitAssertionBuilder.split('user2', 33.33));
            expect(result[2]).toEqual(SplitAssertionBuilder.split('user3', 33.33));
        });

        it('should handle decimal amounts correctly', () => {
            const participants = ['user1', 'user2'];
            const result = strategy.calculateSplits(10.5, participants);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(SplitAssertionBuilder.split('user1', 5.25));
            expect(result[1]).toEqual(SplitAssertionBuilder.split('user2', 5.25));
        });

        it('should round amounts to 2 decimal places', () => {
            const participants = ['user1', 'user2', 'user3'];
            const result = strategy.calculateSplits(10, participants);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual(SplitAssertionBuilder.split('user1', 3.33));
            expect(result[1]).toEqual(SplitAssertionBuilder.split('user2', 3.33));
            expect(result[2]).toEqual(SplitAssertionBuilder.split('user3', 3.33));
        });

        it('should handle single participant', () => {
            const participants = ['user1'];
            const result = strategy.calculateSplits(100, participants);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(SplitAssertionBuilder.split('user1', 100));
        });

        it('should ignore provided splits data', () => {
            const participants = ['user1', 'user2'];
            const splits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: 'user1', amount: 70 },
                    { uid: 'user2', amount: 30 },
                ])
                .build();
            const result = strategy.calculateSplits(100, participants, splits);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(SplitAssertionBuilder.split('user1', 50));
            expect(result[1]).toEqual(SplitAssertionBuilder.split('user2', 50));
        });
    });
});
