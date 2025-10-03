# Performance: Slow Balance Calculation for Active Groups

## 1. Overview

There is a significant performance concern regarding the on-the-fly calculation of group balances, especially for groups with a high volume of activity (many expenses and settlements). This issue is particularly severe in API endpoints like `_executeListGroups`, which can become very slow and resource-intensive.

## 2. The Problem: Unscalable On-the-Fly Calculations

- **High Latency:** Calculating balances requires fetching all expenses and settlements for a group and processing them in memory. For a group with thousands of transactions, this is a slow and expensive operation that leads to high API response times.
- **Poor User Experience:** Slow responses result in a sluggish UI. For example, the main dashboard, which calls `_executeListGroups`, could take a long time to load for users who are members of many active groups.
- **Cost & Timeouts:** Heavy computational load increases the cost of Cloud Functions and raises the risk of function timeouts, leading to failed requests.
- **Complexity in `_executeListGroups`:** The `_executeListGroups` function is already complex. Embedding a heavy balance calculation within it makes it harder to maintain and more prone to performance bottlenecks.

## 3. The Solution: Pre-computation and Caching of Balances

The solution is to move away from calculating balances on-the-fly and instead adopt a model where balances are pre-computed and stored, making balance retrieval a simple and fast read operation.

### 3.1. Proposed Architecture: Incremental Balance Updates

1.  **Store Balances in Firestore:**
    - Create a new sub-collection or a dedicated document to store the calculated balances for each group. For example, a `group-balances` document within each group.
    - **Schema for `groups/{groupId}/balance` document:**
        ```typescript
        interface GroupBalance {
            // The overall balance of each member in the group
            // A positive value means the member is owed money.
            // A negative value means the member owes money.
            memberBalances: {
                [userId: string]: number; // Amount in cents
            };
            // Matrix of debts between members
            // debtMatrix[payerId][payeeId] = amount payer owes payee
            debtMatrix: {
                [payerId: string]: {
                    [payeeId: string]: number; // Amount in cents
                };
            };
            lastUpdatedAt: Timestamp;
        }
        ```

2.  **Implement Incremental Updates (No Recalculation):**
    - The key to this architecture is to **never perform a full recalculation** after the initial backfill. All subsequent changes must be small, atomic adjustments.

    - **On Create:** When a new expense or settlement is created, calculate its impact and **add** it to the stored balances in the `GroupBalance` document.

    - **On Delete:** When an expense or settlement is deleted, calculate its original impact and **subtract** (or revert) that impact from the stored balances.

    - **On Update:** When an expense or settlement is updated, perform a two-step atomic operation:
        1.  First, **revert** the impact of the expense *before* the edit (subtract its original values from the stored balances).
        2.  Then, **apply** the impact of the expense *after* the edit (add its new values to the stored balances).

    - This logic should be implemented directly in the core services (`ExpenseService`, `SettlementService`) and performed within the same Firestore transaction that writes to the expense or settlement document. This guarantees data consistency and avoids the complexities and potential race conditions of using separate Firestore triggers.

3.  **Decouple from `_executeListGroups`:**
    - Modify `_executeListGroups` to fetch the pre-computed balances from the `GroupBalance` document instead of calculating them. This will make the function significantly faster and simpler.
    - The frontend can then fetch group data and balances in a single, fast query.

### 3.2. Migration Plan

1.  **Create a Backfill Script:**
    - Write a script that iterates through all existing groups, calculates their current balances using the old (but correct) full-fetch method, and creates the initial `GroupBalance` document for each group.
2.  **Deploy New Logic:**
    - Deploy the new services that perform incremental balance updates.
3.  **Switch Over:**
    - Update the API endpoints (`_executeListGroups` and others) to read from the new `GroupBalance` documents.

## 4. Benefits

-   **Performance:** Drastically reduces the latency of reading group balances from O(N) (where N is number of transactions) to O(1).
-   **Scalability:** The system will scale effectively with the number of transactions in a group.
-   **Improved UX:** Faster API responses lead to a more responsive and enjoyable user experience.
-   **Reduced Cost:** Less computational work in Cloud Functions leads to lower operational costs.
-   **Simplicity:** Simplifies complex functions like `_executeListGroups`.

## 5. Acceptance Criteria

-   The time taken to list groups via `_executeListGroups` is significantly reduced and is independent of the number of transactions in those groups.
-   Creating, updating, or deleting an expense/settlement correctly updates the pre-computed balance document.
-   Balances displayed to the user are consistent and accurate.
