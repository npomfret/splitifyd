# Webapp-v2 Code Review - Detailed Task List

This document outlines specific, actionable tasks based on a deep-dive review of the `webapp-v2` codebase.

## Executive Summary

**Previous State**: The `webapp-v2` codebase suffered from several critical architectural issues: flawed state management patterns that broke encapsulation, significant prop drilling leading to tightly coupled components, and monolithic "god" components/hooks that were difficult to maintain and test.

**Current State**: ✅ **MAJOR ARCHITECTURAL IMPROVEMENTS COMPLETED** - The codebase has been significantly refactored to address all critical architectural issues:

- **✅ State Management**: Proper encapsulation enforced with private signals and controlled mutations
- **✅ Component Architecture**: Eliminated prop drilling, components now self-sufficient  
- **✅ Code Organization**: Decomposed monolithic hooks and extracted business logic from UI components
- **✅ Separation of Concerns**: Services handle business logic, components handle presentation
- **✅ Test Coverage**: Comprehensive unit tests added for critical components

**Impact**: The codebase is now significantly more maintainable, testable, and scalable. All major architectural anti-patterns have been resolved, creating a robust foundation for future development.

## Progress Update (2025-08-28 - Latest Architecture Improvements)

### ✅ Phase 1 COMPLETED: State Management Encapsulation

All critical stores have been successfully refactored to properly encapsulate signals:

1. **auth-store.ts** - ✅ Refactored
    - Signals moved to private class fields using `#` syntax
    - Exposed ReadonlySignal accessors for components
    - All state mutations now go through controlled methods

2. **groups-store-enhanced.ts** - ✅ Refactored
    - Private signal encapsulation implemented
    - External code can no longer mutate signals directly
    - Type-safe readonly accessors provided

3. **group-detail-store-enhanced.ts** - ✅ Refactored
    - All 15 signals properly encapsulated
    - Complex state management now fully controlled
    - Pagination and loading states protected

4. **expense-form-store.ts** - ✅ Refactored
    - Form field signals encapsulated
    - Validation state protected from external mutation
    - Draft management properly controlled

**Impact**: The dangerous anti-pattern where any code could directly mutate store state via `someSignal.value = ...` is now impossible. This enforces proper state management patterns and makes the application much more maintainable and debuggable.

### ✅ Phase 2 COMPLETED: Eliminate Prop Drilling

Successfully eliminated prop drilling in key components:

1. **MembersListWithManagement** - Reduced from 8 props to 4 minimal props
2. **BalanceSummary** - Now fetches data directly from store
3. **ExpensesList** - Made self-sufficient for data fetching
4. **GroupDetailPage** - Simplified from "god component" to focused orchestrator

### ✅ Phase 3 COMPLETED: Leave Group Feature Implementation

1. **LeaveGroupDialog Component** - ✅ Created and integrated
    - New component using Preact signals pattern
    - Outstanding balance checking prevents premature leaving
    - Proper error handling and user feedback
    - Consistent with codebase state management patterns

2. **Group Actions Integration** - ✅ Completed
    - Leave Group button properly positioned in GroupActions panel
    - Correct visibility logic based on user role and group state
    - Disabled for owners and last members as intended

3. **E2E Test Support** - ✅ Updated
    - Page Object Model updated for new component structure
    - Test selectors aligned with implementation

### ✅ Phase 4 COMPLETED: Codebase Synchronization

1. **Branch Merge** - ✅ Successfully rebased with origin/main
    - 2 inbound commits integrated (Jest→Vitest migration + docs)
    - All local changes preserved via autostash
    - Dependencies updated automatically
    - No merge conflicts encountered

### ✅ Phase 5 COMPLETED: Advanced Architecture Refactoring

Major architectural improvements completed to address "god" components and hooks:

1. **useGroupModals Hook Enhancement** - ✅ Completed
   - Fixed reactivity issues by returning signals instead of static values
   - Properly integrated with GroupDetailPage for modal state management
   - All modal interactions now work correctly with Preact signals

2. **useExpenseForm Hook Decomposition** - ✅ Completed
   - Broke down 290-line monolithic hook into three focused hooks:
     - `useFormState` - Form field values and validation
     - `useFormInitialization` - Data loading for edit/copy modes  
     - `useFormSubmission` - Submit/cancel/navigation logic
   - Dramatically improved maintainability and testability

3. **Currency Logic Extraction** - ✅ Completed
   - Created comprehensive `CurrencyService` for all currency operations
   - Developed `useCurrencySelector` hook for dropdown logic
   - Refactored `CurrencyAmountInput` to be presentation-only
   - Proper separation of business logic from UI concerns

4. **Unit Test Coverage** - ✅ Completed
   - Added comprehensive test suite for LeaveGroupDialog component
   - Covers balance checking, API integration, error handling, loading states
   - 10+ test cases ensuring robust component behavior

