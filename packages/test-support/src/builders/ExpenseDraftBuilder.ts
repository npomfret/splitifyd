import type { ExpenseDraft, ExpenseLabel, UserId } from '@billsplit-wl/shared';
import { SplitTypes, toExpenseLabel } from '@billsplit-wl/shared';
import { Amount } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { generateShortId, randomChoice, randomLabels, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

export class ExpenseDraftBuilder {
    private draft: ExpenseDraft;

    constructor() {
        const userId = toUserId(`user-${generateShortId()}`);
        const now = Date.now();
        const { currency, amount } = randomValidCurrencyAmountPair(5, 100);

        this.draft = {
            description: `${randomChoice(['Lunch', 'Coffee', 'Dinner', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount,
            currency,
            date: new Date(now).toISOString().split('T')[0], // YYYY-MM-DD format
            time: new Date(now).toTimeString().slice(0, 5), // HH:MM format
            paidBy: userId,
            labels: randomLabels(),
            splitType: randomChoice([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
            participants: [userId],
            splits: [{ userId, amount }],
            timestamp: now - Math.random() * 60 * 60 * 1000, // Random time in last hour
        };
    }

    withDescription(description: string): this {
        this.draft.description = description;
        return this;
    }

    withAmount(amount: Amount | number): this {
        this.draft.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.draft.currency = currency;
        return this;
    }

    withDate(date: string): this {
        this.draft.date = date;
        return this;
    }

    withTime(time: string): this {
        this.draft.time = time;
        return this;
    }

    withPaidBy(userId: UserId | string): this {
        this.draft.paidBy = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withLabels(labels: ExpenseLabel[] | string[]): this {
        this.draft.labels = labels.map(l => typeof l === 'string' ? toExpenseLabel(l) : l);
        return this;
    }

    withLabel(label: string): this {
        this.draft.labels = [toExpenseLabel(label)];
        return this;
    }

    withSplitType(splitType: string): this {
        this.draft.splitType = splitType;
        return this;
    }

    withParticipants(participants: UserId[]): this {
        this.draft.participants = [...participants];
        return this;
    }

    withSplits(splits: Array<{ userId: UserId; amount: Amount; percentage?: number; }>): this {
        this.draft.splits = [...splits];
        return this;
    }

    withTimestamp(timestamp: number): this {
        this.draft.timestamp = timestamp;
        return this;
    }

    build(): ExpenseDraft {
        return {
            description: this.draft.description,
            amount: this.draft.amount,
            currency: this.draft.currency,
            date: this.draft.date,
            time: this.draft.time,
            paidBy: this.draft.paidBy,
            labels: this.draft.labels,
            splitType: this.draft.splitType,
            participants: [...this.draft.participants],
            splits: [...this.draft.splits],
            timestamp: this.draft.timestamp,
        };
    }
}
