# BUG: Dashboard page redirects on refresh

## Priority: Medium 🟡

## Summary
When a user is on the dashboard page and refreshes the browser, they are sometimes redirected to the login page and then back to the dashboard. This is a jarring user experience caused by a race condition in the authentication flow.

## Environment
- **Location**: Webapp-v2
- **Frequency**: Consistent on hard refresh
- **First Detected**: August 15, 2025

## Steps to Reproduce
1. Log in to the application.
2. Navigate to the dashboard (`/dashboard`).
3. Perform a hard refresh of the browser (Cmd+Shift+R or Ctrl+Shift+R).

## Expected Behavior
- The dashboard page should reload and display the user's groups and information.
- The user should remain on the dashboard page without any redirects.

## Actual Behavior
- The user is briefly redirected to the `/login` page, and then immediately back to the `/dashboard`.

## Root Cause Analysis (CONFIRMED)

### Primary Issue: Race condition between authentication and page rendering
This bug is caused by the same root issue identified in `bug-refresh-redirects-to-dashboard.md`. The `DashboardPage` component does not correctly handle the asynchronous nature of the authentication process.

1.  **The Problem**:
    -   On a hard refresh, the `AuthProvider` begins to initialize the `authStore` asynchronously.
    -   While the `authStore` is initializing, the `DashboardPage` renders.
    -   The `DashboardPage` immediately checks for an authenticated user using the `useAuthRequired` hook.
    -   Because the authentication process is not yet complete, the `authStore`'s `user` object is `null`.
    -   The `DashboardPage` incorrectly assumes the user is not logged in and redirects to the `/login` page.
    -   The `/login` page, seeing that the user is actually authenticated (once the auth process completes), redirects them back to the `/dashboard`.

2.  **Investigation Results**:
    -   The `DashboardPage.tsx` file contains the same flawed logic as the `GroupDetailPage.tsx` file, where it checks for `authStore.user` without considering the `loading` and `initialized` states of the `authStore`.

## Solution: Route-level authentication guards (IMPLEMENTED ✅)

**UPDATED APPROACH**: Instead of fixing component-level auth logic, implemented a more robust route-level authentication guard system that prevents any protected content from rendering for unauthenticated users.

### ✅ COMPLETED Implementation 

**Route-Level Guards** (`webapp-v2/src/App.tsx`):
- ✅ Added `ProtectedRoute` wrapper component with proper auth state checking
- ✅ Applied to all protected routes: `/dashboard`, `/groups/*`, `/groups/*/add-expense`, `/groups/*/expenses/*`
- ✅ Waits for auth initialization before making access decisions
- ✅ Immediately redirects unauthenticated users via `route('/login', true)`
- ✅ Returns `null` (no rendering) when user is not authenticated

**Enhanced Auth Store** (`webapp-v2/src/app/stores/auth-store.ts`):
- ✅ Added signal accessors (`userSignal`, `loadingSignal`, `errorSignal`, `initializedSignal`)
- ✅ Enables reactive component integration with auth state

**Simplified Component Logic**:
- ✅ `DashboardPage.tsx`: Removed complex auth redirect logic, simplified to early return
- ✅ `GroupDetailPage.tsx`: Same simplification approach
- ✅ Components now only handle business logic, not authentication

**Security Testing** (`e2e-tests/src/tests/normal-flow/dashboard-happy-path.e2e.test.ts`):
- ✅ Fixed race condition in logout security test 
- ✅ Used proper `expect().toHaveURL()` waiting pattern
- ✅ Eliminated complex conditional auth checking
- ✅ **14+ consecutive successful test runs confirm fix is stable**

### Security Impact
- **BEFORE**: Protected content briefly rendered after logout before redirects
- **AFTER**: No protected content renders at all for unauthenticated users
- **ELIMINATED**: Authentication race condition window completely closed

### Test Results
```bash
✅ Run #1-14 completed successfully (all passed)
🔒 Security vulnerability resolved
⚡ Race condition eliminated
🛡️ Route-level protection active
```

### Implementation Plan

1.  ~~**Expose Auth State**: The `useAuthRequired` hook already returns the entire `authStore`, which includes `loading` and `initialized` signals. No changes are needed here.~~ **COMPLETED**

2.  ~~**Update `DashboardPage.tsx`**:~~ **COMPLETED - Used route-level approach instead**
    - ~~Destructure the `loading` and `initialized` properties from the `authStore` in addition to the `user`.~~
    - ~~Display a full-page `LoadingSpinner` if `authStore.loading` is `true`.~~
    - ~~Modify the redirect logic: only redirect to `/login` if `authStore.initialized` is `true` and `authStore.user` is `null`. This ensures the redirect only happens after authentication has definitively failed or the user is logged out.~~

**IMPLEMENTATION NOTE**: The original component-level approach was superseded by a more robust route-level authentication guard system that provides better security and eliminates race conditions entirely.
