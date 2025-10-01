import { randomString, randomDecimal, randomChoice, randomDate, randomCurrency, randomCategory } from '../test-helpers';

export interface ExpenseUpdate {
    amount?: number;
    currency?: string;
    description?: string;
    category?: string;
    date?: string;
    participants?: string[];
    splitType?: 'equal' | 'exact' | 'percentage';
    splits?: Array<{
        uid: string;
        amount: number;
        percentage?: number;
    }>;
    receiptUrl?: string;
}

export class ExpenseUpdateBuilder {
    private update: ExpenseUpdate;

    constructor() {
        this.update = {
            description: `Updated ${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount: randomDecimal(5, 500),
            currency: randomCurrency(),
            category: randomCategory(),
            date: randomDate(),
        };
    }

    withAmount(amount: number): this {
        this.update.amount = amount;
        return this;
    }

    withCurrency(currency: string): this {
        this.update.currency = currency;
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

    withDate(date: string): this {
        this.update.date = date;
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

    withSplits(splits: Array<{ uid: string; amount: number; percentage?: number }>): this {
        this.update.splits = [...splits];
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.update.receiptUrl = receiptUrl;
        return this;
    }

    build(): ExpenseUpdate {
        return {
            ...(this.update.amount !== undefined && { amount: this.update.amount }),
            ...(this.update.currency !== undefined && { currency: this.update.currency }),
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
