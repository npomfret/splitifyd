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

## Solution: Make the `DashboardPage` aware of the authentication state

The fix is to make the `DashboardPage` handle the loading state of the authentication process correctly.

### Implementation Plan

1.  **Expose Auth State**: The `useAuthRequired` hook already returns the entire `authStore`, which includes `loading` and `initialized` signals. No changes are needed here.

2.  **Update `DashboardPage.tsx`**:
    -   Destructure the `loading` and `initialized` properties from the `authStore` in addition to the `user`.
    -   Display a full-page `LoadingSpinner` if `authStore.loading` is `true`.
    -   Modify the redirect logic: only redirect to `/login` if `authStore.initialized` is `true` and `authStore.user` is `null`. This ensures the redirect only happens after authentication has definitively failed or the user is logged out.
