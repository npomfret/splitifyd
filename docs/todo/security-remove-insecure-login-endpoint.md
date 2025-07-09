# Problematic Server-Side Login Handler

## Problem
- **Location**: `firebase/functions/src/auth/handlers.ts`
- **Description**: The `login` function contains logic that is explicitly disabled in production (`CONFIG.isProduction`). It creates a custom token for testing, but this is not a secure or standard way to handle user login. The comment in the code correctly states that authentication should be done client-side with the Firebase Auth SDK. This server-side endpoint is misleading, insecure for any real environment, and serves no purpose in production.
- **Current vs Expected**:
  - **Current**: A server-side `/login` endpoint exists but is disabled in production and uses custom tokens for non-production environments.
  - **Expected**: There should be no server-side `/login` endpoint. Authentication should be handled entirely by the Firebase client-side SDK, which securely communicates with Firebase Auth services. The client receives an ID token upon successful login, which it then sends to the backend for authenticated API requests.

## Solution
1.  **Remove the `/login` endpoint**: Delete the `login` function from `firebase/functions/src/auth/handlers.ts`.
2.  **Remove the route**: Remove the `app.post('/login', ...)` route from `firebase/functions/src/index.ts`.
3.  **Update Client-Side Logic**: Ensure the client-side code in `webapp/js/auth.js` uses the Firebase Auth SDK to sign in the user. The client should get the ID token from the result and store it.
4.  **Update Tests**: Any tests that rely on this server-side endpoint should be refactored to use the Firebase Auth REST API for creating test users and getting tokens, or use the client SDK's authentication flow.

Example of client-side login with Firebase SDK:

```javascript
// In webapp/js/auth.js
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();
signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed in 
    const user = userCredential.user;
    return user.getIdToken();
  })
  .then((idToken) => {
    // Store idToken and redirect to dashboard
    localStorage.setItem('splitifyd_auth_token', idToken);
    window.location.href = 'dashboard.html';
  })
  .catch((error) => {
    // Handle errors
  });
```

## Impact
- **Type**: Behavior change (removes an API endpoint).
- **Risk**: Medium (requires changes to client-side authentication and tests).
- **Complexity**: Moderate
- **Benefit**: High value (removes insecure and unnecessary code, aligns with best practices).

## Implementation Notes
- This change simplifies the backend and makes the authentication flow more secure and standard.
- The client-side `webapp/js/auth.js` will need significant changes to integrate the Firebase Auth SDK.
- This is a critical step to making the application production-ready.
