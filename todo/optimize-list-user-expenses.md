# Optimize listUserExpenses for Scalability

**Problem**: The `listUserExpenses` handler in `firebase/functions/src/expenses/handlers.ts` currently fetches all group IDs associated with a user by querying the `documents` collection where `userId` matches the authenticated user. It then uses an `in` query to fetch expenses for these groups. This approach has several critical scalability and efficiency issues:
1. **`in` query limitation**: Firestore `in` queries are limited to 10 values. If a user is a member of more than 10 groups, this query will fail or return incomplete results, leading to a broken user experience.
2. **Inefficient for many groups**: Fetching all group IDs first and then querying expenses can be highly inefficient for users with a large number of groups, leading to increased read operations and slower response times.
3. **Assumes group ownership**: The current implementation assumes that `userId` in the `documents` collection (which represents groups) signifies group membership. If proper group membership is implemented (as suggested in another `todo`), this query will be incorrect and will not fetch all relevant expenses.

**File**: `firebase/functions/src/expenses/handlers.ts`

**Suggested Solution**:
1. **Denormalize Group Membership**: The most scalable solution is to denormalize user-to-group relationships. For example, maintain a subcollection on each user document that lists the groups they belong to, or a top-level collection mapping users to groups. This allows for efficient retrieval of all groups a user is part of.
2. **Query Expenses by User ID (if applicable)**: If expenses are directly associated with a user (e.g., `paidBy` or `createdBy` fields on the expense document), consider querying expenses directly by the user's ID, rather than through groups. This simplifies the query significantly.
3. **Batch Queries or Composite Indexes**: If expenses must be queried by group, and a user can belong to many groups (exceeding the 10 `in` clause limit), consider:
    - **Batching queries**: Perform multiple queries for groups in batches of 10 or less and combine the results.
    - **Composite Indexes**: Design composite indexes that allow for more efficient querying across multiple groups, though this can still be limited by the `in` clause.
4. **Re-evaluate Data Model**: Revisit the data model for expenses and groups to ensure it inherently supports efficient querying for user-specific expenses without hitting Firestore limitations.

**Behavior Change**: This is a behavior change. The way user expenses are fetched will change, which may require updates to the frontend to handle the new data fetching strategy. The goal is to make it more robust and complete.

**Risk**: High. This change requires a significant re-evaluation of the data model and query strategy, which can be complex and may impact other parts of the application. Data migration might be necessary.

**Complexity**: High. This change requires a significant re-evaluation of the data model and query strategy, potentially involving new collections or complex query patterns.

**Benefit**: High. This change will significantly improve the scalability and efficiency of fetching user expenses, especially for users with many groups, ensuring all relevant expenses are displayed and the application remains performant as it scales.