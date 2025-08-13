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

---

## Claude's Implementation Plan

### Executive Summary
After reviewing the codebase, I confirm the analysis is accurate. The application lacks automatic token refresh, causing 401 errors after ~1 hour of inactivity. The proposed solution is solid, with some recommended enhancements for production robustness.

### Enhanced Implementation Strategy

#### Phase 1: Core Token Refresh Infrastructure
**File: `webapp-v2/src/app/stores/auth-store.ts`**

```typescript
class AuthStoreImpl {
  private refreshPromise: Promise<string> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  
  async refreshAuthToken(): Promise<string> {
    // Deduplicate concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }
  
  private async performTokenRefresh(): Promise<string> {
    const firebaseAuth = firebaseService.getAuth();
    const currentUser = firebaseAuth.currentUser;
    
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    
    try {
      const freshToken = await currentUser.getIdToken(true);
      apiClient.setAuthToken(freshToken);
      this.scheduleNextRefresh(freshToken);
      return freshToken;
    } catch (error) {
      logError('Token refresh failed', error);
      throw error;
    }
  }
  
  private scheduleNextRefresh(token: string): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    try {
      // Decode token to get expiration (basic JWT decode)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // Refresh 5 minutes before expiration
      const refreshIn = Math.max(0, timeUntilExpiry - (5 * 60 * 1000));
      
      this.refreshTimer = setTimeout(() => {
        this.refreshAuthToken().catch(error => {
          logError('Scheduled token refresh failed', error);
        });
      }, refreshIn);
    } catch (error) {
      // Fallback to 50-minute refresh if decode fails
      this.refreshTimer = setTimeout(() => {
        this.refreshAuthToken().catch(error => {
          logError('Scheduled token refresh failed', error);
        });
      }, 50 * 60 * 1000);
    }
  }
  
  private cleanup(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshPromise = null;
  }
}
```

#### Phase 2: Smart 401 Response Interceptor
**File: `webapp-v2/src/app/apiClient.ts`**

```typescript
class ApiClient {
  private refreshingToken = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    config: RequestConfig;
  }> = [];
  
  constructor() {
    // ... existing code ...
    this.setup401Interceptor();
  }
  
  private setup401Interceptor(): void {
    this.addResponseInterceptor(async (response, config) => {
      // Check if this is a 401/UNAUTHORIZED error
      if (response instanceof ApiError && 
          (response.code === 'UNAUTHORIZED' || 
           response.code === 'INVALID_TOKEN' ||
           response.requestContext?.status === 401)) {
        
        // Skip retry if already attempted
        if (config.skipAuth || (config as any).__retried) {
          throw response;
        }
        
        // If already refreshing, queue this request
        if (this.refreshingToken) {
          return new Promise((resolve, reject) => {
            this.failedQueue.push({ resolve, reject, config });
          });
        }
        
        this.refreshingToken = true;
        
        try {
          // Get auth store and refresh token
          const authStore = await getAuthStore();
          await authStore.refreshAuthToken();
          
          // Process queued requests
          this.processQueue(null);
          
          // Retry original request
          return this.request({
            ...config,
            __retried: true
          } as any);
        } catch (refreshError) {
          // Process queue with error
          this.processQueue(refreshError);
          
          // If refresh failed, likely need to re-login
          const authStore = await getAuthStore();
          await authStore.logout();
          
          throw response;
        } finally {
          this.refreshingToken = false;
        }
      }
      
      return response;
    });
  }
  
  private processQueue(error: any): void {
    this.failedQueue.forEach(({ resolve, reject, config }) => {
      if (error) {
        reject(error);
      } else {
        // Retry the request
        this.request(config).then(resolve).catch(reject);
      }
    });
    
    this.failedQueue = [];
  }
}
```

#### Phase 3: Component Lifecycle Management
**File: `webapp-v2/src/app/providers/AuthProvider.tsx`**

```typescript
export function AuthProvider({ children }: AuthProviderProps) {
  const [authStore, setAuthStore] = useState<AuthStore | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    const initializeAuthStore = async () => {
      try {
        const store = await getAuthStore();
        
        if (!mounted) return;
        
        // Start token refresh if user is authenticated
        if (store.user) {
          await store.refreshAuthToken();
        }
        
        setAuthStore(store);
      } catch (error) {
        if (!mounted) return;
        logError('Failed to initialize auth store', error);
        setInitError(error instanceof Error ? error.message : 'Auth initialization failed');
      }
    };
    
    initializeAuthStore();
    
    // Cleanup on unmount
    return () => {
      mounted = false;
    };
  }, []);
  
  // ... rest of component ...
}
```

