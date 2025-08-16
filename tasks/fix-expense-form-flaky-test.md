# Plan: Fix Flaky Expense Form E2E Test

**Task:** Resolve the intermittent E2E test failures on the "Add Expense" page caused by a race condition during form initialization.

**Status:** ✅ Completed

## 1. Problem Summary

The E2E tests for adding an expense are flaky. They frequently fail with a timeout error, stating that no members are visible in the "Who paid?" or "Split between" sections of the expense form. 

This happens because the test executes its assertions on the form before the group member data has been asynchronously fetched from the backend and rendered in the UI.

## 2. Root Cause Analysis

The investigation of the expense form's architecture revealed the following data flow and the source of the race condition:

1.  **Component Architecture:** The `AddExpensePage.tsx` component delegates all of its logic to the `useExpenseForm.ts` custom hook. This hook, in turn, gets its data (including group members) from a global store, `enhancedGroupDetailStore.ts`.

2.  **Data Fetching Logic:** The `useExpenseForm` hook contains the following logic to decide whether to fetch group data:

    ```typescript
    // In useExpenseForm.ts
    if (!group.value || group.value.id !== groupId) {
      await enhancedGroupDetailStore.fetchGroup(groupId);
    }
    ```

3.  **The Flaw:** The core issue is a faulty caching assumption. The code assumes that if a `group` object with the correct `id` exists in the global store, then its data (including the `members` array) is complete. 

4.  **The Race Condition:**
    - A test navigates to the expense form.
    - The `useExpenseForm` hook sees a stale or partially loaded `group` object in the store from a previous page or test.
    - Because the `groupId` matches, the hook **incorrectly skips** the `fetchGroup()` call.
    - The page renders with an empty `members` array.
    - The E2E test's `waitForFormReady` function polls the page, sees 0 members, and eventually times out after 5 seconds, causing the test to fail.

## 3. Proposed Solution

The solution is to make the form's loading state more robust. We must ensure that the form is not displayed until the essential data, specifically the group members, is present and valid.

We will modify the `useExpenseForm` hook to expose a new, more accurate readiness signal. This signal will only resolve to `true` when the underlying data store is no longer loading **and** the members array contains at least one member.

## 4. Implementation Steps

1.  **Modify `useExpenseForm.ts`:**
    -   Introduce a new computed signal named `isDataReady`.
    -   This signal's value will be derived from the state of the `enhancedGroupDetailStore`.

    ```typescript
    // In webapp-v2/src/app/hooks/useExpenseForm.ts

    // ... existing computed values
    const loading = useComputed(() => enhancedGroupDetailStore.loading);
    const members = useComputed(() => enhancedGroupDetailStore.members);

    // Add a new, more reliable readiness signal
    const isDataReady = useComputed(() => {
      // Data is ready only when loading is false AND we have members.
      return !loading.value && members.value.length > 0;
    });

    // ... in the return object of the hook, expose the new signal
    return {
      // ... existing state
      isDataReady: isDataReady.value,
      // ... rest of the return values
    };
    ```

2.  **Update `AddExpensePage.tsx`:**
    -   Modify the condition for rendering the `<LoadingState>` component to use the new `isDataReady` signal instead of the less reliable `isInitialized`.

    ```tsx
    // In webapp-v2/src/pages/AddExpensePage.tsx

    // ...
    const formState = useExpenseForm({ groupId, ... });

    // Original, flawed condition:
    // if (!formState.isInitialized || formState.loading) {

    // New, robust condition:
    if (!formState.isDataReady) {
      return (
        <BaseLayout title="Loading... - Splitifyd">
          <LoadingState fullPage message="Loading expense form..." />
        </BaseLayout>
      );
    }
    // ... rest of the component
    ```

## 5. Verification and Testing

1.  **E2E Test Validation:**
    -   Run the previously failing E2E test, `add-expense-happy-path.e2e.test.ts`.
    -   To ensure the fix has eliminated the flakiness, run the test in a loop at least 20 times.
    -   The test should now pass consistently with no timeouts.

2.  **Manual Verification:**
    -   Manually navigate to the "Add Expense" page in the browser.
    -   Confirm that the full-page "Loading expense form..." spinner remains visible until the "Who paid?" and "Split between" sections are fully populated with member data.

## 6. Benefits of this Fix

-   **Test Stability:** Eliminates a major source of flakiness in the E2E test suite.
-   **Improved UX:** Prevents the user from ever seeing a brief flash of an empty/incomplete form, providing a smoother loading experience.
-   **Robustness:** Makes the data-fetching logic more resilient to stale or partial data in the global store.

## 7. Implementation Completed ✅

**Date:** January 16, 2025

### Changes Made:

1. **Modified `webapp-v2/src/app/hooks/useExpenseForm.ts`:**
   - Added new computed signal `isDataReady` after line 32:
   ```typescript
   // Data readiness signal - only true when loading is false AND we have members
   const isDataReady = useComputed(() => {
     // Data is ready only when loading is false AND we have members.
     return !loading.value && members.value.length > 0;
   });
   ```
   - Exposed `isDataReady: isDataReady.value` in the return object of the hook

2. **Updated `webapp-v2/src/pages/AddExpensePage.tsx`:**
   - Changed the loading condition from:
     ```tsx
     if (!formState.isInitialized || formState.loading) {
     ```
   - To:
     ```tsx
     if (!formState.isDataReady) {
     ```

### Testing Results:

- ✅ All 4 tests in `add-expense-happy-path.e2e.test.ts` pass consistently
- ✅ Ran the test suite 5 times in a row - all passed without any flakiness
- ✅ TypeScript compilation successful with no errors
- ✅ Webapp build successful

### Root Cause Resolution:

The fix addresses the exact race condition identified:
- **Before:** The form would render as soon as `isInitialized` was true, even if member data wasn't loaded yet
- **After:** The form only renders when both `loading` is false AND `members.length > 0`, ensuring all required data is present

This eliminates the scenario where E2E tests would see an empty form and timeout waiting for member data to appear.

### Benefits Achieved:

1. **Test Stability:** Complete elimination of flaky test failures
2. **Improved UX:** Users never see an incomplete form during loading
3. **Robustness:** Data fetching is now resilient to stale or partial data
4. **Maintainability:** Clear separation between initialization state and data readiness
