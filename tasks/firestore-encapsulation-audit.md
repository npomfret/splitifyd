# Firestore Encapsulation Audit: Remaining Issues

## 1. Executive Summary

This updated audit reviews the progress of Firestore encapsulation since the original report. The goal remains to centralize all Firestore operations within the `IFirestoreReader` and `IFirestoreWriter` interfaces to ensure consistent data handling, maintainability, and testability.

**Findings as of September 2025:**

*   **Significant Progress on Reads:** There has been excellent progress in refactoring services to use `IFirestoreReader` for read operations. This has improved consistency and centralized read logic.
*   **Writes Remain a Major Issue:** The primary remaining challenge is the widespread direct use of Firestore for write operations. Direct calls to `.set()`, `.update()`, `.add()`, `.delete()`, `getFirestore().runTransaction()`, and `getFirestore().batch()` are still common, bypassing the `IFirestoreWriter` encapsulation layer.
*   **Original Audit Still Relevant:** While the codebase has evolved, the fundamental encapsulation problem persists. Most of the originally identified files still contain violations, primarily related to writes.

This report details the current status of each previously identified issue and provides updated recommendations.

## 2. Findings: Direct Firestore Access Points

### 2.1. Services Bypassing Encapsulation

#### `firebase/functions/src/services/CommentService.ts`
*   **Status:** Partially Resolved
*   **Issue:** The service now uses `IFirestoreReader` for reads, but still uses `getFirestore()` to get collection references for creating comments.
*   **Location:**
    *   `L182: return getFirestore().collection(...)`
*   **Recommendation:** Refactor `createComment` to use `firestoreWriter.addComment` instead of constructing a collection reference directly.

#### `firebase/functions/src/services/GroupMemberService.ts`
*   **Status:** Partially Resolved
*   **Issue:** The service uses `IFirestoreReader` for most reads, but still contains numerous direct `getFirestore()` calls for updates, sets, and deletes, particularly for updating group timestamps and managing member documents.
*   **Location:**
    *   `L146: const docRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);`
    *   `L231: const docRef2 = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);`
    *   `L270: const topLevelRef = getFirestore().collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc(topLevelDocId);`
*   **Recommendation:** Replace all direct write/update/delete operations with their `IFirestoreWriter` equivalents (e.g., `firestoreWriter.updateGroup`, `firestoreWriter.createGroupMember`, `firestoreWriter.deleteGroupMember`).

#### `firebase/functions/src/services/GroupService.ts`
*   **Status:** Unresolved
*   **Issue:** Still initializes a private `groupsCollection` property and uses it for creating the group document reference. While it now uses `IFirestoreWriter` for transactions, the initial setup is a violation.
*   **Location:**
    *   `L33: private groupsCollection = getFirestore().collection(FirestoreCollections.GROUPS);`
    *   `L587: const docRef = this.groupsCollection.doc();`
*   **Recommendation:** Remove the `groupsCollection` property. The `docRef` can be created within the `firestoreWriter.runTransaction` block, and the writer should handle the creation.

#### `firebase/functions/src/services/GroupShareService.ts`
*   **Status:** Unresolved
*   **Issue:** Still uses `getFirestore().runTransaction` directly instead of the encapsulated `firestoreWriter.runTransaction`. It also accesses collections directly within the transaction callback.
*   **Location:**
    *   `L88: await getFirestore().runTransaction(async (transaction) => {`
*   **Recommendation:** Replace the direct `getFirestore().runTransaction` call with `firestoreWriter.runTransaction`. Pass the `firestoreWriter` and `firestoreReader` into the transaction callback to handle reads and writes.

#### `firebase/functions/src/services/PolicyService.ts`
*   **Status:** Unresolved
*   **Issue:** Still initializes and uses a private `policiesCollection` property for all write operations (`.update()`, `.set()`).
*   **Location:**
    *   `L25: private policiesCollection = getFirestore().collection(FirestoreCollections.POLICIES);`
    *   Multiple calls like `this.policiesCollection.doc(id).update(updates);`
*   **Recommendation:** Remove the `policiesCollection` property. Replace all `.update()` and `.set()` calls with `firestoreWriter.updatePolicy` and `firestoreWriter.createPolicy`.

#### `firebase/functions/src/services/SettlementService.ts`
*   **Status:** Unresolved
*   **Issue:** Still initializes and uses a private `settlementsCollection` for write operations.
*   **Location:**
    *   `L45: private settlementsCollection = getFirestore().collection(FirestoreCollections.SETTLEMENTS);`
    *   `L248: const settlementId = this.settlementsCollection.doc().id;`
    *   `L265: await this.settlementsCollection.doc(settlementId).set(validatedSettlement);`
*   **Recommendation:** Remove the `settlementsCollection` property. Use `firestoreWriter.createSettlement` for new documents.

#### `firebase/functions/src/services/UserPolicyService.ts`
*   **Status:** Unresolved
*   **Issue:** Still initializes private `policiesCollection` and `usersCollection` properties. It also creates its own write batches using `getFirestore().batch()`.
*   **Location:**
    *   `L43: private policiesCollection = getFirestore().collection(FirestoreCollections.POLICIES);`
    *   `L44: private usersCollection = getFirestore().collection(FirestoreCollections.USERS);`
    *   `L83: await userDocRef.update({...});`
    *   `L139: const batch = getFirestore().batch();`
