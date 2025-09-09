# Firestore Transaction and Atomicity Audit

## 1. Executive Summary

This audit identifies critical gaps in Firestore transaction handling across the application. While foundational tools for transactions exist in `FirestoreWriter`, they are not consistently applied, leading to significant risks of data inconsistency, race conditions, and corrupted state.

The most severe issues are found in service-level operations where multiple, dependent Firestore writes occur without the protection of a transaction. For example, creating an expense does not atomically update the group's metadata, and user-related operations that affect multiple collections are not performed as a single atomic unit.

This report provides a detailed breakdown of all identified issues and a prioritized plan for remediation. The highest priority is to wrap all multi-write service functions in transactions to ensure data integrity.

## 2. Key Findings & Technical Deep Dive

### Finding 1: Lack of Transactional Guarantees in Core Services

Numerous high-level service methods perform multiple distinct write operations that are not wrapped in a transaction. This is the most critical issue, as it leaves the database in an inconsistent state if a subsequent write fails.

**Examples:**

- **`GroupService.deleteGroup`**: This method deletes a group document and then relies on a separate bulk-delete operation for subcollections. If the bulk delete fails, the group is left in a partially deleted state.
- **`ExpenseService.createExpense`**: This method creates an expense document but does not atomically update the group's `lastActivity` or other metadata. The comment "Group metadata/balance updates will be handled by the balance aggregation trigger" indicates a reliance on asynchronous triggers, which can lead to stale data and race conditions.
- **`SettlementService`**: Methods for creating and deleting settlements do not atomically update group-level balances or activity feeds.
- **`UserPolicyService.acceptPolicy`**: This service updates the user document and creates a policy acceptance document in two separate operations. These should be atomic.

### Finding 2: Inconsistent Use of `runTransactionWithRetry`

The `runTransactionWithRetry` helper is a good attempt at standardizing transaction execution, but its use is scattered and not centralized. Several services (`GroupPermissionService`, `GroupShareService`, `SettlementService`) use it, while others (`GroupService`, `ExpenseService`) use the `FirestoreWriter`'s `runTransaction` directly. This inconsistency makes it difficult to enforce a standard transaction policy.

**Recommendation:** Deprecate the standalone `runTransactionWithRetry` helper and move its retry logic directly into the `FirestoreWriter.runTransaction` method. This will provide a single, consistent way to execute transactions with a default retry policy.

### Finding 3: Triggers Performing Non-Atomic Operations

Cloud triggers often perform multiple database writes in response to a single event. If any of these writes fail, the system can be left in an inconsistent state.

**Example:**

- **`change-tracker.ts`**: The `trackExpenseChanges` trigger writes to both the `transaction-changes` and `balance-changes` collections. These two writes should be performed in a single transaction to ensure that both or neither succeed.

### Finding 4: Error Handling in Transactions

Some transaction blocks have `try...catch` blocks that swallow errors or do not properly re-throw them. This can mask underlying issues and prevent the transaction from being correctly rolled back.

**Example:**

- In `FirestoreWriter.ts`, the `bulkCreate`, `bulkUpdate`, and `bulkDelete` methods have a `try...catch` around the loop that adds operations to the batch. If an error occurs while adding an operation, the error is logged, but the `batch.commit()` is still called. This could lead to a partial batch being committed.

### Finding 5: Opportunities for Batch Operations

There are several places in the code where multiple documents are updated or created in a loop. These are prime candidates for using `WriteBatch` to improve performance and reduce the number of individual writes.

**Example:**

- **`UserPolicyService.acceptPolicy`**: If a user accepts multiple policies at once, each acceptance is handled in a separate operation. This could be optimized by using a batch write.

## 3. Remediation Plan

This plan outlines the steps to address the identified issues, prioritized by risk and impact.

### Phase 1: Centralize and Strengthen Transaction Logic (High Priority)

1.  **Deprecate `runTransactionWithRetry`**:
    -   Move the retry logic from `runTransactionWithRetry` into `FirestoreWriter.runTransaction`.
    -   Update all call sites of `runTransactionWithRetry` to use `firestoreWriter.runTransaction` instead.

2.  **Wrap Core Service Operations in Transactions**:
    -   **`GroupService`**:
        -   Refactor `deleteGroup` to perform the group document deletion and the subcollection deletion within a single transaction (or a series of batched transactions if the number of documents is large).
    -   **`ExpenseService`**:
        -   Refactor `createExpense`, `updateExpense`, and `deleteExpense` to atomically update the group document's metadata (e.g., `lastActivity`, `totalExpenses`). This may require moving the trigger-based logic into the service layer.
    -   **`SettlementService`**:
        -   Wrap all settlement creation, update, and deletion operations in transactions that also update the relevant group and user balances.
    -   **`UserPolicyService`**:
        -   Wrap `acceptPolicy` in a transaction that updates the user document and creates the policy acceptance document.

### Phase 2: Harden Triggers and Batch Operations (Medium Priority)

1.  **Make Triggers Transactional**:
    -   Refactor the `change-tracker.ts` trigger to perform its multiple writes within a single transaction.

2.  **Improve Batch Error Handling**:
    -   Refactor the `bulkCreate`, `bulkUpdate`, and `bulkDelete` methods in `FirestoreWriter.ts` to ensure that if any operation fails to be added to the batch, the entire batch is aborted.

### Phase 3: Code Cleanup and Optimization (Low Priority)

1.  **Identify and Implement Batching Opportunities**:
    -   Review the codebase for loops that perform multiple writes and convert them to use `WriteBatch` where appropriate.

## 4. Conclusion

The current state of Firestore transaction handling presents a significant risk to data integrity. By centralizing transaction logic in `FirestoreWriter`, wrapping all multi-write service operations in transactions, and hardening triggers, we can significantly improve the reliability and robustness of the application. This audit provides a clear roadmap for achieving that goal.
