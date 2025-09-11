import { expect, describe, it } from 'vitest';
import { SplitStrategyFactory } from '../../../../services/splits/SplitStrategyFactory';
import { EqualSplitStrategy } from '../../../../services/splits/EqualSplitStrategy';
import { ExactSplitStrategy } from '../../../../services/splits/ExactSplitStrategy';
import { PercentageSplitStrategy } from '../../../../services/splits/PercentageSplitStrategy';
import { SplitTypes } from '@splitifyd/shared';

describe('SplitStrategyFactory', () => {
    describe('getInstance', () => {
        it('should return a singleton instance', () => {
            const instance1 = SplitStrategyFactory.getInstance();
            const instance2 = SplitStrategyFactory.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(SplitStrategyFactory);
        });
    });

    describe('getStrategy', () => {
        const factory = SplitStrategyFactory.getInstance();

        it('should return EqualSplitStrategy for EQUAL split type', () => {
            const strategy = factory.getStrategy(SplitTypes.EQUAL);
            expect(strategy).toBeInstanceOf(EqualSplitStrategy);
            expect(strategy.getSplitType()).toBe(SplitTypes.EQUAL);
        });

        it('should return ExactSplitStrategy for EXACT split type', () => {
            const strategy = factory.getStrategy(SplitTypes.EXACT);
            expect(strategy).toBeInstanceOf(ExactSplitStrategy);
            expect(strategy.getSplitType()).toBe(SplitTypes.EXACT);
        });

        it('should return PercentageSplitStrategy for PERCENTAGE split type', () => {
            const strategy = factory.getStrategy(SplitTypes.PERCENTAGE);
            expect(strategy).toBeInstanceOf(PercentageSplitStrategy);
            expect(strategy.getSplitType()).toBe(SplitTypes.PERCENTAGE);
        });

        it('should throw error for unsupported split type', () => {
            expect(() => factory.getStrategy('INVALID_TYPE')).toThrow('Unsupported split type: INVALID_TYPE. Supported types: equal, exact, percentage');
        });

        it('should return same instance for repeated calls', () => {
            const strategy1 = factory.getStrategy(SplitTypes.EQUAL);
            const strategy2 = factory.getStrategy(SplitTypes.EQUAL);

            expect(strategy1).toBe(strategy2);
        });
    });

    describe('getSupportedSplitTypes', () => {
        const factory = SplitStrategyFactory.getInstance();

        it('should return all supported split types', () => {
            const supportedTypes = factory.getSupportedSplitTypes();

            expect(supportedTypes).toHaveLength(3);
            expect(supportedTypes).toContain(SplitTypes.EQUAL);
            expect(supportedTypes).toContain(SplitTypes.EXACT);
            expect(supportedTypes).toContain(SplitTypes.PERCENTAGE);
        });
    });
});
