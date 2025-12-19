import type { ReactionCounts, ReactionEmoji, SettlementDTO, UserId, UserReactionsMap } from '@billsplit-wl/shared';
import { Amount, GroupId, SettlementId, toGroupId, toSettlementId, toUserId } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import type { ISOString } from '@billsplit-wl/shared';
import { toCurrencyISOCode } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomDate, randomString, randomValidCurrencyAmountPair } from '../test-helpers';

/**
 * Builder for creating SettlementDTO instances with sane defaults.
 * Mirrors the Builder pattern used across test-support utilities.
 */
export class SettlementDTOBuilder {
    private settlement: SettlementDTO;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);
        const groupId = toGroupId(`group-${generateShortId()}`);
        const payerId = toUserId(`user-${generateShortId()}`);
        const payeeId = toUserId(`user-${generateShortId()}`);

        this.settlement = {
            id: toSettlementId(`settlement-${generateShortId()}`),
            groupId,
            payerId,
            payeeId,
            amount,
            currency,
            date: convertToISOString(randomDate()),
            note: `Settlement ${randomString(6)}`,
            createdBy: toUserId('default-user-id'),
            createdAt: convertToISOString(new Date()),
            updatedAt: convertToISOString(new Date()),
            deletedAt: null,
            deletedBy: null,
            supersededBy: null,
            isLocked: false,
        };
    }

    withId(id: SettlementId | string): this {
        this.settlement.id = typeof id === 'string' ? toSettlementId(id) : id;
        return this;
    }

    withGroupId(groupId: GroupId | string): this {
        this.settlement.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withPayerId(payerId: UserId | string): this {
        this.settlement.payerId = typeof payerId === 'string' ? toUserId(payerId) : payerId;
        return this;
    }

    withPayeeId(payeeId: UserId | string): this {
        this.settlement.payeeId = typeof payeeId === 'string' ? toUserId(payeeId) : payeeId;
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode | string): this {
        this.settlement.currency = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;
        this.settlement.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.settlement.currency = currency;
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

    withoutNote(): this {
        delete this.settlement.note;
        return this;
    }

    withCreatedBy(userId: UserId | string): this {
        this.settlement.createdBy = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withCreatedAt(timestamp: Date | string | ISOString): this {
        this.settlement.createdAt = convertToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: Date | string | ISOString): this {
        this.settlement.updatedAt = convertToISOString(timestamp);
        return this;
    }

    withDeletedAt(timestamp: Date | string | ISOString | null): this {
        this.settlement.deletedAt = timestamp ? convertToISOString(timestamp) : null;
        return this;
    }

    withDeletedBy(userId: UserId | null): this {
        this.settlement.deletedBy = userId;
        return this;
    }

    withIsLocked(isLocked: boolean): this {
        this.settlement.isLocked = isLocked;
        return this;
    }

    withReactionCounts(reactionCounts: ReactionCounts): this {
        this.settlement.reactionCounts = reactionCounts;
        return this;
    }

    withUserReactions(userReactions: UserReactionsMap): this {
        this.settlement.userReactions = userReactions;
        return this;
    }

    build(): SettlementDTO {
        return { ...this.settlement };
    }
}
