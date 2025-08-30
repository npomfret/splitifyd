# Task: Refactor Real-time Stores for Robustness

## 1. Overview

An analysis of the web application's state management stores (`webapp-v2/src/app/stores`) was conducted, prompted by the recent successful refactoring of `comments-store.ts`. The goal was to identify other stores that manage real-time Firestore subscriptions and would benefit from the same robust, reference-counted subscription model.

The key improvements from the `comments-store` refactor were:
-   **Proper Encapsulation**: Using private class members for signals.
-   **Reference-Counted Subscriptions**: Allowing multiple components to safely share a single data subscription, which is only created on the first request and destroyed on the last.
-   **Explicit State Machine**: Tracking the subscription lifecycle (`idle`, `subscribing`, `subscribed`) to prevent race conditions.

## 2. Analysis Findings

The deep dive identified two primary candidates that manage per-resource (i.e., per-group) real-time data and would significantly benefit from this improved pattern.

### Candidate 1: `group-detail-store-enhanced.ts`

-   **Current State**: This is the most critical store for this refactoring. It manages all the data for the `GroupDetailPage`, including the group document, members, expenses, and balances. It uses a `ChangeDetector` utility to subscribe to real-time updates from Firestore.
-   **Problem**: The current implementation assumes it will only ever manage **one group at a time**. It holds a single `currentGroupId` and a single set of `unsubscribe` functions. If a new feature required displaying data from two different groups simultaneously (e.g., a "compare groups" view or a "mini-detail" widget), the store's internal state would become corrupted, and listeners for the first group would be leaked.
-   **Recommendation**: Refactor `EnhancedGroupDetailStoreImpl` to use the reference-counting pattern.
    -   Replace the current `subscribeToChanges` and `dispose` methods with `registerComponent(groupId, userId)` and `deregisterComponent(groupId)`.
    -   The store should internally manage a map of active subscriptions (e.g., `Map<groupId, { count: number; unsubscribe: () => void }>`).
    -   The underlying `ChangeDetector` utility must also be enhanced or replaced to support this pattern, as it currently seems to manage listeners by a simple key and may not handle shared listeners correctly.

### Candidate 2: `permissions-store.ts`

-   **Current State**: This store is responsible for managing the permissions of the current user for a specific group. It uses `onSnapshot` to listen for real-time changes to the group document to update UI elements dynamically if permissions change.
-   **Problem**: Like the `group-detail-store`, it is designed to only track one group's permissions at a time (`subscribeToGroup(groupId)`). It holds a single `unsubscribe` function, making it vulnerable to the same issues if used by multiple components for different groups.
-   **Recommendation**: Refactor `PermissionsStore` to use the reference-counting pattern. This change would be simpler than the one for the detail store but is equally important for architectural robustness. The `subscribeToGroup` method should be replaced with a `register/deregister` pair that manages the underlying `onSnapshot` listener based on component usage for a given `groupId`.

### Non-Candidates

The following stores were analyzed and do not require this refactoring:

-   **`auth-store.ts`**: Manages a single, global `onAuthStateChanged` listener. The current implementation is correct and robust for its purpose.
-   **`groups-store-enhanced.ts`**: Manages the list of all groups for the dashboard. Its `subscribeToChanges` is for the user's global set of changes, not a per-resource subscription. The current implementation is appropriate.
-   **`expense-form-store.ts`**, **`join-group-store.ts`**, **`theme-store.ts`**: These do not manage real-time Firestore subscriptions and are not candidates.

## 3. Next Steps

To improve the stability and scalability of the UI, the following actions are recommended:

1.  **Prioritize `group-detail-store-enhanced.ts`**: This is the most complex and most critical store to refactor. Applying the reference-counting pattern here will yield the highest benefit.
2.  **Enhance `ChangeDetector`**: The `ChangeDetector` utility should be reviewed and updated to support the new model. It needs to correctly manage multiple listeners and their associated callback sets without conflicts.
3.  **Refactor `permissions-store.ts`**: Apply the same pattern to the permissions store to ensure consistency and robustness across all per-group data stores.

By implementing these changes, the application will be better prepared for future features that may require displaying data from multiple groups within the same view, preventing a significant and difficult refactor down the line.

## 4. Additional Antipatterns Discovered

