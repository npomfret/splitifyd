# BUG: Refreshing group page redirects to dashboard

## Priority: Medium 🟡

## Summary
When a user is on a group detail page and refreshes the browser, they are redirected to the dashboard instead of staying on the group page. This is a frustrating user experience that makes it difficult to share links to specific group pages.

## Environment
- **Location**: Webapp-v2
- **Frequency**: Consistent
- **First Detected**: August 15, 2025

## Steps to Reproduce
1. Log in to the application.
2. Navigate to a group detail page (e.g., `/groups/some-group-id`).
3. Refresh the browser.

## Expected Behavior
- The group detail page should reload and display the group information.
- The user should remain on the group page.

## Actual Behavior
- The user is redirected to the dashboard (`/dashboard`).

## Root Cause Analysis (CONFIRMED)

### Primary Issue: Race condition between authentication and page rendering
A deep dive into the webapp's architecture revealed a race condition between the asynchronous authentication process and the rendering of the `GroupDetailPage`.

1.  **The Problem**:
    -   On a hard refresh, the `AuthProvider` begins to initialize the `authStore` asynchronously.
    -   While the `authStore` is initializing, the `GroupDetailPage` renders.
    -   The `GroupDetailPage` immediately checks for an authenticated user using the `useAuthRequired` hook.
    -   Because the authentication process is not yet complete, the `authStore`'s `user` object is `null`.
    -   The `GroupDetailPage` incorrectly assumes the user is not logged in and redirects to the `/login` page.
    -   The `/login` page, seeing that the user is actually authenticated (once the auth process completes), redirects them to the `/dashboard`.

2.  **Investigation Results**:
    -   `App.tsx`: Standard routing with `preact-router`.
    -   `useAuth`: Simple context consumer.
    -   `AuthProvider.tsx`: Asynchronously initializes the `authStore`. This is the source of the delay.
    -   `auth-store.ts`: The `initializeAuth` method is async and relies on Firebase's `onAuthStateChanged` listener.
    -   `GroupDetailPage.tsx`: The component does not account for the `loading` or `initialized` state of the `authStore`. It assumes a `null` user means "not logged in" rather than "authentication in progress".

## Solution: Make the `GroupDetailPage` aware of the authentication state

The fix is to make the `GroupDetailPage` handle the loading state of the authentication process correctly.

### Implementation Plan

1.  **Expose Auth State**: The `useAuthRequired` hook already returns the entire `authStore`, which includes `loading` and `initialized` signals. No changes are needed here.

2.  **Update `GroupDetailPage.tsx`**:
    -   Destructure the `loading` and `initialized` properties from the `authStore` in addition to the `user`.
    -   Display a full-page `LoadingSpinner` if `authStore.loading` is `true`.
    -   Modify the redirect logic: only redirect to `/login` if `authStore.initialized` is `true` and `authStore.user` is `null`. This ensures the redirect only happens after authentication has definitively failed or the user is logged out.

### Example Code Snippet (for `GroupDetailPage.tsx`):

```typescript
// Before
const authStore = useAuthRequired();
const currentUser = useComputed(() => authStore.user);

useEffect(() => {
  if (!currentUser.value) {
    route('/login', true);
  }
}, [currentUser.value]);

if (!currentUser.value) {
  return null;
}

// After
const authStore = useAuthRequired();
const { user: currentUser, loading: authLoading, initialized: authInitialized } = authStore;

// Show loading spinner while auth is initializing
if (authLoading.value) {
  return <LoadingSpinner fullPage />;
}

// Redirect to login only after auth has been initialized and no user is found
useEffect(() => {
  if (authInitialized.value && !currentUser.value) {
    route('/login', true);
  }
}, [authInitialized.value, currentUser.value]);

// Render page content only if there is a user
if (currentUser.value) {
  // ... page content
}
```

## Benefits
- **Fixes the Bug**: Users will no longer be redirected away from group pages on refresh.
- **Improves UX**: Provides a clear loading state to the user instead of a jarring redirect.
- **Robustness**: Makes the page more resilient to network latency during the authentication process.
