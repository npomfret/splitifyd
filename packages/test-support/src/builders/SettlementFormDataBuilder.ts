import { randomString, randomDecimal, randomChoice, randomCurrency } from '../test-helpers';

export interface SettlementFormData {
    payerName: string; // Display name of who paid
    payeeName: string; // Display name of who received payment
    amount: string;
    currency: string; // Currency for the settlement
    note: string;
}

/**
 * Builder for creating SettlementFormData objects for UI tests
 * Used in E2E tests for settlement form submission payloads
 */
export class SettlementFormDataBuilder {
    private settlement: SettlementFormData;

    constructor() {
        this.settlement = {
            payerName: '', // No default - must be explicitly set
            payeeName: '', // No default - must be explicitly set
            amount: randomDecimal(5, 200).toString(),
            currency: randomCurrency(),
            note: `${randomChoice(['Payment', 'Settlement', 'Reimbursement', 'Cash back'])} ${randomString(4)}`,
        };
    }

    withPayerName(payerName: string): this {
        this.settlement.payerName = payerName;
        return this;
    }

    withPayeeName(payeeName: string): this {
        this.settlement.payeeName = payeeName;
        return this;
    }

    withAmount(amount: string | number): this {
        this.settlement.amount = amount.toString();
        return this;
    }

    withCurrency(currency: string): this {
        this.settlement.currency = currency;
        return this;
    }

    withNote(note: string): this {
        this.settlement.note = note;
        return this;
    }

    build(): SettlementFormData {
        if (!this.settlement.payerName || this.settlement.payerName.trim() === '') {
            throw new Error('SettlementFormDataBuilder.build(): payerName is required but was not set. Use .withPayerName(displayName) to specify who made the payment.');
        }

        if (!this.settlement.payeeName || this.settlement.payeeName.trim() === '') {
            throw new Error('SettlementFormDataBuilder.build(): payeeName is required but was not set. Use .withPayeeName(displayName) to specify who received the payment.');
        }

        return {
            payerName: this.settlement.payerName,
            payeeName: this.settlement.payeeName,
            amount: this.settlement.amount,
            currency: this.settlement.currency,
            note: this.settlement.note,
        };
    }
}
