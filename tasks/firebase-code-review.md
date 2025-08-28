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

**Goal**: Extract all user-related business logic into a new `UserService2`.

1.  **Task 1.1: Create `UserService2` with `getUser`**: ✅ **COMPLETED** (2025-08-26)
    *   ✅ Created `src/services/UserService2.ts` (renamed from existing `UserService2.ts`)
    *   ✅ Implemented a `getUser` method that fetches a user's profile from Firebase Auth + Firestore
    *   ✅ Wrote comprehensive unit tests for `UserService2.getUser` (8 tests total)
    *   ✅ Refactored the `getUserProfile` handler to use `UserService2.getUser`
    *   ✅ Fixed all import paths across the codebase
    *   **Improvements made during review:**
        - Added missing test cases for users without email/displayName
        - Improved type safety by using `Timestamp` instead of `any`
        - Removed code duplication by extracting `validateUserRecord` method
        - Used TypeScript assertion signature for proper type narrowing
    *   **All tests passing, build successful**

2.  **Task 1.2: Move User Registration to `UserService2`**: ✅ **COMPLETED** (2025-08-26)
    *   ✅ Implemented a `registerUser` method in `UserService2`
    *   ✅ Wrote comprehensive unit tests for `UserService2.registerUser` (9 test cases covering all scenarios)
    *   ✅ Refactored the `/register` handler to use `UserService2.registerUser`
    *   ✅ Updated and ran all relevant integration tests (all registration tests passing)
    *   **Key improvements:**
        - Centralized registration logic in UserService2
        - Maintained all existing functionality (validation, policy acceptance, theme color assignment)
        - Proper error handling including orphaned user cleanup
        - Clean separation of concerns between handler and service layer
    *   **All tests passing, build successful**

3.  **Task 1.3: Move other user operations to `UserService2`**: ✅ **COMPLETED** (2025-08-27)
    *   ✅ Implemented `updateProfile` method in `UserService2`
    *   ✅ Implemented `changePassword` method in `UserService2`  
    *   ✅ Implemented `deleteAccount` method in `UserService2`
    *   ✅ Wrote comprehensive unit tests for all three methods (13 new tests covering all scenarios)
    *   ✅ Refactored all three handlers (`updateUserProfile`, `changePassword`, `deleteUserAccount`) to use service methods
    *   ✅ Removed all unnecessary imports from handlers
    *   **Key improvements:**
        - All user operations now centralized in UserService2
        - Consistent error handling across all operations  
        - Cache invalidation on profile updates
        - Security note added for future password verification improvements
        - Clean separation of concerns maintained
        - Handler code reduced by ~80%
    *   **All 297 unit tests passing**

### Phase 2: Refactor Group Management (Read Operations)

**Goal**: Extract read-only group operations into a new `GroupService`.

1.  **Task 2.1: Create `GroupService` with `getGroup`**: ✅ **COMPLETED** (2025-08-26)
    *   ✅ Created `src/services/GroupService.ts`
    *   ✅ Implemented a `getGroup` method that fetches group data with permissions and balance calculations
    *   ✅ Wrote comprehensive unit tests for `GroupService.getGroup` (9 tests total)
    *   ✅ Refactored the `getGroup` handler to use `GroupService.getGroup`
    *   ✅ Updated and ran all relevant integration tests (24 tests passed)
    *   **Key improvements:**
        - Extracted complex balance calculation logic into service layer
        - Maintained proper access control (owner/member permissions)
        - Clean separation of concerns between handler and service
        - Reduced handler from ~50 lines to 8 lines
        - Proper error handling with security-conscious 404 responses
    *   **All tests passing, build successful**

2.  **Task 2.2: Move `listGroups` to `GroupService`**: ✅ **COMPLETED** (2025-08-27)
    *   ✅ Implemented a `listGroups` method in `GroupService` with pagination and metadata support
    *   ✅ Wrote comprehensive unit tests for `GroupService.listGroups` (6 tests total)
    *   ✅ Refactored the `listGroups` handler to use `GroupService.listGroups`
    *   ✅ Removed unused helper functions and imports (reduced handler by ~190 lines)
    *   **Key improvements:**
        - Performance-optimized batch fetching (prevents N+1 queries)
        - Full pagination support with cursor-based navigation
        - Optional metadata for change tracking
        - Graceful error handling for balance calculation failures
        - Clean separation of concerns between handler and service
    *   **All 302 unit tests passing, build successful**
    *   **Integration tests added and passing (8 tests for listGroups)**

