import type { UpdateSettlementRequest } from '@billsplit-wl/shared';
import { Amount } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { toCurrencyISOCode } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomDate, randomValidCurrencyAmountPair } from '../test-helpers';

export class SettlementUpdateBuilder {
    private update: Partial<UpdateSettlementRequest>;

    constructor(useDefaults: boolean = true) {
        if (useDefaults) {
            const { currency, amount } = randomValidCurrencyAmountPair(5, 200);

            this.update = {
                amount,
                currency,
                date: convertToISOString(randomDate()),
                note: `Updated settlement ${generateShortId()}`,
            };
        } else {
            this.update = {};
        }
    }

    static empty(): SettlementUpdateBuilder {
        return new SettlementUpdateBuilder(false);
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

    withDate(timestamp: Date | string | ISOString): this {
        this.update.date = convertToISOString(timestamp);
        return this;
    }

    withNote(note: string): this {
        this.update.note = note;
        return this;
    }

    withInvalidAmount(value: string): this {
        (this.update as any).amount = value;
        return this;
    }

    withInvalidNote(value: string): this {
        (this.update as any).note = value;
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
