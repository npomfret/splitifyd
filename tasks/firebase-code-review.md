# Firebase Code Review - Detailed Task List

This document outlines specific, actionable tasks based on the Firebase codebase code review.

## High Priority Tasks

### 1. Unit Testing for Balance Calculator
- [ ] **Task 1.1**: Create comprehensive unit tests for `balanceCalculator.ts`
  - Test `calculateGroupBalances` function with various scenarios
  - Test edge cases: empty groups, single user, no expenses
  - Test complex scenarios: multiple users, multiple expenses, settlements
  - Mock Firestore dependencies to isolate business logic
  - Achieve >95% code coverage for balance calculation logic

- [ ] **Task 1.2**: Add unit tests for expense calculation logic
  - Test expense splitting algorithms
  - Test different split types (equal, exact amounts, percentages)
  - Test validation of expense data

- [ ] **Task 1.3**: Add unit tests for settlement calculation logic
  - Test settlement creation and validation
  - Test settlement impact on balances
  - Test settlement reversal scenarios

### 2. Balance Calculator Refactoring
- [ ] **Task 2.1**: Break down `calculateGroupBalances` into smaller functions
  - Extract expense processing logic
  - Extract settlement processing logic
  - Extract balance calculation logic
  - Extract debt optimization logic
  - Each function should have single responsibility

- [ ] **Task 2.2**: Remove all `any` types from `balanceCalculator.ts`
  - Create proper interfaces for balance data structures
  - Define types for expense objects
  - Define types for settlement objects
  - Define types for user balance objects
  - Define types for calculation intermediate results

- [ ] **Task 2.3**: Create proper interfaces for balance calculation
  - `BalanceCalculationInput` interface
  - `BalanceCalculationResult` interface
  - `UserBalance` interface
  - `DebtRelationship` interface
  - `CalculationContext` interface

### 3. Performance Issues
- [ ] **Task 3.1**: Fix N+1 problem in `listGroups` handler
  - Identify all database queries in the handler
  - Batch related queries where possible
  - Use Firestore `getAll()` for multiple document fetches
  - Implement query optimization for balance calculations

- [ ] **Task 3.2**: Optimize database queries throughout codebase
  - Audit all handlers for inefficient query patterns
  - Implement proper indexing strategies
  - Cache frequently accessed data where appropriate
  - Minimize round trips between client and database

## Medium Priority Tasks

### 4. Architecture & Service Layer
- [ ] **Task 4.1**: Create dedicated service layer for group operations
  - Extract business logic from `groups/handlers.ts`
  - Create `GroupService` class with methods:
    - `createGroup()`
    - `updateGroup()`
    - `deleteGroup()`
    - `calculateGroupBalances()`
    - `getGroupMembers()`

- [ ] **Task 4.2**: Create service layer for expense operations
  - Extract business logic from expense handlers
  - Create `ExpenseService` class
  - Handle expense validation, creation, updates
  - Handle expense splitting logic

- [ ] **Task 4.3**: Create service layer for user operations
  - Extract user-related business logic
  - Create `UserService` class
  - Handle user authentication, authorization
  - Handle user profile management

### 5. API Consistency
- [ ] **Task 5.1**: Standardize balance data structures
  - Define consistent balance response format
  - Ensure all endpoints return balances in same structure
  - Update API documentation
  - Create shared types for balance responses

- [ ] **Task 5.2**: Audit and standardize all API responses
  - Review response formats across all endpoints
  - Ensure consistent error response structure
  - Standardize success response formats
  - Update shared type definitions

### 6. Code Organization
- [ ] **Task 6.1**: Break down large `index.ts` file
  - Extract route definitions to separate files
  - Group related routes (auth routes, group routes, etc.)
  - Create proper module structure
  - Maintain clear separation of concerns

- [ ] **Task 6.2**: Organize handlers by feature domain
  - Ensure each feature has its own handler file
  - Move shared utilities to common modules
  - Create clear import/export structure

