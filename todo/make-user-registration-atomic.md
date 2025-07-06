# Make User Registration Atomic

**Problem**: The `register` handler in `firebase/functions/src/auth/handlers.ts` is not atomic. It first creates a user in Firebase Authentication (`admin.auth().createUser`) and then attempts to create a corresponding user document in Firestore (`firestore.collection('users').doc(userRecord.uid).set`). If the Firestore document creation fails for any reason (e.g., network error, Firestore rule violation), the user is left in an inconsistent state: an authentication record exists, but there is no corresponding user document in the database. This can lead to orphaned user accounts and data integrity issues.

**File**: `firebase/functions/src/auth/handlers.ts`

**Suggested Solution**:
1. **Use a Firestore Transaction**: Wrap both the user creation (if possible within a transaction, or handle its rollback) and the Firestore document creation within a Firestore transaction. Transactions ensure that all operations within them either succeed completely or fail completely, maintaining data consistency.
2. **Implement Rollback for Auth User**: If the Firestore document creation fails (even within a transaction), ensure that the Firebase Authentication user created in the first step is also deleted. Firebase Admin SDK provides `admin.auth().deleteUser(uid)` for this purpose. This ensures that no orphaned authentication records are left behind.
3. **Error Handling**: Ensure robust error handling to catch any failures during either step and trigger the appropriate rollback.

**Behavior Change**: This is a behavior change. The user registration process will now be atomic, meaning a user is either fully registered (Auth + Firestore document) or not registered at all. This prevents users from being left in an inconsistent state.

**Risk**: Low. This change is primarily about data integrity and consistency. While implementing transactions requires careful coding, the risk of introducing new bugs to the core functionality is low if done correctly.

**Complexity**: Medium. This change requires modifying the user registration logic to use a Firestore transaction and handle potential rollbacks for the Firebase Auth user, which adds some complexity to the flow.

**Benefit**: High. This change will make the user registration process significantly more robust, prevent data inconsistencies, and improve the overall data integrity of the application.