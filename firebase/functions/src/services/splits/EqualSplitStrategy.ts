import { ExpenseSplit, SplitTypes } from '@splitifyd/shared';
import { ISplitStrategy } from './ISplitStrategy';

export class EqualSplitStrategy implements ISplitStrategy {
    getSplitType(): string {
        return SplitTypes.EQUAL;
    }

    requiresSplitsData(): boolean {
        return false;
    }

    validateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[]): void {
        // Equal splits don't require explicit splits data
        // The only validation needed is that participants array is valid (done elsewhere)
        // No conditional logic needed here - equal splits are always valid if participants exist
    }

    calculateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[]): ExpenseSplit[] {
        const splitAmount = totalAmount / participants.length;

        return participants.map((userId) => ({
            uid: userId,
            amount: Math.round(splitAmount * 100) / 100,
        }));
    }
}
