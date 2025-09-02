# Optimisation and Indexing Report

## 1. Overview

This report details findings from a review of the `firebase/functions` codebase, focusing on two key areas: Firestore transaction optimizations and Firestore query indexing requirements. The goal is to improve the performance, scalability, and reliability of the backend services.

## 2. Transaction Optimisations

A potential race condition was identified in the `GroupPermissionService`.

### Issue: Missing Transactions in `GroupPermissionService`

-   **Files Affected**: `firebase/functions/src/services/GroupPermissionService.ts`
-   **Methods**: `_applySecurityPreset`, `_updateGroupPermissions`, `_setMemberRole`

**Problem**: These methods currently perform a "read-then-write" operation without wrapping the logic in a Firestore transaction. For example, they fetch a group document, check permissions, and then write updates back to the document. If two users (e.g., two admins) perform one of these actions concurrently, one of the updates could be overwritten and lost.

**Example (`_setMemberRole`):**
1.  Admin A reads the group document.
2.  Admin B reads the same group document.
3.  Admin A updates a member's role and writes the changes.
4.  Admin B, holding the old document state, updates a different member's role and writes the changes, inadvertently overwriting Admin A's update.

**Recommendation**:
Refactor these methods to use Firestore transactions with optimistic locking. This involves:
1.  Wrapping the read and write operations in `firestoreDb.runTransaction()`.
2.  Reading the document's `updatedAt` timestamp at the beginning of the transaction.
3.  Before writing, re-reading the document and comparing the current `updatedAt` timestamp with the original one. If they don't match, the transaction should fail, preventing the overwrite.

This pattern is already successfully implemented in `ExpenseService.ts` and `SettlementService.ts` and should be applied here for consistency and data integrity.

## 3. Firestore Query Indexing

Several complex queries were identified that will require composite indexes in Firestore to function correctly and performantly in a production environment. The Firebase Emulator typically logs warnings for missing indexes, but they are documented here for clarity and action.

### 3.1. CRITICAL: User Group Membership Query

-   **Service**: `UserService2.ts`
-   **Method**: `listGroups`
-   **Query**: `firestoreDb.collection('groups').where('members.<userId>', '!=', null)`
-   **Problem**: This query is a major scalability bottleneck. It requires a unique composite index for every single user in the system. This will quickly exceed Firestore's index limits and is not a viable long-term solution.
-   **Recommendation**: **This requires immediate attention.** The architecture must be migrated to use a `members` subcollection under each group, as detailed in the `tasks/firestore-membership-query-scalability.md` document. This will allow for a single, scalable `collectionGroup` index.

### 3.2. Expense Queries

-   **Service**: `ExpenseService.ts`
-   **Method**: `listGroupExpenses`
-   **Query**: `.where('groupId', '==', ...).where('deletedAt', '==', null).orderBy('date', 'desc').orderBy('createdAt', 'desc')`
-   **Index Required**: A composite index on the `expenses` collection:
    - `groupId` (Ascending)
    - `deletedAt` (Ascending)
    - `date` (Descending)
    - `createdAt` (Descending)

-   **Service**: `ExpenseService.ts`
-   **Method**: `listUserExpenses`
-   **Query**: `.where('participants', 'array-contains', ...).where('deletedAt', '==', null).orderBy('date', 'desc').orderBy('createdAt', 'desc')`
-   **Index Required**: A composite index on the `expenses` collection:
    - `participants` (Array)
    - `deletedAt` (Ascending)
    - `date` (Descending)
    - `createdAt` (Descending)

### 3.3. Settlement Query

-   **Service**: `SettlementService.ts`
-   **Method**: `listSettlements`
-   **Query**: Can combine `groupId`, `participants` (array-contains), and a `date` range with ordering.
-   **Index Required**: A composite index on the `settlements` collection to support the most common filtering combination:
    - `groupId` (Ascending)
    - `participants` (Array)
    - `date` (Descending)

### 3.4. Share Link Query

-   **Service**: `GroupShareService.ts`
-   **Method**: `findShareLinkByToken`
-   **Query**: `collectionGroup('shareLinks').where('token', '==', ...).where('isActive', '==', true)`
-   **Index Required**: A `collectionGroup` index on the `shareLinks` subcollection:
    - `token` (Ascending)
    - `isActive` (Ascending)

## 4. Next Steps

1.  **High Priority**: Begin implementation of the member subcollection architecture to resolve the critical scalability issue in `UserService2`.
2.  **Medium Priority**: Refactor `GroupPermissionService` to use Firestore transactions for all write operations.
3.  **Low Priority**: Add the required composite indexes for the expense, settlement, and share link queries to `firestore.indexes.json` to ensure they are deployed to production.
