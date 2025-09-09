# Firestore Encapsulation Audit: Direct Database Access Points

## 1. Executive Summary

This audit identifies all instances of direct Firestore database access outside of the `IFirestoreReader` and `IFirestoreWriter` interfaces. The goal of centralizing all Firestore operations within these interfaces is to ensure consistent data validation, error handling, performance monitoring, and maintainability.

The findings indicate widespread direct usage of `getFirestore()` and raw Firestore API calls across various services, triggers, and utility functions. This bypasses the established encapsulation layer, leading to:

*   **Inconsistent Data Handling:** Lack of uniform validation and serialization/deserialization.
*   **Increased Maintenance Overhead:** Changes to data models or Firestore structure require modifications in multiple locations.
*   **Reduced Testability:** Direct database calls make unit testing more complex and reliant on a running Firestore emulator.
*   **Hidden Dependencies:** It's harder to track which parts of the application interact with specific Firestore collections.

This report details each identified instance and recommends its encapsulation within the `IFirestoreReader` or `IFirestoreWriter` interfaces.

## 2. Findings: Direct Firestore Access Points

### 2.1. Services Bypassing Encapsulation

These are core service files that directly interact with Firestore instead of using the `IFirestoreReader` or `IFirestoreWriter` instances injected into them.

#### `firebase/functions/src/services/CommentService.ts`
*   **Issue:** Direct collection access for comments.
*   **Location:**
    *   `L178: return getFirestore().collection(FirestoreCollections.GROUPS).doc(targetId).collection(FirestoreCollections.COMMENTS);`
    *   `L182: return getFirestore().collection(FirestoreCollections.EXPENSES).doc(targetId).collection(FirestoreCollections.COMMENTS);`
*   **Recommendation:** Replace with `firestoreReader.getCommentsForTarget` or `firestoreWriter.addComment`, `updateComment`, `deleteComment`.

#### `firebase/functions/src/services/GroupMemberService.ts`
*   **Issue:** Direct collection access for group members.
*   **Location:**
    *   `L146: const docRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);`
    *   `L147: await docRef.update({...});`
    *   `L231: const docRef2 = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);`
    *   `L232: await docRef2.update({...});`
    *   `L260: const memberRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId).collection('members').doc(memberDoc.userId);`
    *   `L266: await memberRef.set({...});`
    *   `L304: const memberRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId).collection('members').doc(userId);`
    *   `L310: await memberRef.update({...});`
    *   `L331: const memberRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId).collection('members').doc(userId);`
    *   `L337: await memberRef.delete();`
*   **Recommendation:** Use `firestoreReader.getMemberFromSubcollection`, `firestoreWriter.addGroupMember`, `updateGroupMember`, `removeGroupMember`. For group updates, use `firestoreWriter.updateGroup`.

#### `firebase/functions/src/services/GroupService.ts`
*   **Issue:** Initializes a `groupsCollection` property directly and accesses subcollections.
*   **Location:**
    *   `L30: private groupsCollection = getFirestore().collection(FirestoreCollections.GROUPS);`
    *   `L116: const docRef = this.groupsCollection.doc(groupId);` (used for reads, should be `firestoreReader.getGroup`)
    *   `L583: const docRef = this.groupsCollection.doc();` (used for writes, should be `firestoreWriter.createGroup`)
    *   `L617: const memberRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(docRef.id).collection('members').doc(userId);`
*   **Recommendation:** Remove `groupsCollection` property. Use `firestoreReader.getGroup`, `firestoreWriter.createGroup`, `updateGroup`, `deleteGroup`. For member subcollection, use `firestoreReader.getMemberFromSubcollection` or `firestoreWriter.addGroupMemberInTransaction`.

#### `firebase/functions/src/services/GroupShareService.ts`
*   **Issue:** Direct `runTransaction` call and collection access for groups and share links.
*   **Location:**
    *   `L76: await getFirestore().runTransaction(async (transaction) => {`
    *   `L77: const groupRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);`
    *   `L83: const shareLinksRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks');`
    *   `L84: const shareLinkDoc = shareLinksRef.doc();`
    *   `L96: transaction.set(shareLinkDoc, validatedShareLinkData);`
    *   `L193: const memberRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId).collection('members').doc(userId);`
    *   `L219: const groupRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);`
    *   `L236: transaction.set(memberRef, memberDocWithTimestamps);`
