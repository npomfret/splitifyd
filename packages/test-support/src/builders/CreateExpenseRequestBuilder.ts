import { calculateEqualSplits, calculateExactSplits, calculatePercentageSplits, CreateExpenseRequest } from '@splitifyd/shared';
import { generateShortId, randomCategory, randomChoice, randomDate, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

export class CreateExpenseRequestBuilder {
    private expense: CreateExpenseRequest;

    constructor() {
        const userId = `user-${generateShortId()}`;
        const { currency, amount } = randomValidCurrencyAmountPair(5, 500);

        this.expense = {
            groupId: `group-${generateShortId()}`,
            description: `${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount,
            currency,
            paidBy: userId,
            splitType: randomChoice(['equal', 'exact', 'percentage']),
            participants: [userId],
            date: randomDate(),
            category: randomCategory(),
        };
    }

    withGroupId(groupId: string): this {
        this.expense.groupId = groupId;
        return this;
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: number): this {
        this.expense.amount = amount;
        return this;
    }

    withPaidBy(userId: string): this {
        this.expense.paidBy = userId;
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.expense.splitType = splitType;
        return this;
    }

    withParticipants(participants: string[]): this {
        this.expense.participants = [...participants];
        return this;
    }

    withSplits(splits: Array<{ uid: string; amount: number; percentage?: number; }>): this {
        this.expense.splits = [...splits];
        return this;
    }

    withDate(date: string): this {
        this.expense.date = date;
        return this;
    }

    withCategory(category: string): this {
        this.expense.category = category;
        return this;
    }

    withCurrency(currency: string): this {
        this.expense.currency = currency;
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    build(): CreateExpenseRequest {
        // Auto-generate splits if not explicitly provided using shared currency-aware utilities
        let splits = this.expense.splits;
        if (!splits && this.expense.participants.length > 0) {
            if (this.expense.splitType === 'equal') {
                splits = calculateEqualSplits(this.expense.amount, this.expense.currency, this.expense.participants);
            } else if (this.expense.splitType === 'exact') {
                splits = calculateExactSplits(this.expense.amount, this.expense.currency, this.expense.participants);
            } else if (this.expense.splitType === 'percentage') {
                splits = calculatePercentageSplits(this.expense.amount, this.expense.currency, this.expense.participants);
            }
        }

        return {
            groupId: this.expense.groupId,
            description: this.expense.description,
            amount: this.expense.amount,
            currency: this.expense.currency,
            paidBy: this.expense.paidBy,
            splitType: this.expense.splitType,
            participants: [...this.expense.participants],
            splits: splits ? [...splits] : undefined,
            date: this.expense.date,
            category: this.expense.category,
            ...(this.expense.receiptUrl && { receiptUrl: this.expense.receiptUrl }),
        };
    }
}
