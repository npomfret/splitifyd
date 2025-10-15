import type { UpdateSettlementRequest } from '@splitifyd/shared';
import { generateShortId, randomDate, randomValidCurrencyAmountPair } from '../test-helpers';
import {Amount} from "@splitifyd/shared";

export class SettlementUpdateBuilder {
    private update: Partial<UpdateSettlementRequest>;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);

        this.update = {
            amount,
            currency,
            date: randomDate(),
            note: `Updated settlement ${generateShortId()}`,
        };
    }

    withAmount(amount: Amount | number): this {
        this.update.amount = typeof amount === "number" ? amount.toString() : amount;
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

    build(): Partial<UpdateSettlementRequest> {
        return {
            ...(this.update.amount !== undefined && { amount: this.update.amount }),
            ...(this.update.currency !== undefined && { currency: this.update.currency }),
            ...(this.update.date !== undefined && { date: this.update.date }),
            ...(this.update.note !== undefined && { note: this.update.note }),
        };
    }
}