*   **Recommendation:** Use `firestoreWriter.runTransaction`. For collection access, use `firestoreReader.getShareLink`, `firestoreWriter.createShareLinkInTransaction`, `firestoreReader.getGroup`, etc.

#### `firebase/functions/src/services/PolicyService.ts`
*   **Issue:** Initializes a `policiesCollection` property directly and performs updates/sets.
*   **Location:**
    *   `L22: private policiesCollection = getFirestore().collection(FirestoreCollections.POLICIES);`
    *   `L241: await this.policiesCollection.doc(id).update(updates);`
    *   `L292: await this.policiesCollection.doc(id).update({...});`
    *   `L374: await this.policiesCollection.doc(id).set(validatedPolicyData);`
    *   `L458: await this.policiesCollection.doc(id).update({...});`
*   **Recommendation:** Remove `policiesCollection` property. Use `firestoreReader.getPolicy`, `firestoreWriter.createPolicy`, `updatePolicy`.

#### `firebase/functions/src/services/SettlementService.ts`
*   **Issue:** Initializes `settlementsCollection`, `usersCollection`, and `groupsCollection` properties directly and performs various operations.
*   **Location:**
    *   `L44: private settlementsCollection = getFirestore().collection(FirestoreCollections.SETTLEMENTS);`
    *   `L45: private usersCollection = getFirestore().collection(FirestoreCollections.USERS);`
    *   `L46: private groupsCollection = getFirestore().collection(FirestoreCollections.GROUPS);`
    *   `L204: const settlementId = this.settlementsCollection.doc().id;`
    *   `L227: await this.settlementsCollection.doc(settlementId).set(validatedSettlement);`
    *   `L251: const settlementRef = this.settlementsCollection.doc(settlementId);`
    *   `L288: updates.note = FieldValue.delete();` (This is a FieldValue, not a direct Firestore operation, but it's part of an update)
    *   `L346: const settlementRef = this.settlementsCollection.doc(settlementId);`
    *   `L381: transaction.delete(settlementRef);`
*   **Recommendation:** Remove these properties. Use `firestoreReader.getSettlement`, `firestoreWriter.createSettlement`, `updateSettlement`, `deleteSettlement`, and corresponding user/group methods from `IFirestoreReader`/`IFirestoreWriter`. For `transaction.delete`, use `firestoreWriter.deleteInTransaction`.

#### `firebase/functions/src/services/UserPolicyService.ts`
*   **Issue:** Initializes `policiesCollection` and `usersCollection` properties directly, and uses `getFirestore().batch()`.
*   **Location:**
    *   `L43: private policiesCollection = getFirestore().collection(FirestoreCollections.POLICIES);`
    *   `L44: private usersCollection = getFirestore().collection(FirestoreCollections.USERS);`
    *   `L82: const userDocRef = this.usersCollection.doc(userId);`
    *   `L83: await userDocRef.update({...});`
    *   `L129: const userDocRef = this.usersCollection.doc(userId);`
    *   `L139: const batch = getFirestore().batch();`
    *   `L140: batch.update(userDocRef, updateData);`
*   **Recommendation:** Remove these properties. Use `firestoreReader.getPolicy`, `firestoreWriter.createPolicy`, `updatePolicy`, and `firestoreReader.getUser`, `firestoreWriter.updateUser`. For batch operations, use `firestoreWriter.batchWrite` or `bulkUpdate`.

#### `firebase/functions/src/services/notification-service.ts`
*   **Issue:** Direct document updates and sets.
*   **Location:**
    *   `L67: await this.db.doc(`user-notifications/${userId}`).update(updates);`
    *   `L70: await this.db.doc(`user-notifications/${userId}`).set(fallbackUpdates, { merge: true });`
    *   `L130: await this.db.doc(`user-notifications/${userId}`).set(documentData);`
    *   `L168: await this.db.doc(`user-notifications/${userId}`).set(groupUpdate, { merge: true });`
    *   `L187: await this.db.doc(`user-notifications/${userId}`).update(removeUpdate);`
*   **Recommendation:** Encapsulate these operations within `IFirestoreWriter` (e.g., `updateUserNotifications`, `setUserNotifications`).

### 2.2. Triggers Bypassing Encapsulation

Cloud Functions triggers that directly interact with Firestore.

#### `firebase/functions/src/triggers/change-tracker.ts`
*   **Issue:** Direct Firestore access for reads and writes.
*   **Location:**
    *   `L13: const firestore = getFirestore();`
    *   `L100: await firestore.collection(FirestoreCollections.TRANSACTION_CHANGES).add(validatedChangeDoc);`
    *   `L101: await firestore.collection(FirestoreCollections.BALANCE_CHANGES).add(validatedBalanceDoc);`
*   **Recommendation:** Use `firestoreReader` and `firestoreWriter` methods. Specifically, `firestoreWriter.bulkCreate` for the change documents.

#### `firebase/functions/src/triggers/notification-triggers.ts`
*   **Issue:** Direct Firestore access for reads and writes.
*   **Location:**
    *   `L23: const firestore = getFirestore();`
    *   `L53: await firestore.collection('user-notifications').doc(user.uid).set({...});`
    *   `L75: await firestore.collection(FirestoreCollections.GROUPS).doc(groupId).collection('members').doc(member.uid).set({...});`
    *   `L108: await firestore.collection(FirestoreCollections.GROUPS).doc(groupId).collection('members').doc(member.uid).delete();`
*   **Recommendation:** Use `firestoreReader` and `firestoreWriter` methods. Specifically, `firestoreWriter.setUserNotifications`, `firestoreWriter.addGroupMember`, `firestoreWriter.removeGroupMember`.

### 2.3. Utility Functions Bypassing Encapsulation

Helper functions that directly interact with Firestore.

#### `firebase/functions/src/utils/firestore-helpers.ts`
*   **Issue:** Direct `runTransaction` call.
*   **Location:**
    *   `L67: const result = await getFirestore().runTransaction(transactionFn);`
*   **Recommendation:** This function (`runTransactionWithRetry`) should be deprecated and its logic moved into `FirestoreWriter.runTransaction` as per the `firestore-transaction-audit.md` report. Once that's done, this direct `getFirestore()` usage will be removed.

#### `firebase/functions/src/utils/optimistic-locking.ts`
*   **Issue:** Direct `transaction.update()` and `transaction.get()` calls.
*   **Location:**
    *   `L26: transaction.update(docRef, {...});`
    *   `L48: freshDoc = await transaction.get(docRef);`
    *   `L61: transaction.update(docRef, {...});`
*   **Recommendation:** This utility function is designed to work within a transaction. The `transaction` object itself is passed in. The `IFirestoreReader` and `IFirestoreWriter` interfaces already provide `getRawDocumentInTransactionWithRef` and `updateInTransaction` methods that should be used here. This would involve passing the `firestoreReader` and `firestoreWriter` instances to this utility function.

#### `firebase/functions/src/utils/pagination.ts`
*   **Issue:** Direct `orderBy()` and `startAfter()` calls on a query object.
*   **Location:**
    *   `L29: const queryWithOrder = baseQuery.orderBy('updatedAt', order).limit(limit);`
    *   `L38: return queryWithOrder.startAfter(cursorTimestamp);`
*   **Recommendation:** This utility builds queries. The `baseQuery` should be obtained from `IFirestoreReader` (e.g., `firestoreReader.getCollectionRef('collectionName')`). The `orderBy` and `startAfter` operations should then be applied to this query object. This is an acceptable pattern for query building utilities, but the initial collection reference should come from the reader.

### 2.4. Scheduled Jobs Bypassing Encapsulation

Background jobs that directly interact with Firestore.

#### `firebase/functions/src/scheduled/cleanup.ts`
*   **Issue:** Direct collection queries and batch deletes.
*   **Location:**
    *   `L23: const firestore = getFirestore();`
    *   `L49: const batch = firestore.batch();`
    *   `L53: batch.delete(doc.ref);`
    *   `L122: await getFirestore().collection('system-metrics').add({...});`
*   **Recommendation:** Use `firestoreReader.getOldDocuments`, `firestoreWriter.bulkDelete`, and `firestoreWriter.addSystemMetrics`.

### 2.5. Test Infrastructure Bypassing Encapsulation

While tests often have more leeway, direct database access in test infrastructure can still be improved for consistency and to demonstrate proper usage of the encapsulated layers.

#### `firebase/functions/src/test-pool/TestUserPoolService.ts`
*   **Issue:** Direct collection access and batch operations.
*   **Location:**
    *   `L81: await getFirestore().collection(POOL_COLLECTION).doc(newUser.email).set({...});`
    *   `L92: const poolRef = getFirestore().collection(POOL_COLLECTION);`
    *   `L157: const batch = getFirestore().batch();`
    *   `L159: batch.update(doc.ref, {...});`
*   **Recommendation:** Encapsulate these operations within `IFirestoreReader` and `IFirestoreWriter` (e.g., `getTestUser`, `updateTestUser`, `bulkUpdate`, `bulkCreate`).

### 2.6. Main Entry Point Direct Access

#### `firebase/functions/src/index.ts`
*   **Issue:** Direct Firestore calls for health checks and status endpoints.
*   **Location:**
    *   `L100: const testRef = firestoreDb.collection('_health_check').doc('test');`
    *   `L101: await testRef.set({ timestamp: createOptimisticTimestamp() }, { merge: true });`
    *   `L102: await testRef.get();`
*   **Recommendation:** Encapsulate these within `IFirestoreReader` and `IFirestoreWriter` (e.g., `firestoreReader.getHealthCheckDocument`, `firestoreWriter.setHealthCheckDocument`). These are infrastructure-level operations, but encapsulating them maintains consistency.

### 2.7. Acceptable `getFirestore()` Usage (Creation Points)

These instances are generally acceptable as they are the points where the `FirestoreReader` or `FirestoreWriter` instances are initialized.

*   `firebase/functions/src/firebase.ts`: The `getFirestore()` export itself.
*   `firebase/functions/src/index.ts`: Where `firestoreDb = getFirestore()` is called and passed to `registerAllServices` (the `firestoreDb` variable is then used in the direct access points above, which are issues).
*   `firebase/functions/src/services/ServiceContainer.ts`: Where `FirestoreReader` and `FirestoreWriter` are instantiated.
*   `firebase/functions/src/services/serviceRegistration.ts`: Where `getFirestoreReader()` and `getFirestoreWriter()` are exposed.
*   `firebase/functions/src/test-pool/handlers.ts`: Where `FirestoreReader` is initialized with `getFirestore()`.
*   `firebase/functions/src/user-management/assign-theme-color.ts`: `const db = getFirestore();` is used, but then `firestoreReader` is also used. The `db` variable is then used for a direct `db.doc(...).update(...)` which should be encapsulated. So this is a mixed case, but the `getFirestore()` call itself is at an initialization point.

## 3. Remediation Plan

The remediation involves systematically replacing all identified direct Firestore access points with calls to the appropriate methods in `IFirestoreReader` or `IFirestoreWriter`.

1.  **Prioritize Core Services:** Start with `CommentService`, `GroupMemberService`, `GroupService`, `GroupShareService`, `PolicyService`, `SettlementService`, `UserPolicyService`, `notification-service.ts`.
2.  **Refactor Triggers:** Address `change-tracker.ts` and `notification-triggers.ts`.
3.  **Encapsulate Utility Functions:** Fix `firestore-helpers.ts` (as part of the transaction audit remediation), `optimistic-locking.ts`, `pagination.ts`.
4.  **Update Scheduled Jobs:** Refactor `scheduled/cleanup.ts`.
5.  **Improve Test Infrastructure:** Encapsulate `test-pool/TestUserPoolService.ts`.
6.  **Encapsulate Main Entry Point Direct Access:** Address `index.ts`.
7.  **Ensure Dependency Injection:** Verify that all services and functions requiring Firestore access receive `IFirestoreReader` and `IFirestoreWriter` instances via dependency injection.

## 4. Conclusion

Encapsulating all Firestore read and write operations within `IFirestoreReader` and `IFirestoreWriter` is crucial for the long-term health and maintainability of the application. This audit provides a clear roadmap for achieving full encapsulation and improving the overall quality of the codebase.