import { randomString, randomDecimal, randomDate, randomCurrency, generateShortId } from '../test-helpers';
import { CreateSettlementRequest } from '@splitifyd/shared';

export class CreateSettlementRequestBuilder {
    private settlement: CreateSettlementRequest;

    constructor() {
        this.settlement = {
            groupId: `group-${generateShortId()}`,
            payerId: `user-${generateShortId()}`,
            payeeId: `user-${generateShortId()}`,
            amount: randomDecimal(1, 500),
            currency: randomCurrency(),
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

    withAmount(amount: number): this {
        this.settlement.amount = amount;
        return this;
    }

    withCurrency(currency: string): this {
        this.settlement.currency = currency;
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

    withoutNote(): this {
        this.settlement.note = undefined;
        return this;
    }

    withoutDate(): this {
        this.settlement.date = undefined;
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