import { Timestamp } from 'firebase-admin/firestore';
import { CreateExpenseRequestBuilder } from './CreateExpenseRequestBuilder';

/**
 * Builder for creating Firestore-compatible expense documents in tests
 * Extends ExpenseBuilder to add Firestore-specific fields like id, timestamps
 */
export class FirestoreExpenseBuilder extends CreateExpenseRequestBuilder {
    private firestoreFields: any = {
        id: 'expense-1',
        createdBy: 'default-user-id',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        deletedAt: null,
        deletedBy: null,
    };
    private excludeCurrency = false;

    withId(id: string): FirestoreExpenseBuilder {
        this.firestoreFields.id = id;
        return this;
    }

    withCreatedBy(userId: string): FirestoreExpenseBuilder {
        this.firestoreFields.createdBy = userId;
        return this;
    }

    withoutCurrency(): FirestoreExpenseBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    build(): any {
        const baseExpense = super.build();
        const result = {
            ...this.firestoreFields,
            ...baseExpense,
            // Ensure splits exists for validation
            splits: baseExpense.splits || [{ userId: baseExpense.paidBy, amount: baseExpense.amount }],
            // Convert date string to Firestore Timestamp
            date: Timestamp.fromDate(new Date(baseExpense.date)),
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete result.currency;
        }
        return result;
    }
}
