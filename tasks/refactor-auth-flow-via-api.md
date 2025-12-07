# Task: Refactor Auth Flow to Use API Endpoints

## Objective

To refactor the login and password reset features to use our internal API endpoints instead of directly calling the client-side Firebase Authentication SDK. This aligns the authentication flow with our existing registration process, which already uses the API.

## Key Finding

**The "tricky part" is already solved.** The `FirebaseAuthService` (lines 426-500 in `firebase/functions/src/services/auth/FirebaseAuthService.ts`) already has a `verifyPassword()` method that uses the Firebase Identity Toolkit REST API to validate credentials server-side. This removes the main technical uncertainty from the original plan.

The existing method:
- Uses `SIGN_IN_WITH_PASSWORD_ENDPOINT` (`/v1/accounts:signInWithPassword`)
- Returns `true`/`false` based on credential validity
- Already handles rate limiting (`TOO_MANY_ATTEMPTS_TRY_LATER`)
- Properly maps Firebase errors to application errors

---

## Background

Currently, the `AuthStore` uses a gateway that calls `signInWithEmailAndPassword` and `sendPasswordResetEmail` directly from the client's browser. While the registration process correctly goes through our backend API (`apiClient.register`), login and password resets do not.

Moving these authentication actions to our own backend provides several advantages:
- **Consistency:** All authentication-related actions will follow the same pattern of going through our API.
- **Abstraction & Security:** It reduces the surface area of the Firebase SDK exposed to the client and hides the underlying auth provider. The client only needs to know about our API.
- **Control & Flexibility:** It allows us to add custom logic, analytics, or advanced security measures (like rate limiting) on the backend before or after an authentication attempt.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Password reset email | Firebase REST API (`sendOobCode`) | Simple, uses Firebase's templates; custom email upgrade planned for later |
| Login error handling | Generic `INVALID_CREDENTIALS` | Prevents email enumeration attacks - same error for wrong email or wrong password |
| Login persistence | Client-side (`setPersistence`) | Keep existing pattern, called before API login |

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
    customToken: string; // The custom token to be used for signInWithCustomToken
}

// For Password Reset
export interface PasswordResetRequest {
    email: Email;
}
// No response body needed - 204 No Content
```

**File:** `packages/shared/src/schemas/apiRequests.ts`

- Add Zod schemas for the new request types for validation.

```typescript
export const LoginRequestSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, 'Password is required'),
});

export const PasswordResetRequestSchema = z.object({
    email: EmailSchema,
});
```

**File:** `packages/shared/src/constants.ts`

- Add the password reset endpoint constant.

```typescript
export const SEND_OOB_CODE_ENDPOINT = '/v1/accounts:sendOobCode';
```

### Phase 2: Backend Implementation

**File:** `firebase/functions/src/services/auth/IAuthService.ts`

- Add method to the interface:

```typescript
sendPasswordResetEmail(email: Email): Promise<void>;
```

**File:** `firebase/functions/src/services/auth/FirebaseAuthService.ts`

- Implement `sendPasswordResetEmail()` using Firebase REST API `sendOobCode` endpoint
- Follow the same pattern as existing `verifyPassword()` method

**File:** `firebase/functions/src/auth/handlers.ts` (new file)

- **Create `login` handler:**
    1. Validate the request body against `LoginRequestSchema`.
    2. Call `authService.verifyPassword(email, password)` - **already exists!**
    3. If invalid → return 401 with generic `INVALID_CREDENTIALS` (no email enumeration)
    4. Call `authService.getUserByEmail(email)` to get UID
    5. Call `authService.createCustomToken(uid)` to generate token
    6. Return `{ success: true, customToken }`

- **Create `sendPasswordResetEmail` handler:**
    1. Validate the request body against `PasswordResetRequestSchema`.
    2. Call `authService.sendPasswordResetEmail(email)` using Firebase REST API
    3. Return 204 No Content (even for non-existent emails - no enumeration)

**File:** `firebase/functions/src/routes/route-config.ts`

- Register the new routes:
  - `POST /login` → loginHandler (no middleware, public)
  - `POST /password-reset` → passwordResetHandler (no middleware, public)

### Phase 3: Frontend Implementation

**File:** `webapp-v2/src/app/apiClient.ts`

- Implement the `login` and `sendPasswordResetEmail` methods.

```typescript
async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request({
        endpoint: '/login',
        method: 'POST',
        body: credentials,
    });
    // Sign in with the custom token to establish client session
    await signInWithCustomToken(auth, response.customToken);
    return response;
}

