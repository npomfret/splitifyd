import type { ExpenseFormData } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import { randomChoice, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

/**
 * Builder for creating ExpenseFormData objects for UI tests
 * Used in E2E tests for form submission payloads
 */
export class ExpenseFormDataBuilder {
    private expense: ExpenseFormData;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 500);

        this.expense = {
            description: `${randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${randomString(4)}`,
            amount,
            currency,
            paidByDisplayName: '', // No default - must be explicitly set
            splitType: randomChoice(['equal', 'exact', 'percentage']),
            participants: [],
        };
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: Amount | number, currency: string): this {
        this.expense.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: string): this {
        this.expense.currency = currency;
        return this;
    }

    withPaidByDisplayName(displayName: string): this {
        this.expense.paidByDisplayName = displayName;
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

    build(): ExpenseFormData {
        if (!this.expense.paidByDisplayName || this.expense.paidByDisplayName.trim() === '') {
            throw new Error('ExpenseFormDataBuilder.build(): paidByDisplayName is required but was not set. Use .withPaidByDisplayName(displayName) to specify who paid for this expense.');
        }

        if (!this.expense.participants || this.expense.participants.length === 0) {
            throw new Error('ExpenseFormDataBuilder.build(): participants is required but was not set. Use .withParticipants(participantNames) to specify who should split this expense.');
        }

        return {
            description: this.expense.description,
            amount: this.expense.amount,
            currency: this.expense.currency,
            paidByDisplayName: this.expense.paidByDisplayName,
            splitType: this.expense.splitType,
            participants: [...this.expense.participants],
        };
    }
}
