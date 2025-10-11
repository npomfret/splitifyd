export interface ExpenseSplit {
    uid: string;
    amount: number;
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
    static exactSplit(userAmounts: Array<{ uid: string; amount: number; percentage?: number; }>): ExpenseSplitBuilder {
        const builder = new ExpenseSplitBuilder();
        builder.splits = [...userAmounts];
        return builder;
    }

    /**
     * Create a percentage split for the given participants with specified percentages
     */
    static percentageSplit(totalAmount: number, userPercentages: Array<{ uid: string; percentage: number; }>): ExpenseSplitBuilder {
        const builder = new ExpenseSplitBuilder();

        for (const { uid, percentage } of userPercentages) {
            const amount = (totalAmount * percentage) / 100;
            builder.splits.push({ uid, amount, percentage });
        }

        return builder;
    }

    /**
     * Add a single split entry
     */
    withSplit(uid: string, amount: number, percentage?: number): this {
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
