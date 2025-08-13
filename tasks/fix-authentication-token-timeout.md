# Fix Authentication Token Timeout Issue

**Status:** Open  
**Priority:** High  
**Type:** Bug Fix  
**Estimated Effort:** Medium

## Problem Description

The webapp displays "Invalid authentication token" errors after periods of user inactivity, causing the application to become unusable until the user manually refreshes the page or logs out and back in.

### Symptoms Observed
- 401 (Unauthorized) errors in browser console after ~1 hour of inactivity
- "Error Loading Group" messages displayed to users
- API calls failing with `INVALID_TOKEN` or `UNAUTHORIZED` error codes
- Multiple failed requests attempting to retry without token refresh

### Screenshot Evidence
![Authentication Error Screenshot](image-shows-401-errors-and-invalid-token-messages)

## Root Cause Analysis

### Current Authentication Flow
1. **Token Acquisition**: Firebase ID tokens obtained via `getIdToken()` during:
   - Initial login (`auth-store.ts:80`)
   - Auth state changes (`auth-store.ts:46`)
2. **Token Storage**: Stored in `apiClient.setAuthToken()` and localStorage
3. **Token Usage**: Added to API requests via `Authorization: Bearer` header

### Key Issues Identified

#### 1. No Automatic Token Refresh
- Firebase ID tokens expire after 1 hour
- `getIdToken()` called only during login/auth state changes
- No mechanism to refresh tokens before expiration
- **Location**: `webapp-v2/src/app/stores/auth-store.ts:46, 80`

#### 2. Missing 401 Response Handling  
- API client has interceptor infrastructure but no 401 handler
- Failed requests not retried after token refresh
- **Location**: `webapp-v2/src/app/apiClient.ts` (interceptors at lines 174-240)

#### 3. No Token Expiration Monitoring
- No validation of token validity before API calls
- No proactive refresh scheduling
- Tokens continue to be used after expiration

## Technical Architecture Review

### Current Components
- **AuthStore** (`auth-store.ts`): Manages auth state and Firebase user
- **ApiClient** (`apiClient.ts`): HTTP client with interceptor support
- **FirebaseService** (`firebase.ts`): Firebase authentication wrapper

### Existing Infrastructure Available
- Request/response interceptor system already implemented
- Firebase `onAuthStateChanged` listener active
- Token storage and retrieval mechanisms in place

## Proposed Solution

### 1. Implement Automatic Token Refresh
```typescript
// In auth-store.ts
private async refreshAuthToken(): Promise<void> {
  const firebaseAuth = firebaseService.getAuth();
  const currentUser = firebaseAuth.currentUser;
  
  if (currentUser) {
    const freshToken = await currentUser.getIdToken(true); // Force refresh
    apiClient.setAuthToken(freshToken);
  }
}
```

### 2. Add 401 Response Interceptor
```typescript
// In apiClient.ts or auth-store.ts
apiClient.addResponseInterceptor(async (response, config) => {
  if (response.code === 'UNAUTHORIZED') {
    await authStore.refreshAuthToken();
    // Retry the original request with fresh token
    return apiClient.request(config);
  }
  return response;
});
```

### 3. Implement Periodic Token Refresh
```typescript
// Refresh every 50 minutes (before 1-hour expiration)
setInterval(async () => {
  if (authStore.user) {
    await authStore.refreshAuthToken();
  }
}, 50 * 60 * 1000);
```

### 4. Add Token Validation
- Check token expiration before API calls
- Validate JWT payload for expiry timestamp
- Prevent expired tokens from being sent

## Implementation Plan

### Phase 1: Core Token Refresh Logic
- [ ] Add `refreshAuthToken()` method to `AuthStore`
- [ ] Implement token expiration checking
- [ ] Test token refresh functionality

### Phase 2: Response Interceptor Integration  
- [ ] Create 401 response interceptor
- [ ] Implement automatic request retry after token refresh
- [ ] Handle refresh failures gracefully

### Phase 3: Proactive Refresh System
- [ ] Set up periodic token refresh timer
- [ ] Add user activity detection to optimize refresh timing
- [ ] Implement cleanup on logout/auth state changes

### Phase 4: Testing & Validation
- [ ] Test token expiration scenarios
- [ ] Verify automatic recovery from 401 errors
- [ ] Validate no-op behavior for unauthenticated users

## Files to Modify

1. **`webapp-v2/src/app/stores/auth-store.ts`**
   - Add `refreshAuthToken()` method
   - Implement periodic refresh timer
   - Handle refresh error scenarios

2. **`webapp-v2/src/app/apiClient.ts`** 
   - Add response interceptor for 401 handling
   - Implement request retry logic
   - Update error handling for token refresh failures

3. **`webapp-v2/src/app/providers/AuthProvider.tsx`**
   - Set up automatic refresh scheduling
   - Handle component cleanup for timers

## Testing Strategy

### Unit Tests
- Token refresh method functionality
- 401 interceptor behavior
- Error handling edge cases

### Integration Tests  
- End-to-end token expiration flow
- Automatic recovery from expired tokens
- Multiple concurrent request handling

### Manual Testing
- Leave app idle for >1 hour and verify automatic recovery
- Simulate network disconnection during token refresh
- Test behavior with invalid/malformed tokens

## Risk Assessment

### Low Risk
- Uses existing Firebase APIs (`getIdToken(true)`)
- Leverages current interceptor infrastructure
- Non-breaking changes to existing functionality

### Mitigation Strategies
- Graceful fallback to manual re-authentication
- Comprehensive error logging for debugging
- Feature flags for gradual rollout

## Success Criteria

- [ ] No 401 errors after extended inactivity periods
- [ ] Seamless user experience during token refresh
- [ ] Zero manual intervention required for token expiration
- [ ] Proper cleanup and resource management
- [ ] Comprehensive error handling and recovery

## Dependencies

- Firebase Auth SDK (already integrated)
- Existing interceptor system (already implemented)
- Browser localStorage API (already in use)

## References

- Firebase Auth Documentation: ID Token Refresh
- Current codebase: `webapp-v2/src/app/stores/auth-store.ts`
- API Client implementation: `webapp-v2/src/app/apiClient.ts`