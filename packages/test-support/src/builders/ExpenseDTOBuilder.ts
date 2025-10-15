import type { ExpenseDTO } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, randomCategory, randomChoice, randomDate, randomString, randomValidCurrencyAmountPair, timestampToISOString } from '../test-helpers';
import {Amount} from "@splitifyd/shared";

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

    withAmount(amount: Amount | number): this {
        const normalizedAmount = typeof amount === 'number' ? amount.toString() : amount;
        this.expense.amount = normalizedAmount;

        // Keep default split amounts in sync when builder still owns the split definition
        if (this.expense.splits.length === 1) {
            const [existingSplit] = this.expense.splits;
            this.expense.splits = [{
                ...existingSplit,
                amount: normalizedAmount,
            }];
        }
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
        if (participants.length === this.expense.splits.length) {
            this.expense.splits = participants.map((uid, index) => ({
                uid,
                amount: this.expense.splits[index]?.amount ?? this.expense.amount,
                ...(this.expense.splits[index]?.percentage !== undefined
                    ? { percentage: this.expense.splits[index]?.percentage }
                    : {}),
            }));
        } else {
            this.expense.splits = participants.map((uid) => ({
                uid,
                amount: this.expense.amount,
            }));
        }
        return this;
    }

    withSplits(splits: Array<{ uid: string; amount: Amount; percentage?: number; }>): this {
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

    withIsLocked(isLocked: boolean): this {
        this.expense.isLocked = isLocked;
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
