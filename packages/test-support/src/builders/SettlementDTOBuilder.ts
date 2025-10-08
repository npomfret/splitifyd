import type { SettlementDTO } from '@splitifyd/shared';
import { timestampToISOString } from '../test-helpers';
import { CreateSettlementRequestBuilder } from './CreateSettlementRequestBuilder';

/**
 * Builder for creating Settlement objects for tests
 * Extends CreateSettlementRequestBuilder to add document ID and audit metadata
 */
export class SettlementDTOBuilder extends CreateSettlementRequestBuilder {
    // Pure infrastructure metadata - automatically managed fields
    private auditFields = {
        id: 'settlement-1',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    // Business logic field that happens to be in Settlement interface
    private businessFields: { createdBy: string; } = {
        createdBy: 'default-user-id',
    };
    private excludeCurrency = false;

    withId(id: string): SettlementDTOBuilder {
        this.auditFields.id = id;
        return this;
    }

    withCreatedBy(userId: string): SettlementDTOBuilder {
        this.businessFields.createdBy = userId;
        return this;
    }

    withoutCurrency(): SettlementDTOBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    build(): SettlementDTO {
        const baseSettlement = super.build();
        const result: SettlementDTO = {
            ...this.auditFields,
            ...this.businessFields,
            ...baseSettlement,
            // Convert date string to Date object for client compatibility, then to ISO string
            date: baseSettlement.date ? new Date(baseSettlement.date).toISOString() : new Date().toISOString(),
            // Ensure required fields for Settlement type - convert audit timestamps to ISO strings
            createdAt: timestampToISOString(this.auditFields.createdAt),
            updatedAt: timestampToISOString(this.auditFields.updatedAt),
            // Soft delete fields - default to null (not deleted)
            deletedAt: null,
            deletedBy: null,
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete (result as any).currency;
        }
        return result;
    }
}