## Lower Priority Tasks

### 7. Type Safety Improvements
- [ ] **Task 7.1**: Remove `any` types from expense-related modules
  - Audit `expenses/` directory for `any` usage
  - Create proper TypeScript interfaces
  - Update function signatures with correct types
  - Ensure type safety throughout expense workflow

- [ ] **Task 7.2**: Remove `any` types from user-related modules
  - Audit user authentication and management code
  - Define proper user object interfaces
  - Update database query result types
  - Ensure type safety in user operations

- [ ] **Task 7.3**: Remove `any` types from auth-related modules
  - Review authentication middleware
  - Define proper auth context types
  - Update JWT payload types
  - Ensure type safety in authorization checks

### 8. Testing Infrastructure
- [ ] **Task 8.1**: Set up unit testing framework
  - Configure Jest for Firebase Functions
  - Set up test database and mocking utilities
  - Create test helpers and builders
  - Establish testing best practices documentation

- [ ] **Task 8.2**: Create test data builders
  - Build `GroupBuilder` for test data
  - Build `ExpenseBuilder` for test scenarios
  - Build `UserBuilder` for user test data
  - Build `SettlementBuilder` for settlement tests

### 9. Code Quality
- [ ] **Task 9.1**: Add comprehensive JSDoc documentation
  - Document all public functions and classes
  - Document complex business logic
  - Document API endpoints and expected payloads
  - Document service layer interfaces

- [ ] **Task 9.2**: Implement proper error handling patterns
  - Standardize error creation and handling
  - Create domain-specific error classes
  - Ensure proper error logging and monitoring
  - Update error response formats

## Validation & Completion Criteria

### For Each Task:
- [ ] Code changes implemented and tested
- [ ] Unit tests added/updated where applicable
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] TypeScript compilation successful with no `any` types
- [ ] Code review completed
- [ ] Documentation updated

### Overall Success Metrics:
- [ ] 100% removal of `any` types from codebase
- [ ] >90% unit test coverage for business logic
- [ ] All N+1 query problems resolved
- [ ] Service layer properly implemented
- [ ] API responses consistently structured
- [ ] Large files properly modularized
- [ ] All existing tests continue to pass

---

## Additional Work Items from AI Code Review

The following items were identified during an automated code review and should be integrated into the task list above.

### New High Priority Task: Fix Ineffective Rate Limiter
- [ ] **Task**: Replace the in-memory rate limiter with a distributed solution.
  - **Justification**: The current `InMemoryRateLimiter` is ineffective in a serverless environment as state is not shared between function instances.
  - **Action**: Implement rate limiting using Firestore to track request counts and timestamps per user.
  - **Testing**: Create unit tests for the new distributed rate limiter logic.

### New High Priority Task: Implement Denormalization for Performance
- [ ] **Task**: Implement denormalization for group summary data to fix N+1 query problem.
  - **Justification**: The `listGroups` endpoint is highly inefficient, making numerous database calls per group.
  - **Action**: Use existing Firestore triggers (`trackGroupChanges`, `trackExpenseChanges`) to pre-calculate and store summary data (like balances and last activity) directly on the group documents.
  - **Action**: Refactor the `listGroups` handler to read this pre-calculated data, removing the on-demand calculations.

### New Medium Priority Task: Data Access & Schema Refactoring
- [ ] **Task**: Implement a Repository Pattern for Firestore access.
  - **Justification**: Data access logic is currently scattered in handlers, making it hard to maintain.
  - **Action**: Create repositories (e.g., `GroupsRepository`) responsible for all read/write operations for each collection.
  - **Action**: Refactor handlers and services to use repositories instead of accessing `db.collection(...)` directly.
- [ ] **Task**: Flatten the Firestore document schema for groups.
  - **Justification**: The nested `data` object in group documents is awkward and adds unnecessary complexity.
  - **Action**: Remove the nested `data` object and update the data access layer to reflect the new, simpler schema.