### Critical Implementation Details

#### 1. Token Refresh Deduplication
- Single refresh promise shared across concurrent requests
- Prevents multiple simultaneous refresh attempts
- Queue failed requests during refresh

#### 2. JWT Expiration Handling
- Decode token to get exact expiration time
- Schedule refresh 5 minutes before expiry
- Fallback to 50-minute intervals if decode fails

#### 3. Request Retry Logic
- Mark retried requests to prevent infinite loops
- Queue concurrent requests during token refresh
- Process queue after successful refresh

#### 4. Error Recovery
- Logout user if refresh fails repeatedly
- Clear all auth state on logout
- Provide user-friendly error messages

#### 5. Cleanup Management
- Clear timers on logout/unmount
- Cancel pending refreshes
- Reset request queue

### Testing Checklist

#### Unit Tests
- [ ] Token refresh with valid user
- [ ] Token refresh with no user
- [ ] Concurrent refresh request deduplication
- [ ] JWT decode and expiration calculation
- [ ] Timer scheduling and cleanup

#### Integration Tests
- [ ] 401 response triggers refresh
- [ ] Successful retry after refresh
- [ ] Queue processing for concurrent requests
- [ ] Failed refresh triggers logout
- [ ] Component cleanup on unmount

#### Manual Testing Scenarios
- [ ] Leave app idle for 65 minutes (past 1-hour expiry)
- [ ] Make API call after token expiry
- [ ] Multiple tabs with same user
- [ ] Network disconnection during refresh
- [ ] Logout during pending refresh

### Performance Considerations

1. **Token Decode Optimization**
   - Cache decoded expiration time
   - Avoid repeated decoding

2. **Request Queue Management**
   - Limit queue size to prevent memory issues
   - Add timeout for queued requests

3. **Network Efficiency**
   - Batch API calls after refresh
   - Avoid unnecessary refresh attempts

### Security Considerations

1. **Token Storage**
   - Keep token in memory (already implemented)
   - Clear on logout (already implemented)

2. **Refresh Token Security**
   - Force refresh uses Firebase's secure mechanism
   - No custom refresh token handling needed

3. **Error Information**
   - Don't expose token details in logs
   - Sanitize error messages for users

### Rollout Strategy

1. **Feature Flag Implementation**
   ```typescript
   const ENABLE_AUTO_REFRESH = process.env.ENABLE_AUTO_REFRESH === 'true';
   ```

2. **Gradual Rollout**
   - Phase 1: Internal testing (1 week)
   - Phase 2: Beta users (1 week)
   - Phase 3: Full rollout

3. **Monitoring**
   - Track 401 error rates
   - Monitor refresh success/failure rates
   - Alert on abnormal logout rates

### Success Metrics

- **401 Error Rate**: Should drop to near 0%
- **User Session Duration**: Should increase significantly
- **Support Tickets**: Reduction in auth-related issues
- **User Satisfaction**: No more "session expired" frustrations

### Potential Edge Cases

1. **Clock Skew**: Server/client time mismatch
   - Solution: Add buffer time to expiration calculation

2. **Background Tab Behavior**: Timers may be throttled
   - Solution: Refresh on tab focus/visibility change

3. **Multiple Devices**: Token refresh on one device doesn't affect others
   - Solution: Each device manages its own token lifecycle

4. **Race Conditions**: Logout during refresh
   - Solution: Check auth state before completing refresh

### Alternative Approaches Considered

1. **Server-Side Token Refresh**
   - Pros: Centralized control
   - Cons: Additional server load, complexity
   - Decision: Client-side is simpler with Firebase

2. **Refresh on Every Request**
   - Pros: Always fresh token
   - Cons: Performance impact, rate limiting
   - Decision: Smart scheduling is more efficient

3. **WebSocket Keep-Alive**
   - Pros: Real-time token updates
   - Cons: Infrastructure complexity
   - Decision: Not needed for this use case