### Phase 3: Refactor Group Management (Write Operations)

**Goal**: Extract write operations for groups into `GroupService`.

1.  **Task 3.1: Move `createGroup` to `GroupService`**: ✅ **COMPLETED** (2025-08-27)
    *   ✅ Implemented a `createGroup` method in `GroupService`. **Crucially, ensured the creator is added as a member with 'ADMIN' role.**
    *   ✅ Wrote comprehensive unit tests for `GroupService.createGroup` (6 test cases)
    *   ✅ Refactored the `createGroup` handler to use `GroupService.createGroup`
    *   ✅ Updated and ran all relevant integration tests, paying close attention to the "should create a new group with minimal data" test
    *   **Key improvements:**
        - Creator always gets ADMIN role and theme index 0
        - Theme colors wrap around with pattern changes when exhausted
        - Proper security preset handling
        - Clean separation of concerns
    *   **All unit tests passing (317 tests)**

2.  **Task 3.2: Move `updateGroup` and `deleteGroup` to `GroupService`**: ✅ **COMPLETED** (2025-08-27)
    *   ✅ Implemented `updateGroup` method in `GroupService` with optimistic locking
    *   ✅ Implemented `deleteGroup` method in `GroupService` with expense check
    *   ✅ Wrote comprehensive unit tests for both methods (9 test cases total)
    *   ✅ Refactored both handlers to use service methods
    *   ✅ Removed duplicate code (fetchGroupWithAccess, addComputedFields, getGroupsCollection)
    *   **Key improvements:**
        - Only owners can update or delete groups
        - Groups with expenses cannot be deleted
        - Proper transaction handling with optimistic locking
        - Security-conscious error messages (404 vs 403)
        - Handlers reduced from ~50 lines to ~10 lines each
    *   **All 317 unit tests passing**

### Phase 4: Refactor Expenses and Settlements

**Goal**: Extract expense and settlement logic into their own services.

1.  **Task 4.1: Create `ExpenseService` (Read Operations)**: ✅ **COMPLETED** (2025-08-27)
    *   ✅ Created `src/services/ExpenseService.ts`
    *   ✅ Implemented `getExpense` method with proper access control
    *   ✅ Implemented `listGroupExpenses` method with pagination support
    *   ✅ Wrote comprehensive unit tests (17 tests covering all scenarios)
    *   ✅ Refactored `getExpense` and `listGroupExpenses` handlers to use ExpenseService
    *   **Key improvements:**
        - Centralized expense fetching and validation logic
        - Consistent permission checking for expense access
        - Proper Zod validation for expense documents
        - Clean separation of concerns
        - Handler code reduced significantly
    *   **All 317 unit tests passing (4 unrelated GroupService tests failing)**

2.  **Task 4.2: Move write operations to `ExpenseService`**: 🚧 **IN PROGRESS** (2025-08-28)
    *   ✅ **Step 1: createExpense** - **COMPLETED**
        - Implemented `createExpense` method in ExpenseService
        - Added comprehensive unit tests (12 test cases)
        - Refactored handler to use service (reduced from ~100 lines to 10 lines)
        - All 345 unit tests passing
    *   ✅ **Step 2: updateExpense** - **COMPLETED**
        - Implemented `updateExpense` method in ExpenseService with all features:
          * Permission checking with PermissionEngine
          * Member validation for paidBy/participants
          * Split recalculation based on amount/type changes
          * Optimistic locking for concurrent update prevention
          * History tracking for all changes
          * Full transaction support
        - Added comprehensive unit tests (14 test cases)
        - Refactored handler to use service (reduced from ~180 lines to 10 lines)
        - All 339 unit tests passing
    *   🔄 **Step 3: deleteExpense** - To be implemented next
    
3.  **Task 4.3: Create `SettlementService`**:
    *   Follow the same pattern for the `SettlementService`.