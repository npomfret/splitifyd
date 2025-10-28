import type { UpdateSettlementRequest } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import type { CurrencyISOCode } from '@splitifyd/shared';
import {convertToISOString, generateShortId, randomDate, randomValidCurrencyAmountPair} from '../test-helpers';
import type {ISOString} from "@splitifyd/shared";

export class SettlementUpdateBuilder {
    private update: Partial<UpdateSettlementRequest>;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);

        this.update = {
            amount,
            currency,
            date: convertToISOString(randomDate()),
            note: `Updated settlement ${generateShortId()}`,
        };
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): this {
        this.update.currency = currency;
        this.update.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.update.currency = currency;
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.update.date = convertToISOString(timestamp);
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
