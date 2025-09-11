import { SplitTypes } from '@splitifyd/shared';
import { ISplitStrategy } from './ISplitStrategy';
import { EqualSplitStrategy } from './EqualSplitStrategy';
import { ExactSplitStrategy } from './ExactSplitStrategy';
import { PercentageSplitStrategy } from './PercentageSplitStrategy';

export class SplitStrategyFactory {
    private static instance: SplitStrategyFactory;

    private strategies: Map<string, ISplitStrategy>;

    private constructor() {
        this.strategies = new Map([
            [SplitTypes.EQUAL, new EqualSplitStrategy()],
            [SplitTypes.EXACT, new ExactSplitStrategy()],
            [SplitTypes.PERCENTAGE, new PercentageSplitStrategy()],
        ]);
    }

    public static getInstance(): SplitStrategyFactory {
        if (!SplitStrategyFactory.instance) {
            SplitStrategyFactory.instance = new SplitStrategyFactory();
        }
        return SplitStrategyFactory.instance;
    }

    public getStrategy(splitType: string): ISplitStrategy {
        const strategy = this.strategies.get(splitType);
        if (!strategy) {
            throw new Error(`Unsupported split type: ${splitType}. Supported types: ${Array.from(this.strategies.keys()).join(', ')}`);
        }
        return strategy;
    }

    public getSupportedSplitTypes(): string[] {
        return Array.from(this.strategies.keys());
    }
}
