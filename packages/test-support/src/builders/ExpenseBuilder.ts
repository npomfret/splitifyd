import { CreateExpenseRequestBuilder } from './CreateExpenseRequestBuilder';
import type { FirestoreTimestamp, ExpenseData, FirestoreAuditMetadataWithDeletion } from '@splitifyd/shared';

/**
 * Builder for creating ExpenseData objects for tests
 * Extends CreateExpenseRequestBuilder to add document ID and audit metadata
 */
export class ExpenseBuilder extends CreateExpenseRequestBuilder {
    // Pure infrastructure metadata - automatically managed fields
    private auditFields: FirestoreAuditMetadataWithDeletion = {
        id: 'expense-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
    };

    // Business logic field that happens to be in ExpenseData interface
    private businessFields: { createdBy: string } = {
        createdBy: 'default-user-id',
    };
    private excludeCurrency = false;

    withId(id: string): ExpenseBuilder {
        this.auditFields.id = id;
        return this;
    }

    withCreatedBy(userId: string): ExpenseBuilder {
        this.businessFields.createdBy = userId;
        return this;
    }

    withCreatedAt(timestamp: any): ExpenseBuilder {
        this.auditFields.createdAt = timestamp;
        return this;
    }

    withUpdatedAt(timestamp: any): ExpenseBuilder {
        this.auditFields.updatedAt = timestamp;
        return this;
    }

    withDeletedAt(timestamp: any): ExpenseBuilder {
        this.auditFields.deletedAt = timestamp;
        return this;
    }

    withDeletedBy(userId: string | null): ExpenseBuilder {
        this.auditFields.deletedBy = userId;
        return this;
    }

    withoutCurrency(): ExpenseBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    withClientCompatibleTimestamps(): ExpenseBuilder {
        // For client-side tests that can't handle Firebase Admin Timestamps
        this.auditFields.createdAt = new Date();
        this.auditFields.updatedAt = new Date();
        return this;
    }

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

    build(): ExpenseData {
        const baseExpense = super.build();
        const result: ExpenseData = {
            ...this.auditFields,
            ...this.businessFields,
            ...baseExpense,
            // Convert audit timestamps to ISO strings for ExpenseData
            createdAt: this.timestampToISOString(this.auditFields.createdAt),
            updatedAt: this.timestampToISOString(this.auditFields.updatedAt),
            deletedAt: this.auditFields.deletedAt ? this.timestampToISOString(this.auditFields.deletedAt) : null,
            // Ensure splits exists for validation
            splits: baseExpense.splits || [{ uid: baseExpense.paidBy, amount: baseExpense.amount }],
            // Convert date string to ISO string for client compatibility
            date: baseExpense.date ? new Date(baseExpense.date).toISOString() : new Date().toISOString(),
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete (result as any).currency;
        }
        return result;
    }

    /**
     * Build server-format data with Firestore Timestamps for server-side tests
     * Use this when setting data directly in Firestore stubs/mocks
     */
    buildForFirestore(): any {
        const baseExpense = super.build();
        const result = {
            ...this.auditFields,
            ...this.businessFields,
            ...baseExpense,
            // Keep Firestore Timestamps as-is for server format
            // Ensure splits exists for validation
            splits: baseExpense.splits || [{ uid: baseExpense.paidBy, amount: baseExpense.amount }],
            // Convert date string to Date object for Firestore compatibility
            date: baseExpense.date ? new Date(baseExpense.date) : new Date(),
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete (result as any).currency;
        }
        return result;
    }
}
