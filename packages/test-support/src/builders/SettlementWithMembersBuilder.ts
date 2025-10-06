import type { SettlementWithMembers, GroupMember } from '@splitifyd/shared';
import { generateShortId, randomDecimal, randomCurrency } from '../test-helpers';
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
        const payer = new GroupMemberBuilder().withUid('payer-user').withDisplayName('Payer User').build();

        const payee = new GroupMemberBuilder().withUid('payee-user').withDisplayName('Payee User').build();

        this.settlement = {
            id: `settlement-${generateShortId()}`,
            groupId: `group-${generateShortId()}`,
            payer,
            payee,
            amount: randomDecimal(10, 500),
            currency: randomCurrency(),
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
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

    withAmount(amount: number): this {
        this.settlement.amount = amount;
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

    build(): SettlementWithMembers {
        return { ...this.settlement };
    }

    /**
     * Create a settlement between two specific users
     */
    static between(payerId: string, payeeId: string, amount: number = 100): SettlementWithMembersBuilder {
        return new SettlementWithMembersBuilder().withPayerId(payerId).withPayeeId(payeeId).withAmount(amount);
    }

    /**
     * Create a settlement with full member objects
     */
    static withMembers(payer: GroupMember, payee: GroupMember, amount: number = 100): SettlementWithMembersBuilder {
        return new SettlementWithMembersBuilder().withPayer(payer).withPayee(payee).withAmount(amount);
    }

    /**
     * Create multiple settlements for a group
     */
    static buildMany(count: number, groupId: string, customizer?: (builder: SettlementWithMembersBuilder, index: number) => void): SettlementWithMembers[] {
        return Array.from({ length: count }, (_, i) => {
            const builder = new SettlementWithMembersBuilder().withId(`settlement-${i + 1}`).withGroupId(groupId);

            if (customizer) {
                customizer(builder, i);
            }

            return builder.build();
        });
    }
}
