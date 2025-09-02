# Task: Encapsulate Firestore Reads into a Centralized Service

## 1. Overview

This document outlines a plan to refactor all Firestore read operations into a single, encapsulated service. Currently, Firestore queries (`.get()`, `.where()`, etc.) are scattered throughout the `firebase/functions` codebase, including in services, handlers, and helper utilities. This tight coupling to the Firestore implementation makes the code difficult to test, maintain, and reason about.

The proposed solution is to introduce a `FirestoreReader` service with a corresponding `IFirestoreReader` interface. This will centralize all read logic, decouple the business logic from the database implementation, and significantly simplify testing by allowing for easy mocking.

## 2. Proposed Architecture

### 2.1. `IFirestoreReader` Interface

An interface will define the contract for all Firestore read operations. This promotes dependency inversion and allows for easy mocking in tests.

```typescript
// Example Interface
interface IFirestoreReader {
    // Document reads
    getUser(userId: string): Promise<User | null>;
    getGroup(groupId: string): Promise<Group | null>;
    getExpense(expenseId: string): Promise<Expense | null>;
    getSettlement(settlementId: string): Promise<Settlement | null>;
    getPolicy(policyId: string): Promise<Policy | null>;

    // Collection reads
    getGroupsForUser(userId: string): Promise<Group[]>;
    getExpensesForGroup(groupId: string, options?: { limit?: number, offset?: number }): Promise<Expense[]>;
    getSettlementsForGroup(groupId: string): Promise<Settlement[]>;
    getCommentsForTarget(target: { type: 'group' | 'expense', id: string }): Promise<Comment[]>;
    getActiveShareLinkByToken(token: string): Promise<ShareLink | null>;

    // Real-time listeners
    listenToGroupChanges(groupId: string, callback: (group: Group) => void): () => void; // Returns an unsubscribe function
}
```

### 2.2. `FirestoreReader` Implementation

This class will implement the `IFirestoreReader` interface and contain all the actual Firestore SDK calls.

```typescript
class FirestoreReader implements IFirestoreReader {
    // ... implementation of all interface methods
    public async getGroup(groupId: string): Promise<Group | null> {
        const groupDoc = await firestoreDb.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) {
            return null;
        }
        // IMPORTANT: Includes validation via Zod schemas
        return GroupSchema.parse({ id: groupDoc.id, ...groupDoc.data() });
    }
    // ... other methods
}
```

### 2.3. `MockFirestoreReader` for Testing

A mock implementation will be used in unit and integration tests, allowing us to simulate any database state without needing a live Firestore instance.

```typescript
class MockFirestoreReader implements IFirestoreReader {
    // Mock implementations using jest.fn() or similar
    public getUser = jest.fn();
    public getGroup = jest.fn();
    // ... etc.

    // Helper to reset all mocks before each test
    public reset() {
        this.getUser.mockReset();
        this.getGroup.mockReset();
    }
}
```

## 3. Analysis of Existing Queries

The following is a non-exhaustive list of locations that will require refactoring.

