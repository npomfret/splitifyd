# Email Verification Restriction

## Objective

Implement a security and onboarding flow where new users are placed in a "read-only" mode until they have successfully verified their email address. This enhances security by ensuring the user's email is valid and provides a clear call-to-action, improving user activation.

---

## User Experience

- **Read-Only Mode:** An unverified user can browse the application (e.g., view groups they are invited to) but cannot perform write actions (create/edit/delete expenses, create groups, record settlements, invite members, etc.).
- **Exception:** Profile updates are allowed (language preference, display name) so users can configure their account.
- **UI Prompts:**
    - A persistent, non-dismissible banner will be displayed at the top of every page, informing the user that their account is restricted and they need to verify their email.
    - The banner will contain a "Resend verification email" button.
    - All UI elements corresponding to write actions (e.g., "Add Expense", "Save", "Create Group" buttons) will be disabled. Tooltips on these disabled elements should explain that email verification is required.
- **API Enforcement:** Any direct API call for a write action from an unverified user will be rejected with a clear error (`EMAIL_NOT_VERIFIED`).

---

## Key Discovery: Existing Infrastructure

The codebase already has:
- `POST /email-verification` endpoint working (sends verification email via `FirebaseAuthService.sendEmailVerification()`)
- `emailVerified: boolean` in `ClientUser` and `UserProfile` types
- `authStore.user?.emailVerified` available client-side
- `apiClient.sendEmailVerification()` method implemented
- Test builders support `emailVerified`
- Email templates for verification already exist

**What's missing:** Enforcement layer (blocking writes in middleware) and UI feedback (banner + disabled buttons via permissions).

---

## Implementation Plan

### Phase 1: Backend Enforcement (Authoritative)

**1. Add `emailVerified` to AuthenticatedUser:**
- **File:** `packages/shared/src/shared-types.ts` (line ~635)
- **Action:** Extend `AuthenticatedUser` interface to include `emailVerified: boolean`.

**2. Populate in Auth Middleware:**
- **File:** `firebase/functions/src/auth/middleware.ts`
- **Action:** In `authenticate()` middleware (around line 84), add `emailVerified: userRecord.emailVerified` to the `req.user` object. Firebase already provides this via `userRecord.emailVerified`.

**3. Add Error Detail Code:**
- **File:** `firebase/functions/src/errors/ErrorCode.ts` (line ~47-128)
- **Action:** Add `EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED'` to `ErrorDetail` object.

**4. Create Write-Guard in Middleware:**
- **File:** `firebase/functions/src/auth/middleware.ts`
- **Action:** After authentication succeeds, check if the request is a write operation (POST/PUT/DELETE/PATCH) and if `!req.user.emailVerified`. If so, throw `Errors.forbidden(ErrorDetail.EMAIL_NOT_VERIFIED)`.
- **Approach:** Centralized check in middleware avoids modifying route-config.ts.

**5. Allowlist Endpoints:**
These endpoints must NOT require verified email:
- `POST /email-verification` (resend verification)
- `POST /auth/login`, `POST /auth/register`, `POST /auth/password-reset` (auth flows)
- All GET endpoints (read-only)
- `PUT /user/profile`, `PATCH /user/profile` (allow updating own profile)
- User preference endpoints

**Decision:** No Firestore security rules changes - enforcement via middleware only.

### Phase 2: Frontend Implementation (UI/UX)

**1. Create Email Verification Banner Component:**
- **File:** `webapp-v2/src/components/ui/EmailVerificationBanner.tsx`
- **Logic:** Read `authStore.user?.emailVerified`. Return `null` if verified or not logged in.
- **Content:** Warning banner with message explaining restriction + "Resend verification email" button.
- **Action:** Call existing `apiClient.sendEmailVerification()` on button click. Show success/error toast.

**2. Add Banner to App.tsx:**
- **File:** `webapp-v2/src/App.tsx` (after line ~152, near WarningBanner)
- **Action:** Add `<EmailVerificationBanner />` component.

**3. Update Permission Store:**
- **File:** `webapp-v2/src/stores/permissions-store.ts`
- **Action:** In `ClientPermissionEngine.checkPermission()`, add early return `false` for write actions when `emailVerified === false`.
- **Pattern:** Follow existing pattern used for `group.locked` handling.

**4. Add Translations:**
- **File:** `webapp-v2/src/locales/en/translation.json`
- **Action:** Add keys under new section:

```json
{
  "emailVerification": {
    "banner": {
      "title": "Email not verified",
      "message": "Please verify your email address to unlock all features.",
      "resendButton": "Resend verification email",
      "resendSuccess": "Verification email sent! Check your inbox.",
      "resendError": "Failed to send verification email. Please try again."
    },
    "tooltip": {
      "disabled": "Verify your email to enable this action"
    }
  }
}
```

---

## Files to Modify

| Layer | File | Purpose |
|---|---|---|
| **Shared Types** | `packages/shared/src/shared-types.ts` | Add `emailVerified` to `AuthenticatedUser` |
| **API Logic** | `firebase/functions/src/auth/middleware.ts` | Populate `emailVerified`, add write-guard |
| **Error Codes** | `firebase/functions/src/errors/ErrorCode.ts` | Add `EMAIL_NOT_VERIFIED` detail |
| **UI Component** | `webapp-v2/src/components/ui/EmailVerificationBanner.tsx` | New banner component |
| **UI Layout** | `webapp-v2/src/App.tsx` | Add banner to app |
| **UI Logic** | `webapp-v2/src/stores/permissions-store.ts` | Disable UI controls based on verification status |
| **Translations** | `webapp-v2/src/locales/en/translation.json` | Add banner/tooltip text |

**Not modifying:**
- `firebase/firestore.rules` - enforcement via middleware only
- `firebase/functions/src/auth/handlers.ts` - resend endpoint already exists
- `webapp-v2/src/app/apiClient.ts` - `sendEmailVerification()` already exists

---

## Testing

### Backend (Critical Path)

**API Unit Tests** (`firebase/functions/src/__tests__/unit/api/`):
- Test that write endpoints reject unverified users with `EMAIL_NOT_VERIFIED` error
- Test that read endpoints allow unverified users
- Test that allowlisted endpoints (register, login, profile update, resend-verification) work for unverified users
- Test that verified users can perform all actions normally

### Frontend

**Playwright Integration Tests** (`webapp-v2/src/__tests__/integration/playwright/`):
- Test that the verification banner appears for unverified users
- Test that write action buttons are disabled with appropriate tooltips
- Test the "Resend verification email" button flow
- Test that verified users do not see the banner

---

## Complexity Assessment

| Task | Effort |
|------|--------|
| Backend type + middleware changes | Low |
| Error code addition | Low |
| Banner component | Medium |
| Permission store integration | Low |
| Backend tests | Medium |
| Frontend tests | Medium |

**Total:** Medium complexity - infrastructure exists, adding enforcement layer.

---

## Implementation Order

1. Backend first (authoritative enforcement must come first)
   - Add `emailVerified` to `AuthenticatedUser` type
   - Add `EMAIL_NOT_VERIFIED` error detail
   - Update auth middleware to populate and enforce
2. Test backend enforcement manually
3. Frontend banner component
4. Update permission store
5. Add translations
6. Write automated tests
7. Manual E2E validation
