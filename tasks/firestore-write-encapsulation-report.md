# Task: Encapsulate Firestore Writes into a Centralized Service

## 1. Analysis & Critique

Following the successful analysis for encapsulating Firestore reads, this report details the current state of Firestore **write operations**. The findings confirm that while significant progress has been made on data validation, the write logic itself is highly decentralized, leading to architectural challenges.

### 1.1. Current State

-   **Validation is Present**: Thanks to the `strengthen-firestore-data-validation` initiative, many write operations are preceded by Zod schema validation. This is a major strength.
-   **Decentralized Logic**: Write operations (`.set()`, `.add()`, `.update()`, `.delete()`, `runTransaction()`) are scattered across **over 20 files**, including core services, triggers, and test utilities.
-   **Inconsistent Patterns**: While services are the primary location for writes, logic also exists in triggers and even middleware helpers.
-   **Testing Complexity**: Unit testing services with write logic requires extensive mocking of the entire Firestore client, making tests complex and brittle. Integration tests are heavily reliant on the Firebase emulator.

### 1.2. Architectural Issues

-   **Lack of Encapsulation**: The "how" of writing to Firestore is mixed with the "what" and "why" of the business logic in each service. A change in a write strategy (e.g., adding a history entry for every update) would require changes in many places.
-   **Difficult to Enforce Standards**: It's hard to enforce universal patterns like optimistic locking, standard error handling for writes, or consistent transaction retry logic when the calls are spread throughout the codebase.
-   **Poor Testability**: Services are not easily unit-testable in isolation. Developers must mock `firestoreDb.collection().doc().set()` and other chained calls, which is cumbersome.

## 2. Proposed Architecture: `IFirestoreWriter`

To solve these issues, we will create a `FirestoreWriter` service, mirroring the `FirestoreReader` pattern. This service will be the **only** component in the application allowed to perform write operations.

### 2.1. Core Interface Design

```typescript
// Location: firebase/functions/src/services/firestore/IFirestoreWriter.ts

import { z } from 'zod';
import { firestore } from 'firebase-admin';

export interface IFirestoreWriter {
    /**
     * Creates a new document with a specified ID.
     * @param collectionPath The path to the collection.
     * @param docId The ID of the document to create.
     * @param data The data to write, which will be validated against the schema.
     * @param schema The Zod schema to validate the data.
     */
    create<T>(collectionPath: string, docId: string, data: T, schema: z.ZodSchema<T>): Promise<void>;

    /**
     * Creates a new document with an auto-generated ID.
     * @param collectionPath The path to the collection.
     * @param data The data to write, which will be validated against the schema.
     * @param schema The Zod schema to validate the data.
     * @returns The ID of the newly created document.
     */
    add<T>(collectionPath: string, data: T, schema: z.ZodSchema<T>): Promise<string>;

    /**
     * Updates an existing document.
     * @param collectionPath The path to the collection.
     * @param docId The ID of the document to update.
     * @param updates The partial data to update.
     * @param schema A Zod schema for the partial update data.
     */
    update<T>(collectionPath: string, docId: string, updates: Partial<T>, schema: z.ZodSchema<Partial<T>>): Promise<void>;

    /**
     * Deletes a document.
     * @param collectionPath The path to the collection.
     * @param docId The ID of the document to delete.
     */
    delete(collectionPath: string, docId: string): Promise<void>;

    /**
     * Runs a Firestore transaction.
     * @param updateFunction The function to execute within the transaction.
     * It receives a transaction object that provides write methods.
     */
    runTransaction<T>(
        updateFunction: (transaction: firestore.Transaction) => Promise<T>
    ): Promise<T>;

    /**
     * Creates a new batch write operation.
     */
    batch(): firestore.WriteBatch;
}
```

### 2.2. Implementation Highlights (`FirestoreWriter.ts`)

-   **Validation First**: Every `create`, `add`, and `update` call will first validate the incoming data against the provided Zod schema before sending it to Firestore.
-   **Centralized Error Handling**: Provides a single place to implement standardized error logging and handling for all write operations.
-   **ServiceRegistry Integration**: Will be registered with the `ServiceRegistry` and injected into other services, just like `FirestoreReader`.

### 2.3. Mock Implementation for Testing (`MockFirestoreWriter.ts`)

-   A full mock implementation with `vi.fn()` for each method.
-   This will allow for simple, fast, and reliable unit tests for services, asserting that the service calls the writer with the correct data, without needing the emulator.

## 3. Comprehensive File Analysis

The following files contain direct Firestore write operations and will need to be refactored to use the new `FirestoreWriter` service.

### Core Services (9 files)

