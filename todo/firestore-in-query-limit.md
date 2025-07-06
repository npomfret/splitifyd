# Firestore `in` Query Limit in `listUserExpenses`

## Problem
- **Location**: `firebase/functions/src/expenses/handlers.ts:300`
- **Description**: The `listUserExpenses` function fetches all `groupIds` associated with a user and then uses a Firestore `where('groupId', 'in', groupIds)` query. Firestore's `in` operator has a limit of 10 values. If a user is associated with more than 10 groups, this query will fail or only return expenses for the first 10 groups, leading to incomplete results.
- **Current vs Expected**:
  - Current: The `listUserExpenses` function might return incomplete data or fail if a user belongs to more than 10 groups.
  - Expected: The function should correctly retrieve all expenses for a user, regardless of the number of groups they belong to.

## Solution
- **Option 1 (Multiple Queries)**: If the number of groups is not excessively large (e.g., up to a few dozen), split the `groupIds` array into chunks of 10 or fewer. Execute multiple Firestore queries, one for each chunk, and then merge the results. This approach increases the number of reads but is a straightforward fix.
- **Option 2 (Denormalization/Collection Group Query)**: For a more scalable solution, consider denormalizing the data. For example, create a subcollection `userExpenses` under each user document, or use a Firestore Collection Group query if the data model allows (e.g., if expenses are in a subcollection named `expenses` under each group). This would require restructuring how expenses are stored or queried.
- **Option 3 (Cloud Function for Aggregation)**: If the client only needs a summary or a limited view, a Cloud Function could aggregate expenses for a user and store them in a separate collection, which the client can then query directly.

## Impact
- **Type**: Bug fix, behavior change (correctness of data retrieval).
- **Risk**: Medium (Option 1 is low risk, Options 2 & 3 are higher due to data model changes).
- **Complexity**: Moderate to Complex (depending on the chosen solution).
- **Benefit**: High value (ensures data integrity and correctness for users with many groups, improves scalability).

## Implementation Notes
- Prioritize a solution based on the expected maximum number of groups a user might have and the complexity of data model changes.
- If using multiple queries, ensure proper handling of pagination and merging results.
