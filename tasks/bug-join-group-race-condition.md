# BUG: Join group page has a race condition and uses a timeout hack

## Priority: Low 🟢

## Summary
The `JoinGroupPage` uses a `setTimeout` with a 100ms delay to wait for the authentication state to settle before redirecting to the login page. This is a fragile and unreliable way to handle the asynchronous nature of authentication and can lead to inconsistent behavior.

## Environment
- **Location**: Webapp-v2
- **Frequency**: Can occur on slow networks
- **First Detected**: August 15, 2025

## Steps to Reproduce
1.  Log out of the application.
2.  Navigate to a join group link (e.g., `/join?linkId=some-link-id`).
3.  On a slow network, the page might briefly show the loading state and then redirect to the login page. The 100ms timeout might not be enough time for the authentication state to be restored from the session.

## Expected Behavior
- The page should use the `loading` and `initialized` signals from the `authStore` to reliably determine the authentication status.
- The page should show a loading indicator while authentication is in progress.
- The page should only redirect to the login page after the authentication process is complete and no user is found.

## Actual Behavior
- The page uses a `setTimeout` of 100ms to wait for the authentication state to settle.
- This is a hacky workaround for the race condition and is not guaranteed to work, especially on slower connections.

## Root Cause Analysis (CONFIRMED)

### Primary Issue: Improper handling of asynchronous authentication
The `JoinGroupPage` component attempts to handle the race condition by using a `setTimeout`. This is a clear indication that the developer was aware of the issue but did not use the proper signals from the `authStore` to resolve it.

```typescript
// webapp-v2/src/pages/JoinGroupPage.tsx

useEffect(() => {
  // ...
  if (!isAuthenticated) {
    // Not authenticated - redirect to login with return URL after a short delay
    // to allow authentication state to settle
    setTimeout(() => {
      if (!authStore.user) {
        const returnUrl = encodeURIComponent(`/join?linkId=${actualLinkId}`);
        route(`/login?returnUrl=${returnUrl}`);
      }
    }, 100);
    return;
  }
  // ...
}, [actualLinkId, isAuthenticated]);
```

## Solution: Use the `loading` and `initialized` signals from the `authStore`

The fix is to refactor the `JoinGroupPage` to use the `loading` and `initialized` signals from the `authStore` to correctly handle the authentication state.

### Implementation Plan

1.  **Expose Auth State**: The `useAuthRequired` hook already returns the entire `authStore`, which includes `loading` and `initialized` signals.

2.  **Update `JoinGroupPage.tsx`**:
    -   Destructure the `loading` and `initialized` properties from the `authStore` in addition to the `user`.
    -   Remove the `setTimeout` hack.
    -   Use the `authLoading` signal to show a loading spinner while authentication is in progress.
    -   Modify the redirect logic to only redirect to `/login` if `authInitialized` is `true` and `user` is `null`.
