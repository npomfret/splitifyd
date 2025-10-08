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
     * Create an equal split for the given participants and total amount
     */
    static equalSplit(participants: string[], totalAmount: number): ExpenseSplitBuilder {
        const builder = new ExpenseSplitBuilder();
        const splitAmount = totalAmount / participants.length;

        for (const uid of participants) {
            builder.splits.push({ uid, amount: splitAmount });
        }

        return builder;
    }

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
     * Replace a split by uid
     */
    withUpdatedSplit(uid: string, amount: number, percentage?: number): this {
        const index = this.splits.findIndex((split) => split.uid === uid);
        if (index >= 0) {
            this.splits[index] = { uid, amount, percentage };
        } else {
            this.splits.push({ uid, amount, percentage });
        }
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
     * Create splits that don't sum to the expected total (for testing validation)
     */
    withMismatchedTotal(participants: string[], totalAmount: number, mismatch: number): this {
        const adjustedAmount = totalAmount + mismatch;
        const splitAmount = adjustedAmount / participants.length;

        for (const uid of participants) {
            this.splits.push({ uid, amount: splitAmount });
        }

        return this;
    }

    /**
     * Add duplicate splits (for testing validation)
     */
    withDuplicateSplit(uid: string, amount1: number, amount2: number): this {
        this.splits.push({ uid, amount: amount1 });
        this.splits.push({ uid, amount: amount2 });
        return this;
    }

    /**
     * Create splits with rounding issues (for testing tolerance)
     */
    withRoundingIssues(participants: string[], totalAmount: number): this {
        const baseAmount = Math.floor((totalAmount / participants.length) * 100) / 100;
        const remainder = totalAmount - baseAmount * (participants.length - 1);

        for (let i = 0; i < participants.length; i++) {
            const amount = i === participants.length - 1 ? remainder : baseAmount;
            this.splits.push({ uid: participants[i], amount });
        }

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