*   **Recommendation:** Remove the private collection properties. Use `firestoreWriter.updateUser` and `firestoreWriter.batchWrite` instead of creating batches manually.

### 2.2. Triggers Bypassing Encapsulation

#### `firebase/functions/src/triggers/change-tracker.ts`
*   **Status:** Partially Resolved
*   **Issue:** The trigger has been improved to use the `NotificationService` (which is properly encapsulated). However, it still initializes its own `firestore`, `firestoreReader`, and `firestoreWriter` instances at the module level instead of receiving them via a proper dependency injection container.
*   **Location:**
    *   `L15: const firestore = getFirestore();`
*   **Recommendation:** Refactor triggers to receive service instances from a centralized container, similar to how API handlers do.

#### `firebase/functions/src/triggers/notification-triggers.ts`
*   **Status:** Partially Resolved
*   **Issue:** Similar to `change-tracker`, this trigger correctly uses the `NotificationService`. However, the `cleanupUserNotifications` function contains a strange pattern of re-importing and re-creating the `FirestoreWriter` inside the function body.
*   **Location:**
    *   `L140: const { FirestoreWriter } = await import('../services/firestore/FirestoreWriter');`
*   **Recommendation:** Standardize dependency management for triggers to avoid module-level or inline instantiation of services.

### 2.3. Utility Functions Bypassing Encapsulation

#### `firebase/functions/src/utils/firestore-helpers.ts`
*   **Status:** Unresolved
*   **Issue:** The deprecated `runTransactionWithRetry` function still exists and calls `getFirestore()` directly.
*   **Location:**
    *   `L67: const result = await getFirestore().runTransaction(transactionFn);`
*   **Recommendation:** Aggressively deprecate and remove this function. All usages should be replaced with `firestoreWriter.runTransaction`, which has this retry logic built-in.

#### `firebase/functions/src/utils/optimistic-locking.ts`
*   **Status:** Partially Resolved
*   **Issue:** The `checkAndUpdateWithTimestamp` function was improved to optionally accept a `firestoreReader`, which is good. However, it still contains a fallback to use `transaction.get()` directly.
*   **Recommendation:** Remove the fallback logic. Mandate that the `firestoreReader` is always passed in and used.

### 2.4. Scheduled Jobs Bypassing Encapsulation

#### `firebase/functions/src/scheduled/cleanup.ts`
*   **Status:** Unresolved
*   **Issue:** Still uses `getFirestore()` directly to create batch operations for deletes and to write system metrics.
*   **Location:**
    *   `L28: const firestore = getFirestore();`
    *   `L55: const batch = firestore.batch();`
    *   `L122: await getFirestore().collection('system-metrics').add({...});`
*   **Recommendation:** Inject `IFirestoreWriter` and use `firestoreWriter.bulkDelete` and `firestoreWriter.addSystemMetrics`.

### 2.5. Test Infrastructure Bypassing Encapsulation

#### `firebase/functions/src/test-pool/TestUserPoolService.ts`
*   **Status:** Unresolved
*   **Issue:** Contains multiple direct `getFirestore()` calls for creating users and resetting the pool.
*   **Location:**
    *   `L81: await getFirestore().collection(POOL_COLLECTION).doc(newUser.email).set({...});`
    *   `L157: const batch = getFirestore().batch();`
*   **Recommendation:** Encapsulate these operations within `IFirestoreWriter` methods (e.g., `createTestUser`, `resetTestUserPool`).

### 2.6. Main Entry Point Direct Access

#### `firebase/functions/src/index.ts`
*   **Status:** Unresolved
*   **Issue:** The `/health` check endpoint still accesses Firestore directly to perform a test read/write.
*   **Location:**
    *   `L100: const testRef = firestoreDb.collection('_health_check').doc('test');`
*   **Recommendation:** Encapsulate this logic into `firestoreReader.getHealthCheckDocument` and `firestoreWriter.setHealthCheckDocument`.

### 2.7. Other Direct Access

#### `firebase/functions/src/user-management/assign-theme-color.ts`
*   **Status:** Unresolved
*   **Issue:** Directly uses `getFirestore()` and calls the deprecated `runTransactionWithRetry` helper.
*   **Location:**
    *   `L6: const firestore = getFirestore();`
*   **Recommendation:** Refactor to use `firestoreWriter.runTransaction` and receive dependencies via injection.

## 3. Remediation Plan (Updated)

The primary goal is now to enforce the use of `IFirestoreWriter` for all write operations.

1.  **Prioritize Core Services:** The highest priority is refactoring the core services that still perform direct writes:
    *   `PolicyService.ts`
    *   `SettlementService.ts`
    *   `UserPolicyService.ts`
    *   `GroupService.ts`
    *   `GroupShareService.ts`
2.  **Remove Deprecated Helpers:** Eliminate `utils/firestore-helpers.ts` and refactor all call sites to use `firestoreWriter.runTransaction`.
3.  **Refactor Scheduled Jobs & Triggers:** Update `cleanup.ts`, `change-tracker.ts`, and `notification-triggers.ts` to use injected writer instances.
4.  **Clean Up Remaining Files:** Address the remaining violations in `index.ts`, `test-pool`, and `user-management`.

## 4. Conclusion (Updated)

Excellent progress has been made on encapsulating read operations. The project is now at a critical juncture where enforcing the use of `IFirestoreWriter` will complete the encapsulation effort. This will yield significant benefits in code consistency, testability, and long-term maintainability. This updated audit provides a clear and focused roadmap to achieve that goal.