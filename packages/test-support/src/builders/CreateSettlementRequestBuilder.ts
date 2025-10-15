import type { CreateSettlementRequest } from '@splitifyd/shared';
import { generateShortId, randomDate, randomString, randomValidCurrencyAmountPair } from '../test-helpers';
import {Amount} from "@splitifyd/shared";

export class CreateSettlementRequestBuilder {
    private settlement: CreateSettlementRequest;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);
        this.settlement = {
            groupId: `group-${generateShortId()}`,
            payerId: `user-${generateShortId()}`,
            payeeId: `user-${generateShortId()}`,
            amount,
            currency,
            date: randomDate(),
            note: `Settlement ${randomString(6)}`,
        };
    }

    withGroupId(groupId: string): this {
        this.settlement.groupId = groupId;
        return this;
    }

    withPayerId(payerId: string): this {
        this.settlement.payerId = payerId;
        return this;
    }

    withPayeeId(payeeId: string): this {
        this.settlement.payeeId = payeeId;
        return this;
    }

    withAmount(amount: Amount | number): this {
        this.settlement.amount = typeof amount === "number" ? amount.toString() : amount;
        return this;
    }

    withDate(date: string): this {
        this.settlement.date = date;
        return this;
    }

    withNote(note: string): this {
        this.settlement.note = note;
        return this;
    }

    withCurrency(currency: string): this {
        this.settlement.currency = currency;
        return this;
    }

    withoutDate(): this {
        delete this.settlement.date;
        return this;
    }

    withoutNote(): this {
        delete this.settlement.note;
        return this;
    }

    build(): CreateSettlementRequest {
        return {
            groupId: this.settlement.groupId,
            payerId: this.settlement.payerId,
            payeeId: this.settlement.payeeId,
            amount: this.settlement.amount,
            currency: this.settlement.currency,
            ...(this.settlement.date && { date: this.settlement.date }),
            ...(this.settlement.note && { note: this.settlement.note }),
        };
    }
}
