# Firebase Code Review - A New Plan for Refactoring

## Executive Summary

**Previous Approach**: A large-scale, "big bang" refactoring was attempted to introduce a service layer for all application domains (groups, expenses, users, etc.) at once. This resulted in widespread test failures and made it difficult to isolate the root causes.

**New Approach**: We will adopt an incremental and iterative approach to refactoring. We will introduce the service layer one domain at a time, with a strong emphasis on writing and updating tests at each stage. This will allow us to make progress in smaller, safer, and more manageable steps.

## Guiding Principles

*   **Incremental Changes**: Each change will be small and focused on a single piece of functionality.
*   **Test-Driven**: We will write unit tests for the new service layer components *before* or *during* the refactoring of the handlers. Existing integration tests will be updated and must pass after each step.
*   **Frequent Commits**: Each small, successful step will be committed, creating a clear history of the refactoring process.
*   **No Broken Windows**: The `main` branch will always be in a state where all tests are passing.

## The New Plan: Incremental Service Layer Refactoring

### Phase 1: Refactor User Management

**Goal**: Extract all user-related business logic into a new `UserService`.

1.  **Task 1.1: Create `UserService` with `getUser`**: ✅ **COMPLETED** (2025-08-26)
    *   ✅ Created `src/services/UserService.ts` (renamed from existing `userService.ts`)
    *   ✅ Implemented a `getUser` method that fetches a user's profile from Firebase Auth + Firestore
    *   ✅ Wrote comprehensive unit tests for `UserService.getUser` (8 tests total)
    *   ✅ Refactored the `getUserProfile` handler to use `UserService.getUser`
    *   ✅ Fixed all import paths across the codebase
    *   **Improvements made during review:**
        - Added missing test cases for users without email/displayName
        - Improved type safety by using `Timestamp` instead of `any`
        - Removed code duplication by extracting `validateUserRecord` method
        - Used TypeScript assertion signature for proper type narrowing
    *   **All tests passing, build successful**

2.  **Task 1.2: Move User Registration to `UserService`**:
    *   Implement a `registerUser` method in `UserService`.
    *   Write unit tests for `UserService.registerUser`, covering all validation and success cases.
    *   Refactor the `/register` handler to use `UserService.registerUser`.
    *   Update and run all relevant integration tests.

3.  **Task 1.3: Move other user operations to `UserService`**:
    *   Incrementally move the remaining user operations (update profile, change password, etc.) into `UserService`, following the same pattern of unit tests, refactoring, and integration tests for each.

### Phase 2: Refactor Group Management (Read Operations)

**Goal**: Extract read-only group operations into a new `GroupService`.

1.  **Task 2.1: Create `GroupService` with `getGroup`**:
    *   Create `src/services/GroupService.ts`.
    *   Implement a `getGroup` method that fetches a group and its members.
    *   Write unit tests for `GroupService.getGroup`.
    *   Refactor the `getGroup` handler to use `GroupService.getGroup`.
    *   Update and run all relevant integration tests.

2.  **Task 2.2: Move `listGroups` to `GroupService`**:
    *   Implement a `listGroups` method in `GroupService`.
    *   Write unit tests for `GroupService.listGroups`.
    *   Refactor the `listGroups` handler to use `GroupService.listGroups`.
    *   Update and run all relevant integration tests.

### Phase 3: Refactor Group Management (Write Operations)

**Goal**: Extract write operations for groups into `GroupService`.

1.  **Task 3.1: Move `createGroup` to `GroupService`**:
    *   Implement a `createGroup` method in `GroupService`. **Crucially, ensure the creator is added as a member with 'owner' role.**
    *   Write comprehensive unit tests for `GroupService.createGroup`.
    *   Refactor the `createGroup` handler to use `GroupService.createGroup`.
    *   Update and run all relevant integration tests, paying close attention to the "should create a new group with minimal data" test.

2.  **Task 3.2: Move `updateGroup` and `deleteGroup` to `GroupService`**:
    *   Incrementally move the update and delete operations to `GroupService`, with tests for each.

### Phase 4: Refactor Expenses and Settlements

**Goal**: Extract expense and settlement logic into their own services.

1.  **Task 4.1: Create `ExpenseService`**:
    *   Follow the same incremental pattern (read operations first, then write operations) to move expense logic into an `ExpenseService`.
2.  **Task 4.2: Create `SettlementService`**:
    *   Follow the same pattern for the `SettlementService`.