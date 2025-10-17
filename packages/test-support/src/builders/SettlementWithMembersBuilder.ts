import type { GroupMember, SettlementWithMembers } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import { generateShortId, randomValidCurrencyAmountPair } from '../test-helpers';
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
            id: `settlement-${generateShortId()}`,
            groupId: `group-${generateShortId()}`,
            payer,
            payee,
            amount,
            currency,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            deletedAt: null,
            deletedBy: null,
            isLocked: false, // Default to unlocked
        };
    }

    withId(id: string): this {
        this.settlement.id = id;
        return this;
    }

    withGroupId(groupId: string): this {
        this.settlement.groupId = groupId;
        return this;
    }

    withPayer(payer: GroupMember): this {
        this.settlement.payer = payer;
        return this;
    }

    withPayerId(payerId: string): this {
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

    withPayeeId(payeeId: string): this {
        this.settlement.payee = new GroupMemberBuilder()
            .withUid(payeeId)
            .withDisplayName(`Payee ${payeeId.slice(0, 4)}`)
            .build();
        return this;
    }

    withAmount(amount: Amount | number, currency: string): this {
        this.settlement.currency = currency;
        this.settlement.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withCurrency(currency: string): this {
        this.settlement.currency = currency;
        return this;
    }

    withDate(date: string | Date): this {
        this.settlement.date = typeof date === 'string' ? date : date.toISOString();
        return this;
    }

    withNote(note: string): this {
        this.settlement.note = note;
        return this;
    }

    withCreatedAt(createdAt: string | Date): this {
        this.settlement.createdAt = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
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
