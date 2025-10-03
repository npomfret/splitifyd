# Bug: Incomplete Pagination in Balance Calculation

## 1. Overview

A critical bug is suspected in the balance calculation logic. When calculating group balances, the system may not be fetching all relevant expense and settlement documents from Firestore. This is likely due to a lack of proper pagination in the data fetching process.

## 2. The Problem: Potentially Inaccurate Balances

- **Firestore Query Limits:** Firestore queries have a default limit on the number of documents they return in a single batch.
- **Missing Pagination Logic:** If the code that fetches expenses and settlements for balance calculation does not loop through all pages of results, it will only process the first batch of documents.
- **Impact:** For groups with a high volume of transactions (more than the batch limit), the balance calculation will be based on an incomplete dataset, leading to **incorrect financial balances**. This is a critical issue that undermines the core functionality of the application and can lead to a loss of user trust.

## 3. The Solution: Implement Robust Pagination

The solution is to ensure that all expense and settlement documents for a group are fetched before performing a balance calculation.

### 3.1. Implementation Plan

1.  **Identify the Code:**
    - Locate the service or function responsible for calculating balances (likely within `BalanceCalculationService` or a related module).
    - Pinpoint the exact Firestore queries used to fetch `expenses` and `settlements` for a given group.

2.  **Implement Exhaustive Fetching:**
    - Modify the data-fetching logic to use a pagination loop.
    - Use Firestore's cursor-based pagination (`startAfter`) to iteratively fetch all pages of documents until no more documents are returned.

    **Example Pseudocode:**

    ```typescript
    // In the service that fetches data for balance calculation

    async function getAllDocuments(query: Query): Promise<QueryDocumentSnapshot[]> {
        let allDocs: QueryDocumentSnapshot[] = [];
        let lastVisible: QueryDocumentSnapshot | null = null;
        let hasMore = true;

        while (hasMore) {
            const currentQuery = lastVisible ? query.startAfter(lastVisible) : query;
            const snapshot = await currentQuery.get();

            if (snapshot.empty) {
                hasMore = false;
            } else {
                allDocs = allDocs.concat(snapshot.docs);
                lastVisible = snapshot.docs[snapshot.docs.length - 1];
            }
        }
        return allDocs;
    }

    // ... inside the balance calculation logic
    const expensesQuery = firestoreDb.collection('expenses').where('groupId', '==', groupId);
    const allExpensesDocs = await getAllDocuments(expensesQuery);

    const settlementsQuery = firestoreDb.collection('settlements').where('groupId', '==', groupId);
    const allSettlementsDocs = await getAllDocuments(settlementsQuery);

    // Proceed with balance calculation using the complete lists
    ```

3.  **Performance Considerations:**
    - Fetching all documents for very large groups can be slow and memory-intensive. This fix addresses the correctness bug, but it may exacerbate the performance problem described in `performance-slow-balance-calculation-for-active-groups.md`.
    - The long-term solution for performance is likely to move away from on-the-fly calculations (see related task), but ensuring correctness via full data fetching is the immediate priority.

## 4. Acceptance Criteria

-   When calculating balances for a group with more expenses/settlements than the Firestore query limit, the calculation is correct and includes all transactions.
-   Unit and integration tests are created with a large number of mock transactions to verify that the pagination logic works correctly.
-   The system correctly calculates balances for a group with thousands of expenses and settlements.
