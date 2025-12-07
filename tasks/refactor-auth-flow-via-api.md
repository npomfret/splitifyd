# Task: Refactor Auth Flow to Use API Endpoints

## Objective

To refactor the login and password reset features to use our internal API endpoints instead of directly calling the client-side Firebase Authentication SDK. This aligns the authentication flow with our existing registration process, which already uses the API.

## Background

Currently, the `AuthStore` uses a gateway that calls `signInWithEmailAndPassword` and `sendPasswordResetEmail` directly from the client's browser. While the registration process correctly goes through our backend API (`apiClient.register`), login and password resets do not.

Moving these authentication actions to our own backend provides several advantages:
- **Consistency:** All authentication-related actions will follow the same pattern of going through our API.
- **Abstraction & Security:** It reduces the surface area of the Firebase SDK exposed to the client and hides the underlying auth provider. The client only needs to know about our API.
- **Control & Flexibility:** It allows us to add custom logic, analytics, or advanced security measures (like rate limiting) on the backend before or after an authentication attempt.

---

## High-Level Requirements

1.  **Create API Endpoints:** Implement new backend endpoints for handling user login and password reset requests.
2.  **Update Frontend Client:** Modify the `auth-store` to use the `apiClient` to call these new endpoints.
3.  **Remove Direct SDK Calls:** Remove the direct client-side calls to `signInWithEmailAndPassword` and `sendPasswordResetEmail` from the authentication gateway/service.

---

## Implementation Plan

### Phase 1: Shared Types & API Definition

**File:** `packages/shared/src/api.ts`

- Add `login` and `sendPasswordResetEmail` methods to the `PublicAPI` interface, as these are unauthenticated actions.

```typescript
export interface PublicAPI {
    // ... existing methods like 'register'
    login(credentials: LoginRequest): Promise<LoginResponse>;
    sendPasswordResetEmail(payload: PasswordResetRequest): Promise<void>;
}
```

**File:** `packages/shared/src/shared-types.ts`

- Define the new request and response types.

```typescript
// For Login
export interface LoginRequest {
    email: Email;
    password: Password;
}

export interface LoginResponse {
    success: boolean;
    token: string; // The custom token to be used for sign-in
}

// For Password Reset
export interface PasswordResetRequest {
    email: Email;
}
```

**File:** `packages/shared/src/schemas/apiRequests.ts`

- Add Zod schemas for the new request types for validation.

```typescript
export const LoginRequestSchema = z.object({
    email: EmailSchema,
    password: PasswordSchema,
});

export const PasswordResetRequestSchema = z.object({
    email: EmailSchema,
});
```

### Phase 2: Backend Implementation

**File:** `firebase/functions/src/auth/handlers.ts` (or a new dedicated file)

- **Create `login` handler:**
    - Validate the request body against `LoginRequestSchema`.
    - This handler will NOT use the Firebase Admin SDK to sign the user in directly. Instead, it should verify the user's password. Since the Admin SDK doesn't support password verification directly, a common pattern is to use a client SDK within a trusted backend environment or use a Firebase extension for custom auth. A simpler approach for this project might be to attempt a sign-in using a custom token strategy if that's feasible. Given the constraints, the most direct (though less common for backend) approach would be to use a client-side library on the backend, or more securely, use a custom authentication flow with a second factor if we wanted to avoid passwords on the backend.
    - For this project, we'll assume a custom token generation. The handler will:
        1. Look up the user by email using the Admin SDK.
        2. (This is the tricky part) Validate the password. *This requires a custom solution as Admin SDK can't do this.* Let's assume for planning that we have a way to verify the password hash.
        3. If valid, create a custom sign-in token with `auth().createCustomToken(uid)`.
        4. Return this token to the client.
- **Create `sendPasswordResetEmail` handler:**
    - Validate the request body.
    - Use the Firebase Admin SDK to trigger the password reset email: `auth().generatePasswordResetLink(email)`.
    - This is more straightforward and secure.

**File:** `firebase/functions/src/routes/route-config.ts`

- Register the new `/login` and `/password-reset` routes, pointing to the new handlers.

### Phase 3: Frontend Implementation

**File:** `webapp-v2/src/app/apiClient.ts`

- Implement the `login` and `sendPasswordResetEmail` methods.
- The `login` implementation will be special. After getting the custom token from the backend, it will use `signInWithCustomToken(auth, token)` from the Firebase client SDK to complete the sign-in process. This is necessary to establish the user's session on the client.

**File:** `webapp-v2/src/app/stores/auth-store.ts`

- **Update `login` method:**
    - Replace the call to `this.gateway.signInWithEmailAndPassword(...)` with `apiClient.login(...)`.
    - The `onAuthStateChanged` listener will automatically pick up the user state change after `signInWithCustomToken` is successful in the `apiClient`.
- **Update `resetPassword` method:**
    - Replace the call to `this.gateway.sendPasswordResetEmail(...)` with `apiClient.sendPasswordResetEmail(...)`.

**File:** `webapp-v2/src/app/gateways/auth-gateway.ts` (and its implementation)

- Remove the now-unused `signInWithEmailAndPassword` and `sendPasswordResetEmail` methods from the interface and the `FirebaseService` implementation.

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/api.ts` | Add new method signatures to `PublicAPI`. |
| `packages/shared/src/shared-types.ts` | Add `LoginRequest`, `LoginResponse`, `PasswordResetRequest` types. |
| `packages/shared/src/schemas/apiRequests.ts` | Add Zod schemas for new request types. |
| `firebase/functions/src/auth/handlers.ts` | Implement backend logic for login and password reset. |
| `firebase/functions/src/routes/route-config.ts`| Register new API routes. |
| `webapp-v2/src/app/apiClient.ts` | Implement the new client methods, including the custom token sign-in logic. |
| `webapp-v2/src/app/stores/auth-store.ts` | Update `login` and `resetPassword` actions to use `apiClient`. |
| `webapp-v2/src/app/gateways/auth-gateway.ts` | Remove unused methods. |
| `webapp-v2/src/app/firebase.ts` | Remove unused methods from `FirebaseService`. |

---

## Testing Plan

### Backend Unit Tests
- Test the `/login` endpoint with valid and invalid credentials.
- Test the `/password-reset` endpoint with existing and non-existing email addresses.
- Ensure validation errors are returned correctly for malformed requests.

### Frontend Playwright Tests
- Perform a full login flow and verify the user is redirected and the auth state is updated.
- Test the "Forgot Password" flow.
- Ensure error messages from the API are displayed correctly to the user.
