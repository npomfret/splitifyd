import { Amount, amountToSmallestUnit, roundToCurrencyPrecision, smallestUnitToAmountString } from '@splitifyd/shared';

/**
 * Internal interface for expense splits - used only by ExpenseSplitBuilder
 * For application usage, import ExpenseSplit from @splitifyd/shared
 */
interface ExpenseSplit {
    uid: string;
    amount: Amount;
    percentage?: number;
}

/**
 * Builder for ExpenseSplit arrays - used in split strategy tests
 * Creates arrays of split objects for testing split calculation and validation
 */
export class ExpenseSplitBuilder {
    private splits: ExpenseSplit[] = [];

    constructor() {}

    /**
     * Create an exact split for the given participants with specified amounts
     */
    static exactSplit(userAmounts: Array<{ uid: string; amount: Amount; percentage?: number; }>): ExpenseSplitBuilder {
        const builder = new ExpenseSplitBuilder();
        builder.splits = [...userAmounts];
        return builder;
    }

    /**
     * Create a percentage split for the given participants with specified percentages
     */
    static percentageSplit(
        totalAmount: Amount | number,
        userPercentages: Array<{ uid: string; percentage: number; }>,
        currency: string = 'USD',
    ): ExpenseSplitBuilder {
        const builder = new ExpenseSplitBuilder();
        const normalizedTotal = roundToCurrencyPrecision(totalAmount, currency);
        const totalUnits = amountToSmallestUnit(normalizedTotal, currency);
        let allocatedUnits = 0;

        userPercentages.forEach(({ uid, percentage }, index) => {
            const isLast = index === userPercentages.length - 1;
            let amountUnits: number;

            if (isLast) {
                amountUnits = totalUnits - allocatedUnits;
            } else {
                amountUnits = Math.floor((totalUnits * percentage) / 100);
            }

            const amount = smallestUnitToAmountString(amountUnits, currency);
            builder.splits.push({ uid, amount, percentage });
            allocatedUnits += amountUnits;
        });

        if (allocatedUnits !== totalUnits) {
            throw new Error('Percentage splits did not allocate the total amount correctly');
        }

        return builder;
    }

    /**
     * Add a single split entry
     */
    withSplit(uid: string, amount: Amount, percentage?: number): this {
        this.splits.push({ uid, amount, percentage });
        return this;
    }

    /**
     * Add multiple splits
     */
    withSplits(splits: ExpenseSplit[]): this {
        this.splits.push(...splits);
        return this;
    }

    /**
     * Create splits with invalid amounts (for testing validation)
     */
    withInvalidAmountSplit(uid: string, amount: any): this {
        this.splits.push({ uid, amount } as ExpenseSplit);
        return this;
    }

    /**
     * Clear all splits
     */
    clear(): this {
        this.splits = [];
        return this;
    }

    build(): ExpenseSplit[] {
        return [...this.splits];
    }
}