-   `services/UserService2.ts`: `update`, `delete`, `set` for user profiles.
-   `services/GroupService.ts`: `set`, `delete`, `add` within transactions for groups and members.
-   `services/ExpenseService.ts`: `set`, `update` within transactions for expenses.
-   `services/SettlementService.ts`: `set`, `delete` for settlements.
-   `services/GroupMemberService.ts`: `update`, `set`, `delete` for group members.
-   `services/GroupPermissionService.ts`: `update` for group permissions within transactions.
-   `services/GroupShareService.ts`: `set` for share links within transactions.
-   `services/PolicyService.ts`: `update`, `set` for policies.
-   `services/UserPolicyService.ts`: `update`, `batch` for user policy acceptances.
-   `services/CommentService.ts`: `add` for comments.

### Triggers (1 file)

-   `triggers/change-tracker.ts`: `add` for creating change documents. This is a critical location for ensuring data consistency.

### Scheduled Functions (1 file)

-   `scheduled/cleanup.ts`: `batch` and `add` for cleaning up old data and creating system metrics.

### Test Utilities (1 file)

-   `test-pool/TestUserPoolService.ts`: `update`, `set` for managing the test user pool. Refactoring this will simplify test setup.

### Utility/Helper Files (2 files)

-   `utils/firestore-helpers.ts`: `runTransaction` wrapper.
-   `utils/optimistic-locking.ts`: `update` calls within transactions.

## 4. Detailed Implementation Plan

This plan follows the successful incremental approach used for the `FirestoreReader`.

### Phase 1: Foundation (2 days)

1.  **Create Interfaces & Types**: Define `IFirestoreWriter` and any supporting types.
2.  **Implement `FirestoreWriter`**: Create the concrete implementation that interacts with the actual Firestore database. Include Zod validation in all write methods.
3.  **Implement `MockFirestoreWriter`**: Create the mock version for testing, with `vi.fn()` spies for each method.
4.  **Integrate with ServiceRegistry**: Register the `FirestoreWriter` and make it available via `getFirestoreWriter()`.
5.  **Write Unit Tests**: Create a comprehensive unit test suite for the `FirestoreWriter` itself to ensure it behaves as expected.

### Phase 2: Service Migration (5-7 days)

Migrate services one by one. For each service:

1.  **Inject Dependency**: Update the service's constructor and the `ServiceRegistry` to inject `IFirestoreWriter`.
2.  **Refactor Write Calls**: Replace all direct `firestoreDb` write calls with the corresponding `firestoreWriter` method (e.g., `firestoreDb.collection(...).add(...)` becomes `this.writer.add(...)`).
3.  **Update Unit Tests**: Modify the service's unit tests to use the `MockFirestoreWriter`. Instead of mocking Firestore calls, simply assert that the service calls the mock writer with the correct arguments.

**Migration Order (Risk-based):**
1.  `PolicyService` & `UserPolicyService` (Low complexity)
2.  `CommentService` & `GroupShareService` (Low complexity)
3.  `UserService2` (Medium complexity)
4.  `SettlementService` (Medium complexity)
5.  `ExpenseService` (High complexity, transactions)
6.  `GroupMemberService` & `GroupPermissionService` (High complexity, transactions)
7.  `GroupService` (Highest complexity, transactions)

### Phase 3: Triggers & Utilities Migration (2 days)

1.  **Refactor `change-tracker.ts`**: This is a high priority. Inject or retrieve the `firestoreWriter` and replace the `add` calls.
2.  **Refactor `optimistic-locking.ts`**: This utility will likely need to be absorbed into the `FirestoreWriter`'s `update` method to standardize the pattern.
3.  **Refactor `scheduled/cleanup.ts`**: Update the batch operations to use the writer.

### Phase 4: Testing & Cleanup (2 days)

1.  **Migrate Integration Tests**: Update any integration tests that perform direct writes to use the writer or appropriate service methods.
2.  **Cleanup**: Search the codebase for any remaining instances of direct `firestoreDb` write calls and remove them.
3.  **Documentation**: Update development guides to mandate the use of `FirestoreReader` and `FirestoreWriter`.

## 5. Success Metrics

-   **Code Quality**: Zero instances of `.add()`, `.set()`, `.update()`, or `.delete()` outside of `FirestoreWriter.ts`.
-   **Testability**: Unit tests for services no longer need to mock Firestore; they can use `MockFirestoreWriter`. Test setup will be simpler and execution faster.
-   **Data Integrity**: All data written to Firestore is guaranteed to be schema-validated, reducing the chance of data corruption.
-   **Maintainability**: Write logic is centralized, making it easier to manage, debug, and apply cross-cutting changes.
