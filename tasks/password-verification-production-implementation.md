# Password Verification Production Implementation

## Context

During debugging of the password change functionality, we discovered that the `verifyPassword` method in `FirebaseAuthService.ts` was not implemented, causing password change operations to fail with "Authentication service error".

## Current State

**File**: `firebase/functions/src/services/auth/FirebaseAuthService.ts:351-503`

The runtime implementation now:

- Calls the Firebase Identity Toolkit `signInWithPassword` endpoint for both production and emulator environments (the caller provides the base URL/API key, typically sourced via the shared config helpers).
- Returns `false` for invalid credentials (`INVALID_PASSWORD`, `EMAIL_NOT_FOUND`, `USER_DISABLED`) and throws typed `ApiError`s for rate limiting or transport failures.
- Surfaces configuration mistakes early (missing API key) before attempting any network call.
- Uses the supplied `password` parameter (TS6133 warning resolved).
- Uses the built-in global `fetch` API (mocked in unit tests) to avoid custom plumbing.
- Receives Identity Toolkit base URL and API key via constructor options (wired up through the shared config helpers), keeping runtime concerns out of the service.

On the test side:

- `StubAuthService` now stores seeded passwords (defaulting to `ValidPass123!`) so unit suites can assert both success and failure flows realistically.
- New unit coverage in `FirebaseAuthService.verifyPassword.test.ts` exercises success, invalid credentials, rate limiting, network failures, emulator URL resolution, and configuration omissions.
- Additional stub-focused tests ensure the in-memory auth behaves like the production path.

## Production Requirements

For production deployment, this method **MUST** be properly implemented to actually verify passwords. Current implementation is a **security risk** in production.

### Recommended Approach

1. **Firebase Auth REST API Integration**
    - Use Firebase Auth REST API `signInWithPassword` endpoint
    - Handle emulator vs production endpoints correctly
    - Proper error handling for invalid credentials vs service errors

2. **Configuration Requirements**
    - Proper Firebase API key configuration
    - Environment-specific endpoint handling
    - No fallback values that could mask configuration issues

3. **Security Considerations**
    - Proper logging (without exposing passwords)
    - Handle all Firebase Auth error scenarios
    - Ensure no credential information leaks in error messages

### Example Production Implementation Structure

```typescript
async verifyPassword(email: string, password: string): Promise<boolean> {
    // Get Firebase config
    const apiKey = this.auth.app.options.apiKey;
    if (!apiKey) {
        throw new Error('Firebase API key not configured');
    }

    // Determine auth endpoint (emulator vs production)
    const authUrl = this.getAuthEndpoint();

    try {
        const response = await this.makeAuthRequest(authUrl, {
            email,
            password,
            returnSecureToken: true
        });

        return response.ok;
    } catch (error) {
        // Handle specific error cases
        if (this.isInvalidCredentialsError(error)) {
            return false;
        }
        throw error; // Re-throw service errors
    }
}
```

## Action Items

1. **Before Production Deployment**:
    - [x] Implement proper password verification using Firebase Auth REST API
    - [x] Add comprehensive error handling for all auth scenarios
    - [x] Write unit tests covering both valid/invalid credentials (integration smoke test deemed unnecessary for now)
    - [x] Remove the TS6133 warning by using the password parameter
    - [ ] *(Deferred)* Rate limiting to be handled separately once infra support exists

2. **Testing Requirements**:
    - [x] Test with valid credentials (should return `true`)
    - [x] Test with invalid password (should return `false`)
    - [x] Test with non-existent user (should return `false`)
    - [x] Test service error scenarios (should throw)
    - [x] Test configuration missing scenarios (should throw)

3. **Security Review**:
    - [ ] Audit for credential leaks in logs/errors
    - [ ] Review error messages for information disclosure

## Implementation Plan (2024-XX-XX)

1. ✅ Introduce a shared REST client in `FirebaseAuthService` that can call the Identity Toolkit endpoints using the project’s API key (reusing emulator URL handling logic).
2. ✅ Wire configuration through existing service setup so production deploys fail fast if the API key or endpoint is missing.
3. ✅ Expand `StubAuthService.verifyPassword` to hold password state so unit tests can assert real success/failure paths once the live implementation lands.
4. ✅ Add targeted unit tests for the new client (success, invalid credentials, rate limiting, transport failure, config omissions).
5. ⏳ *(Deferred)* Add documentation once an infrastructure-backed rate-limiting solution is available.

## Risk Level

**MEDIUM** - Runtime verification now checks passwords against Firebase Auth. Remaining risk comes from the pending integration-level confirmation and broader rate-limiting strategy.

## Related Files

- `firebase/functions/src/services/auth/FirebaseAuthService.ts` - Main implementation
- `firebase/functions/src/services/auth/IAuthService.ts` - Interface definition
- `firebase/functions/src/services/UserService2.ts` - Consumer of verifyPassword
- `e2e-tests/src/__tests__/integration/user-management-comprehensive.e2e.test.ts` - Test coverage

## Notes

- Unit tests now cover the happy path, invalid credentials, rate limits, network failures, and misconfiguration scenarios.
- Stub auth supports explicit password seeding; existing helper flows default to `ValidPass123!`.
- Follow-up: none beyond deferring rate limiting until infrastructure support is available.