During a comprehensive codebase audit, several additional architectural violations were identified that require immediate attention:

### 4.1 Critical: Module-Level Signal Violations

**Problem**: Multiple pages violate the encapsulation principles by using module-level signals instead of private class fields, creating global mutable state.

**Affected Files**:
- `LoginPage.tsx`: `emailSignal`, `passwordSignal`, `formDefaultsLoadedSignal` 
- `RegisterPage.tsx`: `nameSignal`, `emailSignal`, `passwordSignal`, `confirmPasswordSignal`, `agreeToTermsSignal`, `agreeToCookiesSignal`
- `ResetPasswordPage.tsx`: `emailSignal`
- `hooks/useConfig.ts`: `configSignal`, `loadingSignal`, `errorSignal`

**Impact**: These are global variables that any code can directly mutate via `someSignal.value = ...`, completely bypassing encapsulation and making state changes unpredictable and untraceable.

**Recommendation**: 
1. **LoginPage/RegisterPage**: Refactor to use local component state or create proper store classes with private class fields
2. **useConfig.ts**: Create a `ConfigStore` class following the same encapsulation pattern as other stores
3. **Priority**: HIGHEST - These violations break core architectural principles

### 4.2 Subscription Cleanup Issues

**PermissionsStore Active Memory Leak**:
- Has `subscribeToGroup()` creating `onSnapshot` listeners
- Has `dispose()` method BUT no components call it consistently  
- **Result**: Firebase listeners accumulate on every navigation, causing memory leaks

**Component Cleanup Inconsistency**:
- `GroupDetailPage`: ✅ Correctly calls `dispose()` in useEffect cleanup
- `ExpenseDetailPage`: ❌ Loads data in useEffect but NO cleanup return
- `SettlementHistory`: ❌ Fetches data but relies on parent cleanup

### 4.3 E2E Test Quality Issues Resolved

**Success Story**: The recent cleanup of `comments-realtime.e2e.test.ts` eliminated:
- ❌ → ✅ Forbidden `waitForTimeout()` calls (3 instances removed)
- ❌ → ✅ Direct selectors in test files (replaced with Page Object methods)
- ❌ → ✅ Bespoke UI interactions (all abstracted through POM)

**Result**: Test now passes 5/5 consecutive runs with 100% reliability, averaging 13 seconds per run.

## 5. Updated Implementation Plan

### Phase 1: Critical Signal Encapsulation (IMMEDIATE)
1. **LoginPage.tsx** - Move module-level signals into component state or proper store
2. **RegisterPage.tsx** - Move module-level signals into component state or proper store  
3. **ResetPasswordPage.tsx** - Move module-level signals into component state or proper store
4. **useConfig.ts** - Create proper `ConfigStore` class with private fields

### Phase 2: Store Refactoring (HIGH PRIORITY)
1. **`group-detail-store-enhanced.ts`** - Apply reference-counting pattern
2. **`permissions-store.ts`** - Apply reference-counting pattern  
3. **`ChangeDetector` utility** - Enhance to support shared listeners

### Phase 3: Subscription Management Audit (MEDIUM)
1. **ExpenseDetailPage** - Add proper cleanup patterns
2. **SettlementHistory** - Ensure subscription disposal
3. **Standardize cleanup patterns** across all components

### Phase 4: Quality Assurance (ONGOING)
1. **E2E test expansion** - Apply similar cleanup to other test files
2. **Memory leak testing** - Navigate rapidly between pages, monitor listener accumulation
3. **Documentation** - Create subscription management best practices guide

## 6. Expected Benefits

**Performance**: 
- Eliminate memory leaks from accumulating Firebase listeners
- Reduce unnecessary re-renders from global signal mutations

**Reliability**: 
- Prevent stale data issues from improper cleanup
- Eliminate race conditions in subscription management

**Maintainability**: 
- Consistent patterns across all stores and components
- Proper encapsulation prevents accidental state mutations

**Testability**:
- Reliable E2E tests without forbidden timing patterns
- Deterministic state management for unit testing

## 7. Success Metrics

- **Memory**: No accumulating Firebase listeners after navigation cycles
- **Performance**: Consistent subscription creation/disposal timing
- **Quality**: 100% E2E test pass rate on repeated runs
- **Architecture**: Zero module-level signals in production code