async sendPasswordResetEmail(payload: PasswordResetRequest): Promise<void> {
    await this.request({
        endpoint: '/password-reset',
        method: 'POST',
        body: payload,
    });
}
```

**File:** `webapp-v2/src/app/stores/auth-store.ts`

- **Update `login` method:**
    1. Keep existing `gateway.setPersistence()` call (client-side persistence)
    2. Replace `gateway.signInWithEmailAndPassword()` with `apiClient.login()`
    3. `signInWithCustomToken` happens inside apiClient, triggers `onAuthStateChanged`
- **Update `resetPassword` method:**
    - Replace `gateway.sendPasswordResetEmail()` with `apiClient.sendPasswordResetEmail()`

**File:** `webapp-v2/src/app/gateways/auth-gateway.ts` (and its implementation)

- Remove the now-unused `signInWithEmailAndPassword` and `sendPasswordResetEmail` methods from the interface and the `FirebaseService` implementation.

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/api.ts` | Add new method signatures to `PublicAPI`. |
| `packages/shared/src/shared-types.ts` | Add `LoginRequest`, `LoginResponse`, `PasswordResetRequest` types. |
| `packages/shared/src/schemas/apiRequests.ts` | Add Zod schemas for new request types. |
| `packages/shared/src/schemas/apiSchemas.ts` | Add response schema for LoginResponse. |
| `packages/shared/src/constants.ts` | Add `SEND_OOB_CODE_ENDPOINT` constant. |
| `firebase/functions/src/services/auth/IAuthService.ts` | Add `sendPasswordResetEmail` method. |
| `firebase/functions/src/services/auth/FirebaseAuthService.ts` | Implement `sendPasswordResetEmail`. |
| `firebase/functions/src/auth/handlers.ts` | **NEW** - Implement backend logic for login and password reset. |
| `firebase/functions/src/auth/validation.ts` | Add validators for login and password reset. |
| `firebase/functions/src/routes/route-config.ts` | Register new API routes. |
| `firebase/functions/src/ApplicationFactory.ts` | Wire up new handlers. |
| `webapp-v2/src/app/apiClient.ts` | Implement the new client methods, including the custom token sign-in logic. |
| `webapp-v2/src/app/stores/auth-store.ts` | Update `login` and `resetPassword` actions to use `apiClient`. |
| `webapp-v2/src/app/gateways/auth-gateway.ts` | Remove unused methods. |
| `webapp-v2/src/app/firebase.ts` | Remove unused methods from `FirebaseService`. |
| `packages/test-support/src/ApiDriver.ts` | Add login and sendPasswordResetEmail methods. |
| `firebase/functions/src/__tests__/unit/AppDriver.ts` | Add login and sendPasswordResetEmail methods. |

---

## Testing Plan

### Backend Unit Tests (`firebase/functions/src/__tests__/unit/api/`)
- Test `/login` with valid credentials → returns custom token, HTTP 200
- Test `/login` with invalid password → returns 401 `INVALID_CREDENTIALS` (generic)
- Test `/login` with non-existent email → returns 401 `INVALID_CREDENTIALS` (same error, no enumeration)
- Test `/login` rate limiting from Firebase → returns 429
- Test `/login` with malformed email → returns 400 validation error
- Test `/password-reset` with valid email → returns 204 No Content
- Test `/password-reset` with non-existent email → returns 204 (no enumeration)
- Test `/password-reset` with malformed email → returns 400 validation error

### Frontend Playwright Tests (`webapp-v2/src/__tests__/integration/`)
- Full login flow → user redirected to dashboard, auth state updated
- Login with invalid credentials → shows generic error message
- Password reset request → shows success message (even for unknown emails)
- Login persists across page refresh (remember me behavior)

---

## Implementation Order

1. Shared types and schemas (`packages/shared/`)
2. IAuthService interface extension
3. FirebaseAuthService implementation (`sendPasswordResetEmail`)
4. Backend handlers and validation
5. Route registration
6. Frontend apiClient implementation
7. Auth store updates
8. Gateway/FirebaseService cleanup
9. Update test drivers (ApiDriver, AppDriver)
10. Unit and integration tests

---

## Future Work: Custom Email Service

After the initial implementation using Firebase's `sendOobCode` REST API, the password reset email sending can be upgraded to use a custom email service for:
- Custom branding per tenant
- Localized email content
- Analytics and tracking
- Custom email templates

**Upgrade Path:**
1. Add `generatePasswordResetLink(email: Email): Promise<string>` to IAuthService
2. Implement using Firebase Admin SDK `auth().generatePasswordResetLink(email)`
3. Create email service abstraction (`IEmailService`)
4. Integrate with email provider (SendGrid, SES, etc.)
5. Update `sendPasswordResetEmail()` to use custom email service
6. Add tenant-specific email templates
