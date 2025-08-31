import { Timestamp } from 'firebase-admin/firestore';
import { SettlementBuilder } from './SettlementBuilder';

/**
 * Builder for creating Firestore-compatible settlement documents in tests
 * Extends SettlementBuilder to add Firestore-specific fields like id, timestamps
 */
export class FirestoreSettlementBuilder extends SettlementBuilder {
    private firestoreFields: any = {
        id: 'settlement-1',
        createdBy: 'default-user-id',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        date: Timestamp.now(),
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

    build(): any {
        const baseSettlement = super.build();
        const result = {
            ...this.firestoreFields,
            ...baseSettlement,
            // Convert date string to Firestore Timestamp if provided
            date: baseSettlement.date ? Timestamp.fromDate(new Date(baseSettlement.date)) : this.firestoreFields.date,
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete result.currency;
        }
        return result;
    }
}