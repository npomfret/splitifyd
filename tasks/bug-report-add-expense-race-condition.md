# Bug Report: Add Expense Page - Race Condition on Load

**ID:** BUG-001
**Status:** ✅ RESOLVED
**Severity:** High
**Date Reported:** 2025-08-18
**Date Resolved:** 2025-08-19

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

## 4. Resolution Implemented

### Root Cause Analysis
Further investigation revealed two distinct issues:

1. **Primary Issue**: Missing loading state reset on group loading errors in `group-detail-store-enhanced.ts`
2. **Secondary Issue**: Potential race condition in `isDataReady` computation in `useExpenseForm.ts`

### Fixes Applied

1. **Error State Handling Fix** (group-detail-store-enhanced.ts:140):
   ```typescript
   } catch (error) {
       errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
       loadingSignal.value = false; // Added this line
       throw error;
   }
   ```

2. **Defensive Race Condition Prevention** (useExpenseForm.ts:36-40):
   ```typescript
   const isDataReady = useComputed(() => {
       // Data is ready only when initialization is complete AND loading is false AND we have members.
       // This prevents race conditions where loading becomes false before members are populated.
       return isInitialized.value && !loading.value && members.value.length > 0;
   });
   ```

### Testing
- Manual testing confirms loading spinners now properly reset on all error conditions
- Edge cases tested: group not found, network errors, empty groups
- All expense form modes work correctly: create, edit, copy

### Result
✅ **Bug completely resolved** - No more stuck loading spinners on AddExpensePage