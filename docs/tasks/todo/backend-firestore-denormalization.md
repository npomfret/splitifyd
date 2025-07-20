# Backend Issue: Firestore Data Modeling and Denormalization

## Issue Description

Firestore costs are driven by document reads, writes, deletes, data storage, and network egress. At scale, read operations are likely to be the most significant cost factor. The current data model may lead to frequent document reads.

## Recommendation

Denormalize data to reduce the need for frequent document reads. For example, when displaying a list of expenses, instead of fetching the full user document for each expense to get the user's name, store the user's `displayName` directly on the expense document. This trades a small amount of storage for a significant reduction in read operations.

## Implementation Suggestions

This is a backend (Firebase Functions) issue.

1.  **Identify High-Read Scenarios:** Analyze current Firestore usage to pinpoint queries that perform many document reads to gather related information (e.g., fetching user details for every expense in a list).

2.  **Modify Data Models for Denormalization:**
    *   **Example: Expense Documents:** When an expense is created or updated, include the `paidByName` (and potentially `paidByPhotoURL` or `paidByInitials`) directly within the expense document.

    ```typescript
    // firebase/functions/src/models/expense.ts (or similar)
    export interface ExpenseData {
      // ... existing fields
      paidBy: string; // User ID of who paid
      paidByName: string; // Denormalized: Name of who paid
      // paidByPhotoURL?: string; // Optional: Denormalized photo URL
      // paidByInitials?: string; // Optional: Denormalized initials
    }

    // In the Cloud Function that creates/updates expenses:
    // Before writing to Firestore, fetch the user's display name
    const userSnapshot = await admin.firestore().collection('users').doc(expense.paidBy).get();
    const paidByName = userSnapshot.data()?.displayName || 'Unknown User';

    const expenseToSave = {
      // ... expense data
      paidBy: expense.paidBy,
      paidByName: paidByName,
    };
    ```

3.  **Update Frontend Consumption:**
    *   Once denormalized fields are available in the backend, update the frontend queries to directly use these fields from the expense document, eliminating the need for additional user document reads.

**Next Steps:**
1.  Prioritize which data relationships to denormalize based on read frequency and cost impact.
2.  Implement the denormalization logic in the relevant Firebase Functions (e.g., `onCreate` or `onUpdate` triggers for expenses/groups).
3.  Update frontend queries to consume the denormalized data.