| File | Function / Logic | Example Query | Refactored Call (Example) |
| --- | --- | --- | --- |
| `services/UserService2.ts` | `getUser`, `getUsers` | `firestoreDb.collection('users').doc(userId).get()` | `firestoreReader.getUser(userId)` |
| `services/UserService2.ts` | `listGroups` | `firestoreDb.collection('groups').where(\`members.\${userId}\
`, '!=', null).get()` | `firestoreReader.getGroupsForUser(userId)` |
| `services/GroupService.ts` | `getGroup` | `this.getGroupsCollection().doc(groupId).get()` | `firestoreReader.getGroup(groupId)` |
| `services/GroupService.ts` | `listGroups` | `this.getGroupsCollection().where('members', 'array-contains', userId).get()` | `firestoreReader.getGroupsForUser(userId)` |
| `services/ExpenseService.ts` | `getExpense` | `this.expensesCollection.doc(expenseId).get()` | `firestoreReader.getExpense(expenseId)` |
| `services/ExpenseService.ts` | `listGroupExpenses` | `this.expensesCollection.where('groupId', '==', groupId).get()` | `firestoreReader.getExpensesForGroup(groupId)` |
| `services/SettlementService.ts`| `getSettlement` | `this.settlementsCollection.doc(settlementId).get()` | `firestoreReader.getSettlement(settlementId)` |
| `services/CommentService.ts` | `getCommentsCollection` | `this.groupsCollection.doc(targetId).collection('comments')` | `firestoreReader.getCommentsForTarget(...)` |
| `services/GroupShareService.ts`| `findShareLinkByToken`| `firestoreDb.collectionGroup('shareLinks').where('token', '==', token).get()` | `firestoreReader.getActiveShareLinkByToken(token)` |
| `services/balance/DataFetcher.ts`| `fetchExpenses`, `fetchSettlements`, `fetchGroup` | Direct `.collection().where().get()` calls | `firestoreReader.getExpensesForGroup(...)`, etc. |
| `auth/middleware.ts` | `userAuth` | `firestoreDb.collection('users').doc(userRecord.uid).get()` | `firestoreReader.getUser(userRecord.uid)` |
| `utils/i18n.ts` | `i18nMiddleware` | `firestoreDb.collection('users').doc(userId).get()` | `firestoreReader.getUser(userId)` |

## 4. Impact on Testing

This refactoring will revolutionize the testing strategy.

### Current State

- Tests rely on a live Firebase Emulator instance.
- Test setup is complex, requiring data seeding and cleanup (`TestUserPoolService`, direct `firestoreDb` calls in `beforeEach`/`afterEach`).
- Tests are slower and can be flaky due to the real-time nature of the emulator.
- It's hard to test specific edge cases (e.g., a corrupted document in Firestore).

### Future State

- **Unit Tests:** Will be fast and isolated. Instead of mocking the entire `firebase-admin` SDK, tests will simply provide the `MockFirestoreReader` to the service being tested.
- **Integration Tests:** Can be more focused on the interaction between services, still using the `MockFirestoreReader` to control the data layer.
- **Simplified Setup:** Test setup will involve simple mock calls, not database writes.

**Example Test Refactoring:**

**Before:**
```typescript
// test file
let testGroup: Group;
beforeEach(async () => {
    // Complex setup involving writing to the database
    testGroup = await createTestGroup(testUser.uid);
});

it('should fetch a group', async () => {
    const groupService = new GroupService();
    const group = await groupService.getGroup(testGroup.id, testUser.uid);
    expect(group.id).toBe(testGroup.id);
});
```

**After:**
```typescript
// test file
let mockReader: MockFirestoreReader;
let groupService: GroupService;

beforeEach(() => {
    mockReader = new MockFirestoreReader();
    // Service receives the reader via dependency injection
    groupService = new GroupService(mockReader);
});

it('should fetch a group', async () => {
    const mockGroup = { id: 'group1', name: 'Test Group', ... };
    mockReader.getGroup.mockResolvedValue(mockGroup); // Simple mock setup

    const group = await groupService.getGroup('group1', 'user1');

    expect(mockReader.getGroup).toHaveBeenCalledWith('group1');
    expect(group.id).toBe('group1');
});
```

All test files in `firebase/functions/src/__tests__` that interact with the database will need to be updated to this new pattern.

## 5. Refactoring Plan

1.  **Phase 1: Create the Interface and Services**
    *   Define the `IFirestoreReader` interface.
    *   Create the `FirestoreReader` implementation class.
    *   Create the `MockFirestoreReader` test utility.
    *   Integrate the `FirestoreReader` into the application's dependency injection system (e.g., `ServiceRegistry`).

2.  **Phase 2: Incremental Refactoring (Service by Service)**
    *   Choose one service (e.g., `UserService2`).
    *   Replace all direct Firestore read calls within it with methods from the `FirestoreReader`.
    *   Update the unit/integration tests for that service to use the `MockFirestoreReader`.
    *   Ensure all tests pass.
    *   Repeat for all other services (`GroupService`, `ExpenseService`, etc.).

3.  **Phase 3: Refactor Handlers and Utilities**
    *   Refactor remaining Firestore calls in middleware, triggers, and other utility files.
    *   Update their corresponding tests.

4.  **Phase 4: Final Cleanup**
    *   Search the codebase for any remaining instances of `.get()`, `.where()`, etc., to ensure complete migration.
    *   Remove any dead code related to old data fetching logic.

## 6. Benefits

-   **Decoupling:** Business logic will no longer be tied to the Firestore SDK.
-   **Testability:** Unit testing becomes trivial, fast, and reliable.
-   **Maintainability:** A single place to manage all read logic, caching, and error handling.
-   **Type Safety:** The reader will be responsible for data validation (e.g., using Zod schemas), ensuring that any data returned to the services is strongly typed and valid.
-   **Clarity:** The code will be easier to understand, as the intent of a method call like `firestoreReader.getGroup(id)` is much clearer than a raw Firestore query.
