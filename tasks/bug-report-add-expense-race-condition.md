# Bug Report: Add Expense Page - Race Condition on Load

**ID:** BUG-001
**Status:** Confirmed
**Severity:** High
**Date Reported:** 2025-08-18

## 1. Summary

The "Add Expense" page sometimes fails to render properly, getting stuck on the loading spinner indefinitely. This appears to be caused by a race condition during the component's initialization, where the loading state is set to `false` before the necessary data (group members) has been fully populated in the client-side store.

## 2. How We Found It

The bug was initially reported as an intermittent issue that was difficult to reproduce. To diagnose it, we took the following steps:

1.  **Initial Hypothesis:** We suspected a race condition in the data loading process. The `AddExpensePage` component's readiness to render is controlled by a computed signal, `isDataReady`, which depends on both the `loading` state and the presence of `members` in a data store.

2.  **Instrumentation:** To make the state of the system visible, we instrumented the code:
    *   We added a new `initializationState` signal to the `useExpenseForm` hook to track the stages of the form's initialization (`idle`, `fetchingGroup`, `done`, etc.).
    *   We modified the loading screen on the `AddExpensePage` to display the real-time values of `initializationState`, the `loading` signal, and the number of `members`.

3.  **Confirmation:** By running the application with this instrumentation, we were able to reliably reproduce the bug and observe the exact state that caused the issue. The UI displayed the following state when the loading spinner was stuck:

    ```
    State: done, Loading: false, Members: 0
    ```

    This confirmed that:
    *   The `initializeForm` function was completing successfully (`State: done`).
    *   The data store had finished its fetching operation (`Loading: false`).
    *   Crucially, the `members` array in the store had not yet been populated (`Members: 0`).

## 3. Root Cause Analysis

The root cause is a subtle race condition between the `enhancedGroupDetailStore` updating its `loading` state and populating its `members` array. The `isDataReady` computed signal in `useExpenseForm.ts` was checking these two conditions:

```typescript
const isDataReady = useComputed(() => {
    return !loading.value && members.value.length > 0;
});
```

In the failure case, the `loading` signal becomes `false` a fraction of a second before the `members` signal is updated with the fetched data. This causes `isDataReady` to evaluate to `false` and remain that way, as there are no further state changes to trigger its re-evaluation.

## 4. Suggestions for a Fix

This report is for documentation purposes, and no fix will be implemented at this time.

However, a robust solution would be to modify the `enhancedGroupDetailStore` to guarantee that `loading` is only set to `false` *after* all data, including members, has been successfully written to the store. This could be achieved by batching the state updates within the store.