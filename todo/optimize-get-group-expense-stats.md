# Optimize getGroupExpenseStats Firestore Queries

**Problem**: The `getGroupExpenseStats` function in `firebase/functions/src/documents/handlers.ts` is responsible for fetching expense statistics for a given group. It currently makes two separate Firestore queries: one to get the count of expenses (`.count()`) and another to get the last expense (`.orderBy('createdAt', 'desc').limit(1)`). This results in unnecessary reads and can impact performance, especially for frequently accessed groups or when this function is called in a loop.

**File**: `firebase/functions/src/documents/handlers.ts`

**Suggested Solution**:
1. **Combine Queries**: If both the count and the last expense are always needed, it might be possible to combine these into a single query. For example, fetch the last expense and then use a separate aggregation query for the count. However, a more efficient approach might be to denormalize the `expenseCount` and `lastExpenseTime` directly onto the group document itself, updating these fields whenever an expense is added, updated, or deleted within that group. This would turn two reads into a single read of the group document.
2. **Use Aggregation Queries (if applicable)**: Firestore now supports aggregation queries (e.g., `.count()`). If only the count is needed, this is the most efficient way to get it, as it's optimized by Firestore and doesn't read individual documents.
3. **Denormalization**: For frequently accessed aggregate data (like counts or last updated timestamps), denormalizing this information onto the parent document (the group document in this case) is often the most performant solution in Firestore. This involves updating the group document whenever an expense is created, updated, or deleted.

**Behavior Change**: This is a pure refactoring with no behavior change in the external functionality. The application's behavior will remain the same, but the underlying data fetching mechanism will be more efficient.

**Risk**: Low. The changes are localized to the `getGroupExpenseStats` function. If denormalization is chosen, careful implementation of triggers or batch writes is needed to ensure data consistency.

**Complexity**: Low to Medium. Combining queries is low complexity. Implementing denormalization (e.g., with Cloud Functions triggers) is medium complexity.

**Benefit**: High. This change will significantly reduce the number of Firestore reads, improve the performance of fetching group expense statistics, and potentially lower Firebase costs, especially under high load.