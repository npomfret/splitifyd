import { generateShortId } from '../test-helpers';

export interface ExpenseSplit {
    uid: string;
    amount: number;
    percentage?: number;
}

/**
 * Builder for single ExpenseSplit objects - used in split strategy test assertions
 * Creates individual split objects for testing split calculation results
 */
export class SplitAssertionBuilder {
    private split: ExpenseSplit;

    constructor() {
        this.split = {
            uid: `user-${generateShortId()}`,
            amount: 0,
        };
    }

    /**
     * Set the user ID for this split
     */
    forUser(uid: string): this {
        this.split.uid = uid;
        return this;
    }

    /**
     * Set the amount for this split
     */
    withAmount(amount: number): this {
        this.split.amount = amount;
        return this;
    }

    /**
     * Set the percentage for this split (optional)
     */
    withPercentage(percentage: number): this {
        this.split.percentage = percentage;
        return this;
    }

    /**
     * Remove the percentage field (for splits that don't include percentages)
     */
    withoutPercentage(): this {
        delete this.split.percentage;
        return this;
    }

    /**
     * Static convenience method to create a split with user ID and amount
     */
    static split(uid: string, amount: number, percentage?: number): ExpenseSplit {
        const builder = new SplitAssertionBuilder()
            .forUser(uid)
            .withAmount(amount);

        if (percentage !== undefined) {
            builder.withPercentage(percentage);
        }

        return builder.build();
    }

    /**
     * Static convenience method to create a split with user ID, amount, and percentage
     */
    static splitWithPercentage(uid: string, amount: number, percentage: number): ExpenseSplit {
        return new SplitAssertionBuilder()
            .forUser(uid)
            .withAmount(amount)
            .withPercentage(percentage)
            .build();
    }

    build(): ExpenseSplit {
        return { ...this.split };
    }
}