import type { ExpenseSplit } from '@splitifyd/shared';
import { Amount, ZERO } from '@splitifyd/shared';
import { generateShortId } from '../test-helpers';

/**
 * Builder for single ExpenseSplit objects - used in split strategy test assertions
 * Creates individual split objects for testing split calculation results
 */
export class SplitAssertionBuilder {
    private split: ExpenseSplit;

    constructor() {
        this.split = {
            uid: `user-${generateShortId()}`,
            amount: ZERO,
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
    withAmount(amount: Amount | number): this {
        this.split.amount = typeof amount === 'number' ? amount.toString() : amount;
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
     * Static convenience method to create a split with user ID and amount
     */
    static split(uid: string, amount: Amount, percentage?: number): ExpenseSplit {
        const builder = new SplitAssertionBuilder()
            .forUser(uid)
            .withAmount(amount);
        if (percentage !== undefined) {
            builder
                .withPercentage(percentage);
        }

        return builder.build();
    }

    build(): ExpenseSplit {
        return { ...this.split };
    }
}
