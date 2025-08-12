# Fix Sign Out Functionality

## Problem
When users click "Sign out", the application does not properly clear all state, causing the UI to still display as if the user is logged in. The page shows cached user data and groups even after signing out.

## Root Cause Analysis
1. The `authStore.logout()` method calls Firebase sign out successfully
2. Firebase auth state changes to null
3. **BUT** the `groupsStore` and `groupDetailStore` retain their cached data
4. The UI continues to show the cached data, making it appear the user is still logged in
5. No immediate redirect occurs after logout

## Solution

### 1. Clear All Stores on Logout
**File: `webapp-v2/src/app/stores/auth-store.ts`**

Add imports at the top:
```typescript
import { groupsStore } from './groups-store';
import { groupDetailStore } from './group-detail-store';
```

Update the `logout()` method to clear stores:
```typescript
async logout(): Promise<void> {
  loadingSignal.value = true;
  errorSignal.value = null;

  try {
    await firebaseService.signOut();
    apiClient.setAuthToken(null);
    localStorage.removeItem(USER_ID_KEY);
    
    // Clear all store data on logout
    groupsStore.reset();
    groupDetailStore.reset();
    
    // User state will be updated by onAuthStateChanged listener
  } catch (error: any) {
    errorSignal.value = this.getAuthErrorMessage(error);
    throw error;
  } finally {
    loadingSignal.value = false;
  }
}
```

Also update the `onAuthStateChanged` listener to clear stores when user becomes null:
```typescript
firebaseService.onAuthStateChanged(async (firebaseUser) => {
  if (firebaseUser) {
    userSignal.value = mapFirebaseUser(firebaseUser);
    
    // Get and store ID token for API authentication
    try {
      const idToken = await firebaseUser.getIdToken();
      apiClient.setAuthToken(idToken);
      localStorage.setItem(USER_ID_KEY, firebaseUser.uid);
    } catch (error) {
      logError('Failed to get ID token', error);
    }
  } else {
    userSignal.value = null;
    apiClient.setAuthToken(null);
    localStorage.removeItem(USER_ID_KEY);
    
    // Clear all stores when user becomes null
    groupsStore.reset();
    groupDetailStore.reset();
  }
  loadingSignal.value = false;
  initializedSignal.value = true;
});
```

### 2. Add Immediate Redirect After Logout
**File: `webapp-v2/src/components/layout/UserMenu.tsx`**

Add import:
```typescript
import { route } from 'preact-router';
```

Update the sign out button handler:
```typescript
<button
  onClick={async () => {
    try {
      await authStore.logout();
      // Force immediate redirect to login
      route('/login', true);
    } catch (error) {
      // Error is already handled in authStore
    }
  }}
  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
  disabled={authStore.loading}
>
  {authStore.loading ? 'Signing out...' : 'Sign out'}
</button>
```

## Benefits of This Approach
1. **No circular dependencies** - Stores don't import auth-store, only auth-store imports stores
2. **Double protection** - Stores are cleared both on manual logout and auth state changes
3. **Immediate feedback** - User is redirected instantly after clicking sign out
4. **Complete cleanup** - All cached data is properly cleared from memory
5. **Consistent behavior** - Works whether logout is triggered manually or by Firebase auth changes

## E2E Test Improvements

### Original Test Issue
The original e2e test "should handle user session management" was passing despite the bug because it only checked:
- Clicking sign out redirects to `/login`
- A "Sign In" button is visible on the login page

This was insufficient because it didn't test:
- Whether stores were actually cleared
- Whether protected pages remained inaccessible after logout
- Whether cached data was still displayed

### Improved Test Coverage
The tests have been enhanced to:
1. Create actual user data (a group) before logout
2. Verify dashboard redirects to login after logout
3. Test direct access to group URLs fails after logout
4. Check browser storage is cleared
5. Verify no user data remains visible in the DOM
6. Test that page reload doesn't restore authentication

The improved test now properly fails with:
```
Expected pattern: /\/login/
Received string: "http://localhost:9005/groups/TVuHWRTmXlK99Ih4UShG"
```

This confirms the bug where stores aren't cleared, allowing protected pages to display cached data.

## Testing
After implementation, verify:
1. Click "Sign out" from the user menu
2. Confirm immediate redirect to login page
3. Try navigating back to /dashboard - should redirect to login
4. Check browser dev tools - no user data should remain in memory
5. Sign in again and verify fresh data is loaded

## Implementation Complete ✅

### Changes Made

#### 1. Fixed `auth-store.ts` ✅
**File: `webapp-v2/src/app/stores/auth-store.ts`**

Added imports for stores to clear:
```typescript
import { groupsStore } from './groups-store';
import { groupDetailStore } from './group-detail-store';
```

Updated `logout()` method:
```typescript
async logout(): Promise<void> {
  loadingSignal.value = true;
  errorSignal.value = null;

  try {
    await firebaseService.signOut();
    apiClient.setAuthToken(null);
    localStorage.removeItem(USER_ID_KEY);
    
    // Clear all store data on logout
    groupsStore.reset();
    groupDetailStore.reset();
    
    // User state will be updated by onAuthStateChanged listener
  } catch (error: any) {
    errorSignal.value = this.getAuthErrorMessage(error);
    throw error;
  } finally {
    loadingSignal.value = false;
  }
}
```

Updated `onAuthStateChanged` listener:
```typescript
} else {
  userSignal.value = null;
  apiClient.setAuthToken(null);
  localStorage.removeItem(USER_ID_KEY);
  
  // Clear all stores when user becomes null (logout or session expired)
  groupsStore.reset();
  groupDetailStore.reset();
}
```

#### 2. Enhanced `UserMenu.tsx` ✅
**File: `webapp-v2/src/components/layout/UserMenu.tsx`**

Added import:
```typescript
import { route } from 'preact-router';
```

Updated sign out handler:
```typescript
<button
  onClick={async () => {
    try {
      await authStore.logout();
      // Force immediate redirect to login
      route('/login', true);
    } catch (error) {
      // Error is already handled in authStore
      console.error('Logout failed:', error);
    }
  }}
  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
  disabled={authStore.loading}
>
  {authStore.loading ? 'Signing out...' : 'Sign out'}
</button>
```

#### 3. Added Route Protection to `GroupDetailPage.tsx` ✅
**File: `webapp-v2/src/pages/GroupDetailPage.tsx`**

Added auth protection:
```typescript
// Redirect to login if not authenticated  
useEffect(() => {
  if (!currentUser.value) {
    route('/login', true);
    return;
  }
}, [currentUser.value]);

// Redirect if user is not authenticated (will happen in useEffect)
if (!currentUser.value) {
  return null;
}
```

### Test Results ✅

The improved e2e test now **PASSES**, confirming the fix works:

```
✓ 1 [chromium] › Dashboard User Journey › should properly clear all state and prevent unauthorized access after logout (5.6s)

1 passed (6.4s)
```

### Verification ✅

The fix successfully addresses all original issues:

1. **Stores are cleared** - `groupsStore.reset()` and `groupDetailStore.reset()` are called on logout
2. **Immediate redirect** - `route('/login', true)` provides instant feedback
3. **Route protection** - Protected pages redirect to login when `currentUser.value` is null
4. **Complete cleanup** - Works for both manual logout and Firebase auth state changes
5. **Consistent behavior** - Stores cleared in both logout scenarios

### Future Considerations
- Consider adding a central event bus for auth state changes
- Could implement a `StoreManager` class to centrally manage all store lifecycles
- Add logging to track store clearing for debugging
- Consider applying similar auth protection to other protected pages (`DashboardPage`, etc.)