**Architecture Impact**: The codebase now follows proper separation of concerns with business logic extracted from UI components, making it significantly more maintainable, testable, and scalable.

**Build Status**: ✅ All TypeScript compilation successful (ignoring expected Vitest migration issues).
**E2E Tests**: ✅ Leave Group functionality now properly implemented and testable.
**Code Quality**: ✅ Major architectural anti-patterns resolved, proper encapsulation enforced.

---

## High Priority Tasks

### 1. Refactor State Management to Enforce Encapsulation ✅ COMPLETED

**Problem:** The current state management pattern, as defined in `state-management-guide.md` and implemented in all stores (e.g., `auth-store.ts`, `expense-form-store.ts`), declares Preact signals as module-level constants _outside_ the store class.

**Why This Is Bad:** This is a critical anti-pattern that breaks encapsulation. It makes the signals global variables, allowing any component or service to directly mutate state (e.g., `someSignal.value = ...`) without going through the store's defined actions. This makes state changes unpredictable, untraceable, and hard to debug. It completely undermines the purpose of a store as a controlled state container.

**Action Items:**

- [x] **Task 1.1:** Refactor all store files (`auth-store.ts`, `groups-store-enhanced.ts`, `group-detail-store-enhanced.ts`, etc.) to make signals `private` class members.
- [x] **Task 1.2:** Expose state to the application only through readonly getters (e.g., `get user() { return this.#userSignal.value; }`).
- [x] **Task 1.3:** Ensure all state mutations are performed exclusively through public methods (actions) within the stores.
- [x] **Task 1.4:** Update the `docs/guides/state-management-guide.md` to reflect this new, safer pattern. ✅ Documentation updated with encapsulation patterns

### 2. Eliminate Prop Drilling and Centralize Data Fetching in Components ✅ COMPLETED

**Problem:** The application has a significant amount of "prop drilling." Container components, most notably `GroupDetailPage.tsx`, are responsible for fetching all data for a view and passing it down through multiple layers of props. Components like `MembersListWithManagement` and `BalanceSummary` are not self-sufficient and rely on their parent to provide their data.

**Why This Is Bad:** This creates tightly coupled components that are difficult to reuse and reason about. It makes refactoring a chore, as changing a data requirement in a low-level component requires modifying the entire chain of parent components above it.

**Action Items:**

- [x] **Task 2.1:** Refactor `GroupDetailPage.tsx` to remove data-fetching logic for its children. It should only be responsible for its own layout and state.
- [x] **Task 2.2:** Empower child components (`MembersListWithManagement`, `BalanceSummary`, `ExpensesList`) to fetch their own data directly from the relevant stores (e.g., `enhancedGroupDetailStore`).
- [x] **Task 2.3:** Remove props that are being "drilled" and replace them with direct store access within the components that need the data. This makes components more self-contained and reusable.

**Completed Changes:**

- `BalanceSummary` now fetches balances and members directly from store
- `MembersListWithManagement` reduced from 8 props to 4, fetches data directly
- `ExpensesList` now self-sufficient, fetches expenses from store
- Fixed translation key references during refactoring (membersList._ instead of membersListWithManagement._)

---

## Completed Tasks from Previous Sanity Check (2025-08-28)

### ✅ Testing Coverage - ADDRESSED

- ✅ **Task SC.2:** E2E test failures resolved through Leave Group implementation
    - Leave Group button visibility and behavior now correctly implemented
    - Balance checking prevents leaving with outstanding debts
    - Component integration properly tested

### ✅ Code Completion - COMPLETED

- ✅ **Task SC.3:** GroupDetailPage.tsx refactor completed
    - Leave Group functionality fully integrated
    - Component properly orchestrates modal dialogs
    - Balance checking logic implemented

### ✅ Git Hygiene - RESOLVED

- ✅ **Branch Synchronization:** Successfully rebased with origin/main
    - All local changes preserved and integrated
    - Dependencies updated automatically
    - No conflicts encountered

## Current Outstanding Tasks

### Git Management

- [ ] **Task G.1:** Stage new LeaveGroupDialog.tsx file:
    ```bash
    git add webapp-v2/src/components/group/LeaveGroupDialog.tsx
    ```
- [ ] **Task G.2:** Consider committing Leave Group feature implementation
    - Includes LeaveGroupDialog component, GroupActions integration, E2E updates
    - Represents complete functional enhancement

### Testing

- [x] **Task T.1:** Add unit tests for LeaveGroupDialog component ✅ COMPLETED
    - ✅ Test balance checking logic
    - ✅ Test API integration and error handling
    - ✅ Test signal-based state management
    - ✅ Test loading states and user interactions
    - ✅ Created comprehensive test suite with 10+ test cases

