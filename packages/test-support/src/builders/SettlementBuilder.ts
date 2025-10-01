import { CreateSettlementRequestBuilder } from './CreateSettlementRequestBuilder';
import type { Settlement, FirestoreTimestamp, FirestoreAuditMetadata } from '@splitifyd/shared';

/**
 * Builder for creating Settlement objects for tests
 * Extends CreateSettlementRequestBuilder to add document ID and audit metadata
 */
export class SettlementBuilder extends CreateSettlementRequestBuilder {
    // Pure infrastructure metadata - automatically managed fields
    private auditFields: FirestoreAuditMetadata = {
        id: 'settlement-1',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    // Business logic field that happens to be in Settlement interface
    private businessFields: { createdBy: string } = {
        createdBy: 'default-user-id',
    };
    private excludeCurrency = false;

    withId(id: string): SettlementBuilder {
        this.auditFields.id = id;
        return this;
    }

    withCreatedBy(userId: string): SettlementBuilder {
        this.businessFields.createdBy = userId;
        return this;
    }

    withoutCurrency(): SettlementBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    /**
     * Helper to convert FirestoreTimestamp to ISO string
     */
    private timestampToISOString(timestamp: FirestoreTimestamp): string {
        if (typeof timestamp === 'string') {
            return timestamp;
        }
        if (timestamp instanceof Date) {
            return timestamp.toISOString();
        }
        // Firestore Timestamp
        return (timestamp as any).toDate().toISOString();
    }

    build(): Settlement {
        const baseSettlement = super.build();
        const result: Settlement = {
            ...this.auditFields,
            ...this.businessFields,
            ...baseSettlement,
            // Convert date string to Date object for client compatibility, then to ISO string
            date: baseSettlement.date ? new Date(baseSettlement.date).toISOString() : new Date().toISOString(),
            // Ensure required fields for Settlement type - convert audit timestamps to ISO strings
            createdAt: this.timestampToISOString(this.auditFields.createdAt),
            updatedAt: this.timestampToISOString(this.auditFields.updatedAt),
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete (result as any).currency;
        }
        return result;
    }
}
