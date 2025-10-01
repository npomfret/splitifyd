import { Timestamp } from 'firebase-admin/firestore';
import { CreateSettlementRequestBuilder } from './CreateSettlementRequestBuilder';
import type { Settlement } from '@splitifyd/shared';

/**
 * Builder for creating Firestore-compatible settlement documents in tests
 * Extends SettlementBuilder to add Firestore-specific fields like id, timestamps
 */
export class FirestoreSettlementBuilder extends CreateSettlementRequestBuilder {
    private firestoreFields: any = {
        id: 'settlement-1',
        createdBy: 'default-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        date: new Date(),
    };
    private excludeCurrency = false;

    withId(id: string): FirestoreSettlementBuilder {
        this.firestoreFields.id = id;
        return this;
    }

    withCreatedBy(userId: string): FirestoreSettlementBuilder {
        this.firestoreFields.createdBy = userId;
        return this;
    }

    withoutCurrency(): FirestoreSettlementBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    // Note: withPayerId and withPayeeId are now inherited from base class

    withMemberIds(memberIds: string[]): FirestoreSettlementBuilder {
        this.firestoreFields.memberIds = memberIds;
        return this;
    }

    build(): Settlement {
        const baseSettlement = super.build();
        const result: Settlement = {
            ...this.firestoreFields,
            ...baseSettlement,
            // Convert date string to Date object for client compatibility, then to ISO string
            date: baseSettlement.date ? new Date(baseSettlement.date).toISOString() : this.firestoreFields.date.toISOString(),
            // Ensure required fields for Settlement type
            createdAt: this.firestoreFields.createdAt.toISOString(),
            updatedAt: this.firestoreFields.updatedAt.toISOString(),
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete (result as any).currency;
        }
        return result;
    }
}
