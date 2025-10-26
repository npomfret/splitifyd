import { calculateEqualSplits, calculateExactSplits, calculatePercentageSplits, CreateExpenseRequest } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import type { CurrencyISOCode, UserId } from '@splitifyd/shared';
import { generateShortId, randomCategory, randomChoice, randomDate, randomString, randomValidCurrencyAmountPair } from '../test-helpers';
import {toGroupId} from "@splitifyd/shared";

export class CreateExpenseRequestBuilder {
    private expense: CreateExpenseRequest;
    private splitsExplicitlySet = false;

    constructor() {
        const userId = `user-${generateShortId()}`;
        const { currency, amount } = randomValidCurrencyAmountPair(5, 500);
        const splitType = randomChoice(['equal', 'exact', 'percentage'] as const) as 'equal' | 'exact' | 'percentage';
        const participants = [userId];

        // Calculate initial splits using currency-aware logic
        let splits;
        if (splitType === 'equal') {
            splits = calculateEqualSplits(amount, currency, participants);
        } else if (splitType === 'exact') {
            splits = calculateExactSplits(amount, currency, participants);
        } else {
            splits = calculatePercentageSplits(amount, currency, participants);
        }

        this.expense = {
            groupId: toGroupId(`group-${generateShortId()}`),
            description: `${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount,
            currency,
            paidBy: userId,
            splitType,
            participants,
            splits,
            date: randomDate(),
            category: randomCategory(),
        };
    }

    withGroupId(groupId: GroupId | string): this {
        this.expense.groupId = typeof groupId === "string" ? toGroupId(groupId) : groupId;
        return this;
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): this {
        this.expense.currency = currency;
        this.expense.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withPaidBy(userId: UserId): this {
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

    withSplits(splits: Array<{ uid: string; amount: Amount; percentage?: number; }>): this {
        this.expense.splits = [...splits];
        this.splitsExplicitlySet = true;
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

    withCurrency(currency: CurrencyISOCode): this {
        this.expense.currency = currency;
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    build(): CreateExpenseRequest {
        // Only recalculate splits if they weren't explicitly set via withSplits()
        // This allows tests to provide invalid splits for validation testing
        let splits = this.expense.splits;
        if (!this.splitsExplicitlySet) {
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
            splits: [...splits],
            date: this.expense.date,
            category: this.expense.category,
            ...(this.expense.receiptUrl && { receiptUrl: this.expense.receiptUrl }),
        };
    }
}
