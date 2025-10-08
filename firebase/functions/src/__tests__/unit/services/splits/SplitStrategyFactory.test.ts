import { SplitTypes } from '@splitifyd/shared';
import { describe, expect, it } from 'vitest';
import { EqualSplitStrategy } from '../../../../services/splits/EqualSplitStrategy';
import { ExactSplitStrategy } from '../../../../services/splits/ExactSplitStrategy';
import { PercentageSplitStrategy } from '../../../../services/splits/PercentageSplitStrategy';
import { SplitStrategyFactory } from '../../../../services/splits/SplitStrategyFactory';

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
        });

        it('should return ExactSplitStrategy for EXACT split type', () => {
            const strategy = factory.getStrategy(SplitTypes.EXACT);
            expect(strategy).toBeInstanceOf(ExactSplitStrategy);
        });

        it('should return PercentageSplitStrategy for PERCENTAGE split type', () => {
            const strategy = factory.getStrategy(SplitTypes.PERCENTAGE);
            expect(strategy).toBeInstanceOf(PercentageSplitStrategy);
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
});
