import type { SettlementDTO } from '@splitifyd/shared';
import { Amount, UserId } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import type { CurrencyISOCode } from '@splitifyd/shared';
import { generateShortId, randomDate, randomString, randomValidCurrencyAmountPair, timestampToISOString } from '../test-helpers';

/**
 * Builder for creating Settlement objects for tests
 * Builds complete SettlementDTO with all required fields
 */
export class SettlementDTOBuilder {
    // Core settlement data (from CreateSettlementRequest)
    private groupId: GroupId;
    private payerId: UserId;
    private payeeId: UserId;
    private amount: Amount;
    private currency: CurrencyISOCode;
    private date: string;
    private note?: string;

    // Audit metadata
    private id: string;
    private createdAt: Date;
    private updatedAt: Date;

    // Business logic field
    private createdBy: UserId;

    // Soft delete fields
    private deletedAt: Date | null = null;
    private deletedBy: UserId | null = null;

    // Test control
    private excludeCurrency = false;

    constructor() {
        const { currency, amount } = randomValidCurrencyAmountPair(5, 200);
        this.groupId = `group-${generateShortId()}`;
        this.payerId = `user-${generateShortId()}`;
        this.payeeId = `user-${generateShortId()}`;
        this.amount = amount;
        this.currency = currency;
        this.date = randomDate();
        this.note = `Settlement ${randomString(6)}`;

        // Default metadata
        this.id = 'settlement-1';
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.createdBy = 'default-user-id';
    }

    // CreateSettlementRequest builder methods
    withGroupId(groupId: GroupId): SettlementDTOBuilder {
        this.groupId = groupId;
        return this;
    }

    withPayerId(payerId: UserId): SettlementDTOBuilder {
        this.payerId = payerId;
        return this;
    }

    withPayeeId(payeeId: UserId): SettlementDTOBuilder {
        this.payeeId = payeeId;
        return this;
    }

    withAmount(amount: Amount | number, currency: CurrencyISOCode): SettlementDTOBuilder {
        this.currency = currency;
        this.amount = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withDate(date: string): SettlementDTOBuilder {
        this.date = date;
        return this;
    }

    withNote(note: string): SettlementDTOBuilder {
        this.note = note;
        return this;
    }

    withCurrency(currency: CurrencyISOCode): SettlementDTOBuilder {
        this.currency = currency;
        return this;
    }

    withoutDate(): SettlementDTOBuilder {
        delete (this as any).date;
        return this;
    }

    withoutNote(): SettlementDTOBuilder {
        delete this.note;
        return this;
    }

    // SettlementDTO-specific builder methods
    withId(id: string): SettlementDTOBuilder {
        this.id = id;
        return this;
    }

    withCreatedBy(userId: UserId): SettlementDTOBuilder {
        this.createdBy = userId;
        return this;
    }

    withoutCurrency(): SettlementDTOBuilder {
        this.excludeCurrency = true;
        return this;
    }

    build(): SettlementDTO {
        const result: SettlementDTO = {
            id: this.id,
            groupId: this.groupId,
            payerId: this.payerId,
            payeeId: this.payeeId,
            amount: this.amount,
            currency: this.currency,
            date: this.date ? new Date(this.date).toISOString() : new Date().toISOString(),
            createdBy: this.createdBy,
            createdAt: timestampToISOString(this.createdAt),
            updatedAt: timestampToISOString(this.updatedAt),
            deletedAt: this.deletedAt ? timestampToISOString(this.deletedAt) : null,
            deletedBy: this.deletedBy,
        };

        // Add note if present
        if (this.note !== undefined) {
            result.note = this.note;
        }

        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete (result as any).currency;
        }

        return result;
    }
}
