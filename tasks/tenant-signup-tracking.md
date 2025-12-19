# Record Tenant on User Registration

## Objective

Capture and store the tenant (`TenantId`) from which a user originates during the registration process. This is a data-collection task to enable future analytics and tenant-specific user management features. This task does not include building any features that consume this data.

---

## Proposed Implementation Plan

The implementation involves passing the `hostname` from the client during registration and storing it as a `signupTenantId` on the user's document in Firestore.

### Phase 1: Data Model and Type Updates

**1. Update Shared DTOs:**
- **File:** `packages/shared/src/shared-types.ts`
- **Action:**
    - Add `signupHostname?: string` to the `CreateUserRequest` interface.
    - Add `signupTenantId: TenantId` to the `UserProfileDTO` and/or `RegisteredUser` types. This will make the data available to the client and other services.

**2. Update Firestore Schema:**
- **File:** `firebase/functions/src/schemas/user.ts` (or equivalent user schema file)
- **Action:** Add `signupTenantId: TenantIdSchema` to the `UserDocumentSchema` Zod schema. Mark it as optional (`.optional()`) for backward compatibility with existing users, but ensure it is written for all new users.

### Phase 2: Backend - User Creation Logic

**1. Update User Creation Handler:**
- **File:** `firebase/functions/src/auth/AuthHandlers.ts` (or wherever user registration is handled)
- **Action:**
    - Modify the handler to accept the new `signupHostname` field from the request body.
    - Pass this `hostname` to the service responsible for creating the user (e.g., `FirebaseAuthService` or `UserService`).

**2. Update User Creation Service:**
- **File:** `firebase/functions/src/services/FirebaseAuthService.ts` (or equivalent)
- **Action:**
    - The service method (e.g., `createUser`) should now accept the `signupHostname`.
    - Before creating the user document, use the `TenantService` (or equivalent tenant resolution logic) to resolve the `hostname` into a `TenantId`.
    - If resolution fails, a decision is needed: store the raw hostname, store a `null` value, or reject the request. For now, we will assume it resolves successfully.
    - When creating the user document in the `users` collection, include the `signupTenantId` field.

### Phase 3: Frontend - Pass Hostname on Signup

**1. Update Registration Page Logic:**
- **File:** `webapp-v2/src/pages/RegisterPage.tsx` (or the component handling user registration)
- **Action:**
    - In the `handleSubmit` or equivalent function, capture the hostname from the browser: `const signupHostname = window.location.hostname;`.
    - Pass this `signupHostname` in the payload when calling the `apiClient`'s user creation method.

**2. Update API Client:**
- **File:** `webapp-v2/src/app/apiClient.ts`
- **Action:** Modify the `createUser` (or equivalent) method to include the `signupHostname` in the request body, matching the updated `CreateUserRequest` type.

---

## Key Files to Modify

| Layer | File | Purpose |
|---|---|---|
| **Shared Types** | `packages/shared/src/shared-types.ts` | Add `signupHostname` to request and `signupTenantId` to DTOs. |
| **Backend Schema**| `firebase/functions/src/schemas/user.ts` | Update `UserDocumentSchema` with the new field. |
| **Backend Logic** | `firebase/functions/src/auth/AuthHandlers.ts` | Update registration handler to receive the hostname. |
| **Backend Logic** | `firebase/functions/src/services/FirebaseAuthService.ts` | Update user creation service to resolve and store the tenant ID. |
| **Frontend Logic**| `webapp-v2/src/pages/RegisterPage.tsx` | Capture `window.location.hostname` and pass it in the API call. |
| **API Client** | `webapp-v2/src/app/apiClient.ts` | Update the `createUser` method to send the new field. |

## Future Considerations

- **Invite Flow:** How should `signupTenantId` be determined when a user registers via an invite link sent from a different tenant? The tenant context could be derived from the group they are being invited to.
- **Data Backfill:** Decide if a backfill strategy is needed for existing users (e.g., based on their group memberships). This is out of scope for the initial implementation.
