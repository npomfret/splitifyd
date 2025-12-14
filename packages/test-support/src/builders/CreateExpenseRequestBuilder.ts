import { calculateEqualSplits, calculateExactSplits, calculatePercentageSplits, CreateExpenseRequest } from '@billsplit-wl/shared';
import { Amount } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import type { CurrencyISOCode, ExpenseLabel, ExpenseLocation, UserId } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { toCurrencyISOCode, toExpenseLabel } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { ExpenseSplit } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomChoice, randomDate, randomLabels, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

export class CreateExpenseRequestBuilder {
    private expense: CreateExpenseRequest;
    private splitsExplicitlySet = false;

    constructor() {
        const userId = toUserId(`user-${generateShortId()}`);
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
            date: convertToISOString(randomDate()),
            labels: randomLabels(),
        };
    }

    withGroupId(groupId: GroupId | string): this {
        this.expense.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode | string): this {
        this.expense.currency = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;
        this.expense.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withPaidBy(userId: UserId | string): this {
        this.expense.paidBy = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.expense.splitType = splitType;
        return this;
    }

    withParticipants(participants: UserId[] | string[]): this {
        this.expense.participants = participants.map(item => typeof item === 'string' ? toUserId(item) : item);
        return this;
    }

    withSplits(splits: ExpenseSplit[]): this {
        this.expense.splits = [...splits];
        this.splitsExplicitlySet = true;
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.expense.date = convertToISOString(timestamp);
        return this;
    }

    withLabels(labels: ExpenseLabel[] | string[]): this {
        this.expense.labels = labels.map(l => typeof l === 'string' ? toExpenseLabel(l) : l);
        return this;
    }

    withLabel(label: string): this {
        this.expense.labels = [toExpenseLabel(label)];
        return this;
    }

    withCurrency(currency: CurrencyISOCode | string): this {
        this.expense.currency = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;
        return this;
    }

    withReceiptUrl(receiptUrl: string): this {
        this.expense.receiptUrl = receiptUrl;
        return this;
    }

    withLocation(location: ExpenseLocation): this {
        this.expense.location = location;
        return this;
    }

    withLocationName(name: string): this {
        this.expense.location = { name };
        return this;
    }

    withLocationNameAndUrl(name: string, url: string): this {
        this.expense.location = { name, url };
        return this;
    }

    withInvalidGroupId(value: string = ''): this {
        (this.expense as any).groupId = value;
        return this;
    }

    withInvalidPaidBy(value: string = ''): this {
        (this.expense as any).paidBy = value;
        return this;
    }

    withInvalidAmount(value: number): this {
        (this.expense as any).amount = value;
        return this;
    }

    withInvalidDescription(value: string = ''): this {
        (this.expense as any).description = value;
        return this;
    }

    withInvalidLabels(value: unknown): this {
        (this.expense as any).labels = value;
        return this;
    }

    withInvalidSplitType(value: string): this {
        (this.expense as any).splitType = value;
        this.splitsExplicitlySet = true;
        return this;
    }

    withInvalidParticipants(value: string[] = []): this {
        (this.expense as any).participants = value;
        this.splitsExplicitlySet = true;
        return this;
    }

    /** For testing split total validation - modifies split amounts to mismatch expense total */
    withMismatchedSplitTotal(splitAmounts: string[]): this {
        if (splitAmounts.length !== this.expense.splits.length) {
            throw new Error('Must provide same number of split amounts as participants');
        }
        this.expense.splits = this.expense.splits.map((split, i) => ({
            ...split,
            amount: splitAmounts[i],
        }));
        this.splitsExplicitlySet = true;
        return this;
    }

    /** For testing currency precision validation - sets amount and split amounts with invalid precision */
    withInvalidCurrencyPrecision(amount: string, splitAmounts: string[]): this {
        (this.expense as any).amount = amount;
        this.expense.splits = this.expense.splits.map((split, i) => ({
            ...split,
            amount: splitAmounts[i] || amount,
        }));
        this.splitsExplicitlySet = true;
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
            labels: this.expense.labels,
            ...(this.expense.receiptUrl && { receiptUrl: this.expense.receiptUrl }),
            ...(this.expense.location && { location: this.expense.location }),
        };
    }
}
