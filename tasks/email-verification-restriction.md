# Email Verification Restriction

## Objective

Implement a security and onboarding flow where new users are placed in a "read-only" mode until they have successfully verified their email address. This enhances security by ensuring the user's email is valid and provides a clear call-to-action, improving user activation.

---

## User Experience

- **Read-Only Mode:** An unverified user can browse the application (e.g., view groups they are invited to) but cannot perform any write actions (create/edit/delete expenses, change settings, invite members, etc.).
- **UI Prompts:**
    - A persistent, non-dismissible banner will be displayed at the top of every page, informing the user that their account is restricted and they need to verify their email.
    - The banner will contain a "Resend verification email" button.
    - All UI elements corresponding to write actions (e.g., "Add Expense", "Save", "Create Group" buttons) will be disabled. Tooltips on these disabled elements should explain that email verification is required.
- **API Enforcement:** Any direct API call for a write action from an unverified user will be rejected with a clear error (`EMAIL_NOT_VERIFIED`).

---

## Proposed Implementation Plan

### Phase 1: Backend Enforcement (Authoritative)

**1. Update Firestore Security Rules:**
- **File:** `firebase/firestore.rules`
- **Action:** Add `&& request.auth.token.email_verified == true` to the `/users` `allow create` and `allow update` rules (the only client-write rules). This provides the foundational, data-layer security without touching server-only collections.

**2. Add an email verification guard at the auth layer:**
- **Files:** `packages/shared/src/shared-types.ts`, `firebase/functions/src/auth/middleware.ts`
- **Action:** Extend `AuthenticatedUser` to include `emailVerified: boolean`, populate it from Firebase Auth `userRecord.emailVerified` during authentication, and add a write-guard middleware (or handler-level guard) that rejects mutating routes when `emailVerified` is `false`.
- **Error Handling:** Add `EMAIL_NOT_VERIFIED` to `firebase/functions/src/errors/ErrorCode.ts` (as an `ErrorDetail`) and return `Errors.forbidden(ErrorDetail.EMAIL_NOT_VERIFIED)`.
- **Allowlist:** Ensure the guard allows `register`, `login`, `password-reset`, and the new resend-verification endpoint, plus read-only routes.

**3. Create Verification Resend Endpoint:**
- **Files:** `firebase/functions/src/auth/handlers.ts`, `firebase/functions/src/routes/route-config.ts`, `packages/shared/src/api.ts`, `packages/shared/src/schemas/apiSchemas.ts`
- **Action:** Create a new authenticated `POST` endpoint, e.g., `/user/resend-verification`, with a 204 response.
- **Logic:** Generate the verification link via the auth service, render with `EmailTemplateService`, and send via `PostmarkEmailService`. Add new email translations in `webapp-v2/src/locales/*/translation.json`.

### Phase 2: Frontend Implementation (UI/UX)

**1. Create Email Verification Banner Component:**
- **File:** `webapp-v2/src/components/layout/EmailVerificationBanner.tsx`
- **Logic:** This component will read the user's verification status from the `authStore`. If `authStore.user?.emailVerified === false`, it will render the banner.
- **Content:** The banner will include the prompt and the "Resend" button, which will call the new API endpoint via the `apiClient`.

**2. Integrate Banner into Layout:**
- **File:** `webapp-v2/src/components/layout/BaseLayout.tsx` (or similar root layout component)
- **Action:** Add the `<EmailVerificationBanner />` so it appears on all authenticated pages.

**3. Update Client-Side Permission Engine:**
- **File:** `webapp-v2/src/stores/permissions-store.ts` (and its `ClientPermissionEngine`)
- **Action:** Modify the permission checks to incorporate `authStore.user?.emailVerified`. If the user is not verified, all write-related permissions should return `false`. This will automatically disable the relevant UI controls across the app.
- **Note:** Ensure non-group write actions (settings, profile updates, invites, comments) are also disabled if they are not driven by `permissionsStore`.

**4. Update API Client:**
- **File:** `webapp-v2/src/app/apiClient.ts`
- **Action:** Add the new `resendVerificationEmail()` method.

---

## Key Files to Modify

| Layer | File | Purpose |
|---|---|---|
| **Data Security** | `firebase/firestore.rules` | Add `email_verified` check to write rules. |
| **API Logic** | `firebase/functions/src/auth/middleware.ts` | Attach `emailVerified` and block writes for unverified users. |
| **API Logic** | `firebase/functions/src/services/email/EmailTemplateService.ts` | Add template for verification email. |
| **API Endpoint** | `firebase/functions/src/auth/handlers.ts` | Create handler to resend verification email. |
| **Shared** | `packages/shared/src/api.ts` | Define the new API endpoint interface. |
| **UI Component** | `webapp-v2/src/components/layout/EmailVerificationBanner.tsx` | New banner component. |
| **UI Layout** | `webapp-v2/src/components/layout/BaseLayout.tsx` | Integrate the banner. |
| **UI Logic** | `webapp-v2/src/stores/permissions-store.ts` | Disable UI controls based on verification status. |
| **UI State** | `webapp-v2/src/app/stores/auth-store.ts` | Ensure `emailVerified` state is correctly managed. |
| **API Client** | `webapp-v2/src/app/apiClient.ts` | Add method to call the new resend endpoint. |
