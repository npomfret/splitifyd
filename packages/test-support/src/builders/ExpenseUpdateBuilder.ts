import type { UpdateExpenseRequest, UserId } from '@billsplit-wl/shared';
import { Amount, toCurrencyISOCode } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { convertToISOString, randomChoice, randomDate, randomLabel, randomString, randomValidCurrencyAmountPair } from '../test-helpers';
import {ExpenseSplit} from "@billsplit-wl/shared";
import {toUserId} from "@billsplit-wl/shared";

export class ExpenseUpdateBuilder {
    private update: Partial<UpdateExpenseRequest>;

    constructor(useDefaults: boolean = true) {
        if (useDefaults) {
            const { currency, amount } = randomValidCurrencyAmountPair(5, 500);

            this.update = {
                description: `Updated ${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
                amount,
                currency,
                label: randomLabel(),
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

    withAmount(amount: Amount | number, currency: CurrencyISOCode | string): this {
        this.update.currency = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;
        this.update.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.update.currency = currency;
        return this;
    }

    withPaidBy(userId: UserId | string): this {
        this.update.paidBy = typeof userId === 'string' ? toUserId(userId) : userId;;
        return this;
    }

    withDescription(description: string): this {
        this.update.description = description;
        return this;
    }

    withLabel(label: string): this {
        this.update.label = label;
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.update.date = convertToISOString(timestamp);
        return this;
    }

    withParticipants(participants: UserId[] | string[]): this {
        this.update.participants = participants.map(item => typeof item === 'string' ? toUserId(item) : item)
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.update.splitType = splitType;
        return this;
    }

    withSplits(splits: ExpenseSplit[]): this {
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
            ...(this.update.label !== undefined && { label: this.update.label }),
            ...(this.update.date !== undefined && { date: this.update.date }),
            ...(this.update.participants !== undefined && { participants: [...this.update.participants] }),
            ...(this.update.splitType !== undefined && { splitType: this.update.splitType }),
            ...(this.update.splits !== undefined && { splits: [...this.update.splits] }),
            ...(this.update.receiptUrl !== undefined && { receiptUrl: this.update.receiptUrl }),
        };
    }
}
