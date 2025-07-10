# Backend Issue: Efficient Firestore Queries

## Issue Description

Firestore costs are driven by document reads. Fetching only the data you need using `select` and paginating results can reduce these costs. Avoiding the `offset` method for pagination is crucial as it still incurs costs for skipped documents.

## Recommendation

Fetch only the data required by the UI using the `select` clause in your queries. Implement pagination for all lists (expenses, groups, etc.) to avoid fetching large collections at once. Avoid using the `offset` method for pagination.

## Implementation Suggestions

This is a backend (Firebase Functions) issue.

1.  **Use `select` for Specific Fields:**
    *   **Action:** Modify Firestore queries in your Cloud Functions to retrieve only the necessary fields using `.select()`.
    *   **Example:** If a frontend list only needs `description`, `amount`, and `paidBy` for an expense, don't fetch the entire document.

    ```typescript
    // firebase/functions/src/expenses/handlers.ts (or similar)
    const expensesRef = db.collection('expenses');
    const snapshot = await expensesRef
      .where('groupId', '==', groupId)
      .select('description', 'amount', 'paidBy', 'createdAt') // Only fetch needed fields
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    ```

2.  **Implement Cursor-Based Pagination:**
    *   **Action:** For all list-fetching endpoints, replace `offset` (if used) with cursor-based pagination using `startAfter()` or `startAt()`.
    *   **Approach:** The client sends the ID of the last document received (the cursor). The next query starts after this document.
    *   **Example (already covered in `backend-efficient-backend-queries.md` for `listUserExpenses`):
        ```typescript
        // firebase/functions/src/expenses/handlers.ts (example for group expenses)
        export const listGroupExpensesHandler = async (req: Request, res: Response) => {
          try {
            const groupId = req.query.groupId as string;
            const limit = parseInt(req.query.limit as string) || 20;
            const cursor = req.query.cursor as string | undefined;

            let query = db.collection('expenses')
              .where('groupId', '==', groupId)
              .orderBy('createdAt', 'desc')
              .limit(limit);

            if (cursor) {
              const lastDocSnapshot = await db.collection('expenses').doc(cursor).get();
              if (lastDocSnapshot.exists) {
                query = query.startAfter(lastDocSnapshot);
              }
            }

            const snapshot = await query.get();
            const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const lastDocId = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : undefined;
            const hasMore = snapshot.docs.length === limit; // Check if more documents might exist

            res.status(200).json({ expenses, cursor: lastDocId, hasMore });
          } catch (error) {
            console.error('Error listing group expenses:', error);
            res.status(500).json({ message: 'Failed to retrieve expenses.' });
          }
        };
        ```

**Next Steps:**
1.  Review all Firestore queries in Firebase Functions.
2.  Apply `.select()` to fetch only necessary fields.
3.  Ensure all pagination is implemented using cursor-based methods (`startAfter`/`startAt`) instead of `offset`.
