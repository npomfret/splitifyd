import { randomDate, generateShortId, randomValidCurrencyAmountPair } from '../test-helpers';

interface SettlementUpdate {
    amount?: number;
    currency?: string;
    date?: string;
    note?: string;
}

export class SettlementUpdateBuilder {
    private update: SettlementUpdate;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);

        this.update = {
            amount,
            currency,
            date: randomDate(),
            note: `Updated settlement ${generateShortId()}`,
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

    withDate(date: string): this {
        this.update.date = date;
        return this;
    }

    withNote(note: string): this {
        this.update.note = note;
        return this;
    }

    build(): SettlementUpdate {
        return {
            ...(this.update.amount !== undefined && { amount: this.update.amount }),
            ...(this.update.currency !== undefined && { currency: this.update.currency }),
            ...(this.update.date !== undefined && { date: this.update.date }),
            ...(this.update.note !== undefined && { note: this.update.note }),
        };
    }
}
