# Firestore Transaction and Atomicity Audit (Updated)

## 1. Executive Summary

This updated audit reviews the state of Firestore transaction handling. While the foundational infrastructure for creating transactions was improved as part of a prior effort, this deep-dive analysis reveals that **critical, multi-step business operations still lack transactional guarantees.**

The most severe issues are found in core service methods that perform multiple dependent database writes without atomicity. Operations like group deletion, group updates with metadata propagation, and even some aspects of group creation are not executed as a single, atomic unit. This exposes the application to significant risks of data inconsistency, race conditions, and corrupted state if any part of the multi-step operation fails.

This report provides a detailed breakdown of the remaining transactional gaps and proposes a stronger architectural pattern to ensure data integrity going forward.

## 2. Key Findings & Technical Deep Dive

### Finding 1: Critical Business Operations Lack Atomicity

This remains the most significant risk. High-level service methods that orchestrate multiple writes often fail to wrap the entire logical operation in a transaction.

**`GroupService.deleteGroup` - CRITICAL**
*   **Issue:** The hard-delete logic discovers all related documents (expenses, members, etc.) and then calls `firestoreWriter.bulkDelete`. This is **not a transaction**. If the `bulkDelete` fails midway, the database will be left in a corrupt, partially-deleted state.
*   **Status:** ❌ **Unresolved & Critical.**
*   **Recommendation:** This is the highest priority to fix. The entire deletion process must be transactional. Given the potential for deleting many documents, this should be re-architected into smaller, idempotent, transactional steps that can be safely retried.

**`GroupService.updateGroup` - CRITICAL**
*   **Issue:** This method updates the main group document and then, in a separate, non-atomic operation, queries and updates all related membership documents to propagate the `groupUpdatedAt` timestamp.
*   **Status:** ❌ **Unresolved & Critical.** A failure during the second step will leave denormalized data out of sync.
*   **Recommendation:** The entire operation—updating the group and all its membership documents—must be performed in a single transaction.

**`GroupService.createGroup` - Minor Issue**
*   **Issue:** The method correctly uses a transaction to create the group and the owner's membership document. However, it follows this with a non-transactional call to `notificationService.addUserToGroupNotificationTracking`. 
*   **Status:** ⚠️ **Partially Resolved.** The core creation is atomic, but a failure in the notification call leaves the state inconsistent (user is in the group but won't receive notifications).
*   **Recommendation:** The notification logic should be part of the main transaction or handled by a reliable, transactional trigger.

**`ExpenseService.createExpense` - Minor Issue**
*   **Issue:** The original audit noted this method didn't atomically update group metadata, relying on triggers instead. The current implementation now uses a transaction to create the expense document itself, which is an improvement.
*   **Status:** ⚠️ **Partially Resolved.** The core expense creation is atomic. However, the comment `// Note: Group metadata/balance updates will be handled by the balance aggregation trigger` confirms that related group-level updates are still not part of the transaction, leading to eventual consistency rather than strong consistency.

### Finding 2: Inconsistent Transaction Usage (Infrastructure Complete)

*   **Issue:** The original audit found inconsistent use of transaction helpers. 
*   **Status:** ✅ **Resolved.** The infrastructure work to consolidate retry logic into `FirestoreWriter.runTransaction` and deprecate the old `runTransactionWithRetry` helper is complete and has been verified. All core services have been migrated to the new pattern.

### Finding 3: Non-Atomic Triggers

*   **Issue:** The `change-tracker.ts` trigger responds to an expense change by calling `notificationService.batchUpdateNotifications` twice—once for `transaction` changes and once for `balance` changes. These are two separate write operations, not one atomic one.
*   **Status:** ❌ **Unresolved.** If the second notification call fails, clients will get an incomplete view of the changes.
*   **Recommendation:** The `NotificationService` should be enhanced to allow updating multiple change types for a group of users in a single, atomic write.

### Finding 4: Batch Operations vs. Transactions

*   **`UserPolicyService.acceptMultiplePolicies`**: This method correctly uses a `batch` write to perform multiple updates to a single document, which is an appropriate and atomic use of batching.
*   **Status:** ✅ **Resolved.** No issue here.

## 3. Architectural Recommendation: The Service Method as a Transaction

The root cause of these issues is that atomicity is not an enforced, architectural concern. Developers are left to decide whether a service method needs a transaction, and for complex operations, the path of least resistance has been to avoid them.

To solve this systematically, we should adopt a new core principle:

> **Every public method in a service class that results in one or more database writes MUST execute the entire logical operation as a single, atomic transaction.**

This moves the responsibility of ensuring atomicity from the caller to the service method itself, making it an intrinsic property of the operation.

### Implementation Strategy

1.  **Enforce the Rule:** Make it a mandatory code review requirement that any service method performing writes is wrapped in `this.firestoreWriter.runTransaction`.
2.  **Refactor Critical Services:** Prioritize refactoring the methods identified in this audit (`deleteGroup`, `updateGroup`) to be fully transactional.
3.  **Handle Complex Deletes:** For `deleteGroup`, the work must be broken down into smaller, idempotent transactional steps. The top-level `deleteGroup` service method will be responsible for orchestrating these steps and ensuring the entire process eventually completes, even if it requires multiple retries.
4.  **Enhance the `IFirestoreWriter`:** Add new methods to the writer interface that are specifically designed for these common, complex, transactional patterns (e.g., `deleteGroupRecursively(groupId)`, `updateGroupAndMembers(...)`). This abstracts the complexity away from the primary service logic.

## 4. Conclusion

The foundation for reliable transactions is in place, but it is not being applied to the most critical and complex business operations. This leaves the application vulnerable to data corruption. By adopting the **"Service Method as a Transaction"** principle and refactoring the key services identified in this audit, we can close these gaps and ensure the integrity and reliability of the application's data.