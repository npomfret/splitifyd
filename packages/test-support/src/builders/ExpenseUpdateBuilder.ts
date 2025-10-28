import type { UpdateExpenseRequest, UserId } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import type { CurrencyISOCode } from '@splitifyd/shared';
import {convertToISOString, randomCategory, randomChoice, randomDate, randomString, randomValidCurrencyAmountPair} from '../test-helpers';
import type {ISOString} from "@splitifyd/shared";

export class ExpenseUpdateBuilder {
    private update: Partial<UpdateExpenseRequest>;

    constructor(useDefaults: boolean = true) {
        if (useDefaults) {
            const { currency, amount } = randomValidCurrencyAmountPair(5, 500);

            this.update = {
                description: `Updated ${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
                amount,
                currency,
                category: randomCategory(),
                date: convertToISOString(randomDate()),
            };
        } else {
            this.update = {};
        }
    }

    /**
     * Create a minimal builder with no default values
     * Useful for unit tests that want to test specific fields only
     */
    static minimal(): ExpenseUpdateBuilder {
        return new ExpenseUpdateBuilder(false);
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): this {
        this.update.currency = currency;
        this.update.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.update.currency = currency;
        return this;
    }

    withPaidBy(userId: UserId): this {
        this.update.paidBy = userId;
        return this;
    }

    withDescription(description: string): this {
        this.update.description = description;
        return this;
    }

    withCategory(category: string): this {
        this.update.category = category;
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.update.date = convertToISOString(timestamp);
        return this;
    }

    withParticipants(participants: string[]): this {
        this.update.participants = [...participants];
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.update.splitType = splitType;
        return this;
    }

    withSplits(splits: Array<{ uid: string; amount: Amount; percentage?: number; }>): this {
        this.update.splits = [...splits];
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.update.receiptUrl = receiptUrl;
        return this;
    }

    build(): Partial<UpdateExpenseRequest> {
        return {
            ...(this.update.amount !== undefined && { amount: this.update.amount }),
            ...(this.update.currency !== undefined && { currency: this.update.currency }),
            ...(this.update.paidBy !== undefined && { paidBy: this.update.paidBy }),
            ...(this.update.description !== undefined && { description: this.update.description }),
            ...(this.update.category !== undefined && { category: this.update.category }),
            ...(this.update.date !== undefined && { date: this.update.date }),
            ...(this.update.participants !== undefined && { participants: [...this.update.participants] }),
            ...(this.update.splitType !== undefined && { splitType: this.update.splitType }),
            ...(this.update.splits !== undefined && { splits: [...this.update.splits] }),
            ...(this.update.receiptUrl !== undefined && { receiptUrl: this.update.receiptUrl }),
        };
    }
}