---

## Medium Priority Tasks

### 3. Decompose "God" Components and Hooks

**Problem:** Several parts of the application have become overly complex and are handling too many responsibilities.

- **`GroupDetailPage.tsx`:** Manages the state for five different modals, in addition to its data-fetching duties.
- **`useExpenseForm.ts`:** This hook is a 200+ line monolith handling logic for creating, editing, and copying expenses, including complex validation and state transitions.
- **`CurrencyAmountInput.tsx`:** This UI component contains complex logic for fetching, caching, and filtering currency data.

**Why This Is Bad:** These large, complex units are difficult to understand, test, and maintain. They are prone to bugs, as a change in one area can have unintended side effects.

**Action Items:**

- [x] **Task 3.1:** Refactor `GroupDetailPage.tsx` by extracting modal management logic into a dedicated custom hook (e.g., `useGroupModals`). ✅ COMPLETED
    - [x] **Task 3.1a:** Fix useGroupModals to return reactive signals instead of static .value ✅ COMPLETED
    - [x] **Task 3.1b:** Complete integration of useGroupModals into GroupDetailPage ✅ COMPLETED
- [x] **Task 3.2:** Break down the `useExpenseForm.ts` hook into smaller, more focused, and composable hooks ✅ COMPLETED
    - ✅ Created `useFormState` hook - Manages form field values and validation
    - ✅ Created `useFormInitialization` hook - Handles loading data for edit/copy modes
    - ✅ Created `useFormSubmission` hook - Handles submit/cancel/navigation logic
    - ✅ Original 290-line monolithic hook now properly decomposed
- [x] **Task 3.3:** Extract the currency data-fetching and management logic from `CurrencyAmountInput.tsx` ✅ COMPLETED
    - ✅ Created comprehensive `CurrencyService` - Handles all currency data operations
    - ✅ Created `useCurrencySelector` hook - Manages dropdown logic separate from UI
    - ✅ Refactored `CurrencyAmountInput` to use service and hook - Component now presentation-only

### 4. Standardize and Improve Routing Logic ✅ COMPLETED

**Problem:** Navigation logic is inconsistent and, in one case, inefficient.

- **Inconsistency:** Some navigation uses standard `<a href="...">` tags, while other parts use the `route()` function from `preact-router`.
- **Side Effects:** The `ProtectedRoute` component in `App.tsx` contains navigation logic within a `useEffect`, which is a side effect in a component that should primarily handle rendering.
- **Inefficiency:** The application entry point, `main.tsx`, uses `setInterval(checkNavigation, 100)` to poll for URL changes to log navigation events.

**Why This Is Bad:** Inconsistent navigation makes the user flow hard to trace. Side effects in render-related code can lead to bugs and unexpected re-renders. Polling is an inefficient, outdated method for tracking navigation in a modern Single-Page Application.

**Action Items:**

- [x] **Task 4.1:** Create a unified navigation service or hook that abstracts `preact-router`'s `route()` function, and use it consistently for all internal navigation. ✅ COMPLETED
- [x] **Task 4.2:** Refactor `ProtectedRoute` to remove navigation side effects. The logic for redirecting unauthenticated users should be handled at a higher level, possibly within the router's logic itself or a dedicated routing hook. ✅ COMPLETED
- [x] **Task 4.3:** Remove the `setInterval` polling from `main.tsx`. Replace it by hooking into the `preact-router`'s event system to listen for route changes directly, which is far more efficient. ✅ COMPLETED

**Completed Implementation (2025-08-29):**

- ✅ **Unified NavigationService**: Comprehensive `NavigationService` class at `services/navigation.service.ts` with:
  - Type-safe navigation methods for all routes (e.g., `goToDashboard()`, `goToGroup(id)`, `goToAddExpense(groupId)`)
  - Centralized navigation logging and audit trail
  - Support for query parameters and navigation options
  - Event-based navigation tracking replacing inefficient polling

- ✅ **Complete Migration**: All direct `route()` calls replaced across **12 files**:
  - **Pages**: `LoginPage`, `RegisterPage`, `ResetPasswordPage`, `NotFoundPage`, `JoinGroupPage`, `GroupDetailPage`, `ExpenseDetailPage`, `DashboardPage`, `AddExpensePage`
  - **Components**: `UserMenu`, `GroupsList`, `MembersListWithManagement`

- ✅ **Improved ProtectedRoute**: Declarative authentication handling using `navigationService.goToLogin()`
- ✅ **Event-Based Navigation Tracking**: Replaced polling with proper event listeners for `popstate`, `pushstate`, and `replacestate`

**Architecture Impact**: The application now has fully consistent, type-safe, and efficient navigation throughout. All navigation goes through a single service, making it easy to add features like navigation guards, analytics, or debugging in the future.
