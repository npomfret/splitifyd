import { randomDecimal, randomDate, randomString, randomCurrency, generateShortId } from '../test-helpers';

export interface TestSettlement {
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    date?: string;
    note?: string;
}

export class SettlementBuilder {
    private settlement: TestSettlement;

    constructor() {
        this.settlement = {
            groupId: `group-${generateShortId()}`,
            payerId: `user-${generateShortId()}`,
            payeeId: `user-${generateShortId()}`,
            amount: randomDecimal(5, 200),
            currency: randomCurrency(),
            date: randomDate(),
            note: `Settlement ${randomString(6)}`,
        };
    }

    withGroupId(groupId: string): this {
        this.settlement.groupId = groupId;
        return this;
    }

    withPayer(payerId: string): this {
        this.settlement.payerId = payerId;
        return this;
    }

    withPayee(payeeId: string): this {
        this.settlement.payeeId = payeeId;
        return this;
    }

    withAmount(amount: number): this {
        this.settlement.amount = amount;
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

    build(): TestSettlement {
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
