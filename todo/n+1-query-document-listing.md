# N+1 Query in Document Listing for Expense Statistics

## Problem
- **Location**: `firebase/functions/src/documents/handlers.ts:200-204`
- **Description**: The `listDocuments` function, when iterating through the fetched documents, calls `getGroupExpenseStats` for each document identified as a group. This results in an N+1 query problem, where N is the number of group documents in the current page. Each call to `getGroupExpenseStats` performs two additional Firestore queries (one for count and one for the last expense time). This significantly increases the number of Firestore reads, impacting performance and cost, especially as the number of group documents grows.
- **Current vs Expected**:
  - Current: For each group document, two separate Firestore queries are executed to fetch expense statistics.
  - Expected: Expense statistics should be fetched more efficiently, ideally through pre-aggregation or a single batched query.

## Solution
- **Option 1 (Recommended - Pre-aggregation)**: Implement Firestore triggers (Cloud Functions) to update `expenseCount` and `lastExpenseTime` directly on the group document whenever an expense is added, updated, or deleted for that group. This denormalizes the data, making reads highly efficient (single document read).
- **Option 2 (Batched Query)**: If pre-aggregation is not immediately feasible, collect all `groupId`s from the documents in the current page. Then, perform a single batched query (or a few batched queries if the number of groups is large) to fetch all necessary expense statistics for these groups. This would still be more efficient than N individual queries.

## Impact
- **Type**: Performance improvement, potential behavior change (if pre-aggregation is implemented, data might be slightly stale if triggers fail, but generally more performant).
- **Risk**: Medium (implementing triggers requires careful handling of edge cases and potential race conditions).
- **Complexity**: Moderate to Complex (depending on the chosen solution).
- **Benefit**: High value (significant performance improvement, reduced Firestore read costs, better scalability).

## Implementation Notes
- If choosing pre-aggregation, ensure robust error handling and retry mechanisms for the Cloud Functions that update the group documents.
- Consider the trade-offs between read performance (pre-aggregation) and write complexity/data consistency.
