import type { GroupMember, SettlementWithMembers, UserId } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import { GroupId, ISOString } from '@splitifyd/shared';
import type { CurrencyISOCode } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { SettlementId, toSettlementId } from '@splitifyd/shared';
import { convertToISOString, generateShortId, randomValidCurrencyAmountPair } from '../test-helpers';
import { GroupMemberBuilder } from './GroupMemberBuilder';

/**
 * Builder for creating SettlementWithMembers objects for tests
 *
 * SettlementWithMembers is an enriched settlement type with resolved member details
 * (payer and payee as full GroupMember objects instead of UIDs)
 */
export class SettlementWithMembersBuilder {
    private settlement: SettlementWithMembers;

    constructor() {
        // Create default payer and payee members
        const payer = new GroupMemberBuilder()
            .withUid('payer-user')
            .withDisplayName('Payer User')
            .build();

        const payee = new GroupMemberBuilder()
            .withUid('payee-user')
            .withDisplayName('Payee User')
            .build();

        const { currency, amount } = randomValidCurrencyAmountPair(10, 500);

        this.settlement = {
            id: toSettlementId(`settlement-${generateShortId()}`),
            groupId: toGroupId(`group-${generateShortId()}`),
            payer,
            payee,
            amount,
            currency,
            date: convertToISOString(new Date()),
            createdAt: convertToISOString(new Date()),
            deletedAt: null,
            deletedBy: null,
            isLocked: false, // Default to unlocked
        };
    }

    withId(id: string | SettlementId): this {
        this.settlement.id = typeof id === 'string' ? toSettlementId(id) : id;
        return this;
    }

    withGroupId(groupId: GroupId | string): this {
        this.settlement.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withPayer(payer: GroupMember): this {
        this.settlement.payer = payer;
        return this;
    }

    withPayerId(payerId: UserId): this {
        this.settlement.payer = new GroupMemberBuilder()
            .withUid(payerId)
            .withDisplayName(`Payer ${payerId.slice(0, 4)}`)
            .build();
        return this;
    }

    withPayee(payee: GroupMember): this {
        this.settlement.payee = payee;
        return this;
    }

    withPayeeId(payeeId: UserId): this {
        this.settlement.payee = new GroupMemberBuilder()
            .withUid(payeeId)
            .withDisplayName(`Payee ${payeeId.slice(0, 4)}`)
            .build();
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): this {
        this.settlement.currency = currency;
        this.settlement.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): this {
        this.settlement.currency = currency;
        return this;
    }

    withDate(date: string | Date): this {
        this.settlement.date = convertToISOString(date);
        return this;
    }

    withNote(note: string): this {
        this.settlement.note = note;
        return this;
    }

    withCreatedAt(createdAt: ISOString | Date | string): this {
        this.settlement.createdAt = convertToISOString(createdAt);
        return this;
    }

    withIsLocked(isLocked: boolean): this {
        this.settlement.isLocked = isLocked;
        return this;
    }

    build(): SettlementWithMembers {
        return { ...this.settlement };
    }
}
