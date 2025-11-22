import type { CreateSettlementRequest } from '@billsplit-wl/shared';
import { Amount } from '@billsplit-wl/shared';
import { GroupId, UserId } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { toCurrencyISOCode } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomDate, randomString, randomValidCurrencyAmountPair } from '../test-helpers';
import {toUserId} from "@billsplit-wl/shared";

export class CreateSettlementRequestBuilder {
    private settlement: CreateSettlementRequest;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);
        this.settlement = {
            groupId: toGroupId(`group-${generateShortId()}`),
            payerId: toUserId(`user-${generateShortId()}`),
            payeeId: toUserId(`user-${generateShortId()}`),
            amount,
            currency,
            date: convertToISOString(randomDate()),
            note: `Settlement ${randomString(6)}`,
        };
    }

    withGroupId(groupId: GroupId | string): this {
        this.settlement.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withPayerId(payerId: UserId | string): this {
        this.settlement.payerId = typeof payerId === 'string' ? toUserId(payerId) : payerId;;
        return this;
    }

    withPayeeId(payeeId: UserId | string): this {
        this.settlement.payeeId = typeof payeeId === 'string' ? toUserId(payeeId) : payeeId;;
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode | string): this {
        this.settlement.currency = typeof currency === "string" ? toCurrencyISOCode(currency) : currency;
        this.settlement.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withDate(timestamp: Date | string | ISOString): this {
        this.settlement.date = convertToISOString(timestamp);
        return this;
    }

    withNote(note: string): this {
        this.settlement.note = note;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
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
