# Backend Issue: Efficient Backend Queries

## Issue Description

The `listUserExpenses` function is highly inefficient, suffering from the N+1 query problem and performing in-memory pagination.

## Recommendation

Denormalize data for efficient queries. Modify the data model to support more efficient queries. When an expense is created, add a `memberIds` array to the expense document, containing the user IDs of all group members. Use `array-contains` Queries. Refactor `listUserExpenses` to use a single, efficient Firestore query with an `array-contains` clause on the `memberIds` field. This will allow for scalable, database-level filtering and pagination.

## Implementation Suggestions

This is a backend (Firebase Functions) issue.

1.  **Modify Firestore Data Model:**
    *   When creating or updating an expense, ensure the expense document includes an array field, e.g., `participantUids`, which stores the UIDs of all users involved in that expense (both paidBy and those in splits).

    ```typescript
    // Example: firebase/functions/src/expenses/service.ts (or similar)
    interface ExpenseDocument {
      // ... existing fields
      participantUids: string[]; // New field
    }

    // When creating/updating an expense:
    const expenseData = {
      // ...
      participantUids: [expense.paidBy, ...expense.splits.map(s => s.userId)],
    };
    ```

2.  **Refactor `listUserExpenses` Function:**
    *   Modify the Firebase Function that handles `listUserExpenses` to query Firestore using `array-contains` on the new `participantUids` field.
    *   Implement proper Firestore-native pagination using `limit` and `startAfter` (or `startAt`) with a cursor, instead of `offset`.

    ```typescript
    // Example: firebase/functions/src/expenses/handlers.ts (or similar)
    import { getFirestore } from 'firebase-admin/firestore';

    const db = getFirestore();

    export const listUserExpensesHandler = async (req: Request, res: Response) => {
      try {
        const userId = req.user.uid; // Assuming user ID is available from auth middleware
        const limit = parseInt(req.query.limit as string) || 20;
        const cursor = req.query.cursor as string | undefined;

        let query = db.collection('expenses')
          .where('participantUids', 'array-contains', userId)
          .orderBy('createdAt', 'desc') // Or another relevant field for ordering
          .limit(limit);

        if (cursor) {
          const lastDoc = await db.collection('expenses').doc(cursor).get();
          if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
          }
        }

        const snapshot = await query.get();
        const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const lastDocId = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : undefined;
        const hasMore = snapshot.docs.length === limit;

        res.status(200).json({ expenses, cursor: lastDocId, hasMore });
      } catch (error) {
        console.error('Error listing user expenses:', error);
        res.status(500).json({ message: 'Failed to retrieve expenses.' });
      }
    };
    ```

**Next Steps:**
1.  Update the Firestore data model for expenses to include `participantUids`.
2.  Modify the backend `listUserExpenses` function to use `array-contains` and cursor-based pagination.
3.  Update the frontend `ExpenseService.listUserExpenses` to pass the `cursor` and handle the `hasMore` flag.
