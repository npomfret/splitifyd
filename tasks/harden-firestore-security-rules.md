# CRITICAL TASK: Harden Firestore Security & Data Integrity

## 1. Overview

This document covers two critical, related security issues. The first is the lack of strict, production-grade Firestore security rules. The second, discovered during a deep-dive audit, is a systemic lack of data validation before Firestore write operations, creating a significant risk of data corruption.

This report details the status of both issues and provides a comprehensive remediation plan.

---

## 2. Part 1: Production Security Rules

### 2.1. The Problem: Lack of Defense-in-Depth

The current Firestore rules (`firestore.rules`) are intentionally permissive (`allow read, write: if request.auth != null;`) to simplify local development. This is not safe for production, as it places all security enforcement on the backend logic and removes the database's own layer of defense.

### 2.2. Current Status (As of September 2025)

**Status: Not Started**

An audit of the current configuration confirms this task has not been implemented.

1.  **No Production Rules File:** The `firebase/` directory does not contain the recommended `firestore.prod.rules` file.
2.  **`firebase.json` Not Updated:** The configuration file has not been updated with a `targets` block to specify different rules for production.

**Conclusion:** The project is currently configured to use permissive, development-only security rules in all environments. This needs to be remediated urgently.

### 2.3. The Solution: Environment-Specific Rules

1.  **Create `firestore.prod.rules`:** This file must contain strict rules that mirror the backend authorization logic (e.g., only group members can read group data, only expense participants can read expense data, etc.).
2.  **Update `firebase.json`:** Add a `targets` block to the `firestore` configuration to point to the new production rules file for production deployments.
3.  **Update Deployment Workflow:** The production CI/CD pipeline must be updated to deploy the production-specific rules (`firebase deploy --only firestore:rules:prod`).

---

## 3. Part 2: Data Integrity & Write Validation

### 3.1. The Problem: Unguarded Firestore Writes

A deep-dive audit of the entire codebase revealed that **Firestore write operations are not consistently validated against data schemas.** This creates a high risk of data corruption, as malformed or incomplete data can be written to the database, both from the API and from internal developer actions.

### 3.2. Key Findings

#### Finding 1: Architectural Flaw in `FirestoreWriter`

The `FirestoreWriter` service is the ideal place to enforce data validation. While it correctly uses Zod schemas for `create` methods, it **fails to perform any validation for `update` methods**. Methods like `updateUser` and `updateGroup` blindly accept a partial `updates` object and write it to the database. This is a major vulnerability.

#### Finding 2: Widespread Bypassing of the Encapsulation Layer

Multiple services and utilities bypass the `FirestoreWriter` entirely and call `getFirestore().collection(...).update()` or `.set()` directly. These direct writes have no schema validation.

**Unguarded Write Operations Found In:**

*   **`services/GroupMemberService.ts`**: Performs direct `.update()` calls to update group timestamps.
*   **`services/UserPolicyService.ts`**: Directly updates user documents and creates its own batches.
*   **`services/PolicyService.ts`**: Still contains a private `policiesCollection` and calls `.update()` and `.set()` on it directly.
*   **`scheduled/cleanup.ts`**: Uses `getFirestore()` to create batches and add metrics directly.
*   **`test-pool/TestUserPoolService.ts`**: Contains numerous direct `.set()` and `.update()` calls.
*   **`user-management/assign-theme-color.ts`**: Uses a direct `transaction.set()` call.
*   **`utils/optimistic-locking.ts`**: Contains direct `transaction.update()` calls.

### 3.3. The Solution: Enforce Schema Validation on All Writes

1.  **Harden the `FirestoreWriter` (Highest Priority):**
    *   Modify every `update` method in `IFirestoreWriter` and `FirestoreWriter.ts`.
    *   These methods must fetch the existing document, merge the requested updates with the existing data, and then validate the *entire resulting object* against the relevant Zod schema (e.g., `UserDocumentSchema`, `GroupDocumentSchema`) before performing the write.
    *   The `updateUserNotification` method's special case for `FieldValue` operations must be re-evaluated and made safe.

2.  **Eliminate All Direct Writes:**
    *   Systematically refactor every file identified in this audit.
    *   Replace all direct `.set()`, `.update()`, and `.add()` calls with the appropriate (and newly hardened) method from the `FirestoreWriter` service.
    *   Ensure all services and functions receive the `FirestoreWriter` via dependency injection.

## 4. Overall Conclusion

The project currently faces two significant, related risks: a lack of database-level security rules and a lack of application-level data validation on writes. Remediating both is critical. Enforcing strict production security rules provides defense-in-depth against unauthorized access, while enforcing schema validation on all writes ensures the integrity and correctness of the data itself.
