import type { ExpenseDTO } from '@splitifyd/shared';
import { BuilderTimestamp, timestampToISOString, generateShortId, randomString, randomChoice, randomDate, randomCategory, randomValidCurrencyAmountPair } from '../test-helpers';

/**
 * Builder for creating ExpenseDTO objects for tests
 * Creates complete expense documents with ID and audit metadata
 */
export class ExpenseDTOBuilder {
    private expense: ExpenseDTO;

    constructor() {
        const userId = `user-${generateShortId()}`;
        const { currency, amount } = randomValidCurrencyAmountPair(5, 500);

        this.expense = {
            // Audit fields (BaseDTO)
            id: `expense-${generateShortId()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),

            // Business fields
            groupId: `group-${generateShortId()}`,
            description: `${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount,
            currency,
            paidBy: userId,
            createdBy: userId,
            splitType: randomChoice(['equal', 'exact', 'percentage'] as const),
            participants: [userId],
            splits: [{ uid: userId, amount }],
            date: randomDate(),
            category: randomCategory(),
            deletedAt: null,
            deletedBy: null,
        };
    }

    // Audit field methods
    withId(id: string): this {
        this.expense.id = id;
        return this;
    }

    withCreatedAt(timestamp: BuilderTimestamp): this {
        this.expense.createdAt = timestampToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: BuilderTimestamp): this {
        this.expense.updatedAt = timestampToISOString(timestamp);
        return this;
    }

    withDeletedAt(timestamp: BuilderTimestamp | null): this {
        this.expense.deletedAt = timestamp ? timestampToISOString(timestamp) : null;
        return this;
    }

    withDeletedBy(userId: string | null): this {
        this.expense.deletedBy = userId;
        return this;
    }

    // Business field methods
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

    withCurrency(currency: string): this {
        this.expense.currency = currency;
        return this;
    }

    withPaidBy(userId: string): this {
        this.expense.paidBy = userId;
        return this;
    }

    withCreatedBy(userId: string): this {
        this.expense.createdBy = userId;
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

    withSplits(splits: Array<{ uid: string; amount: number; percentage?: number }>): this {
        this.expense.splits = [...splits];
        return this;
    }

    withDate(date: string | BuilderTimestamp): this {
        this.expense.date = typeof date === 'string' ? date : timestampToISOString(date);
        return this;
    }

    withCategory(category: string): this {
        this.expense.category = category;
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    build(): ExpenseDTO {
        return {
            ...this.expense,
            participants: [...this.expense.participants],
            splits: [...this.expense.splits],
        };
    }
}
