# Remove Insecure Server-Side Login

**Problem**: The `login` handler in `firebase/functions/src/auth/handlers.ts` currently allows for server-side login in non-production environments without proper password verification. It creates a custom token for any user based solely on their email address, which is a major security vulnerability. This could allow an attacker to impersonate any user in a development or testing environment, bypassing authentication mechanisms.

**File**: `firebase/functions/src/auth/handlers.ts`

**Suggested Solution**:
1. **Remove the Server-Side Login**: The entire server-side login functionality (the `login` handler) should be removed. Authentication should *always* be handled client-side using the Firebase Auth SDK, which securely verifies user credentials (password, MFA, etc.) directly with Firebase's authentication service. The backend should never handle raw passwords or perform password verification.
2. **Update Tests**: Any tests that currently rely on this insecure server-side login endpoint must be updated. Instead, they should use the Firebase Auth REST API or the Firebase Admin SDK's `signInWithEmailAndPassword` (if running in a secure test environment) to obtain a valid ID token for a test user. This will make the tests more realistic and secure.

**Behavior Change**: This is a significant behavior change. The server-side login endpoint will be removed, and any client-side code or tests that directly call this endpoint will break. This is an intentional change to enforce secure authentication practices.

**Risk**: Medium. This change will require updates to the test suite and potentially any development scripts that use this endpoint. However, it is essential for improving the security of the application.

**Complexity**: Medium. This change involves removing the server-side login functionality and updating the test suite to use a secure authentication method, which might require some refactoring of existing tests.

**Benefit**: High. This change will eliminate a major security vulnerability, ensuring that the authentication process is secure in all environments and preventing unauthorized access through this backdoor.