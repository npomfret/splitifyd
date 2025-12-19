# Signup Legal Improvements

## Objective
Improve the user registration flow to ensure robust legal compliance and granular consent for email communications.

## Requirements (unchanged)

1.  **Policy Content Visibility**: Users must be able to read the actual content of the policies (Terms, Privacy, Cookies) they are accepting.
    *   Use existing API endpoints to fetch markdown content.
    *   Display content to the user (e.g., in a modal) without requiring navigation away from the registration page.
2.  **Mandatory "Account Admin" Emails**:
    *   A mandatory checkbox acknowledging receipt of essential account notifications (e.g., password resets, billing, security alerts).
    *   User cannot register without accepting this.
    *   Store acceptance as a timestamp (ISO string) in the user document.
    *   Display-only in Settings (user cannot toggle after signup).
3.  **Optional "Marketing" Emails**:
    *   An optional checkbox for marketing/promotional emails.
    *   **Default state**: Unchecked (Opt-out/Explicit Opt-in).
4.  **Terms Update**:
    *   Update the Terms of Service to include language regarding marketing email consent.
5.  **Settings Management**:
    *   Users must be able to update email preference flags from Settings after signup.

## Review / Verification (repo facts)

- Registration UI lives at `webapp-v2/src/pages/RegisterPage.tsx` and uses three required checkboxes for terms/cookies/privacy with links to `/terms`, `/cookies`, `/privacy-policy` (no routes exist in `webapp-v2/src/App.tsx`, so these links likely 404 today).
- Policy content endpoints already exist and are public:
  - `GET /policies/:policyId/current` (returns `CurrentPolicyResponse.text`)
  - `GET /policies/terms-of-service/text`, `/policies/privacy-policy/text`, `/policies/cookie-policy/text`
- There is an existing `PolicyAcceptanceModal` + `PolicyRenderer` that already fetches `getCurrentPolicy()` and renders markdown: `webapp-v2/src/components/policy/PolicyAcceptanceModal.tsx`.
- Registration validation is enforced by `RegisterRequestSchema` (`packages/shared/src/schemas/apiRequests.ts`) and used by both the client and server (`firebase/functions/src/auth/validation.ts`).
- On the backend, `UserService2.createUserDirect` currently auto-populates `acceptedPolicies` with the current policy versions regardless of the UI checkboxes; it does **not** store any email preference fields in the user document (`firebase/functions/src/services/UserService2.ts`).
- User documents currently only support `acceptedPolicies`, `role`, `preferredLanguage`, and audit fields in `firebase/functions/src/schemas/user.ts` and `firebase/functions/src/services/firestore/IFirestoreWriter.ts`.
- Policy source files are in `firebase/docs/policies/*.md`, including `terms-and-conditions.md`.

## Gaps / Risks

- The registration page links to policy routes that are not in the SPA router; users can’t reliably read policy content during signup.
- Email preference fields do not exist in shared types, request validation, Firestore schema, or profile responses.
- Registration always writes `acceptedPolicies` for the current versions, which is fine for required policies but should remain explicit in the plan (this behavior is a compliance decision).
- There is no current UI or API for updating email preferences post-signup.

## Proposed Implementation Plan (updated)

### Phase 1: Shared Types & Request Validation

1.  **Shared types + request schemas**
    *   `packages/shared/src/shared-types.ts`
        - Add `marketingEmailsAccepted: boolean` (optional? default false) to `UserRegistration`.
        - Add `adminEmailsAccepted: boolean` (required) to `UserRegistration` for auditability.
        - Add timestamp fields to stored profile types: `adminEmailsAcceptedAt: ISOString` and `marketingEmailsAcceptedAt?: ISOString | null` (or similar) in `UserProfile`, `ClientUser`, and `UserProfileResponse` so Settings can read current values.
    *   `packages/shared/src/schemas/apiRequests.ts`
        - Extend `RegisterRequestSchema` with new acceptance fields:
          - `adminEmailsAccepted`: **required true**
          - `marketingEmailsAccepted`: **boolean**, default false in UI.
    *   `packages/shared/src/schemas/apiSchemas.ts`
        - Extend `UserProfileResponseSchema` for preference fields.
    *   `packages/test-support/src/builders/RegisterRequestBuilder.ts`
        - Add fields + helpers for new booleans.

### Phase 2: Backend Storage & Registration

1.  **Firestore user document schema**
    *   `firebase/functions/src/schemas/user.ts`
        - Add `adminEmailsAcceptedAt` and `marketingEmailsAcceptedAt` (timestamp) fields to `BaseUserSchema`.
    *   `firebase/functions/src/services/firestore/IFirestoreWriter.ts`
        - Add fields to `FirestoreUserDocumentFields`.

2.  **Registration flow**
    *   `firebase/functions/src/auth/validation.ts`
        - Update `validateRegisterRequest` to pass through the new fields (and add mapError handling if needed).
    *   `firebase/functions/src/services/UserService2.ts`
        - Store `adminEmailsAcceptedAt` + `marketingEmailsAcceptedAt` in the user document on registration (timestamped).
        - Keep existing `acceptedPolicies` behavior (required policies -> current versions).

### Phase 3: Frontend Signup UX

1.  **Registration page**
    *   `webapp-v2/src/pages/RegisterPage.tsx`
        - Replace `/terms`, `/cookies`, `/privacy-policy` anchors with buttons that open a modal.
        - Fetch policy content on-demand via `apiClient.getCurrentPolicy(PolicyIds.*)` and render with `PolicyRenderer` in a `Modal`.
        - Add “Account Notifications” (required) and “Marketing Emails” (optional) checkboxes.
        - Pass both values to `authStore.register`.
        - Update validation error mapping to include new required field.
    *   `webapp-v2/src/app/apiClient.ts`
        - Reuse existing `getCurrentPolicy` (already implemented).

2.  **Auth store + translation strings**
    *   `webapp-v2/src/app/stores/auth-store.ts`
        - Extend `register(...)` signature + payload with new fields.
    *   `webapp-v2/src/locales/en/translation.json` (+ other locales as needed)
        - Add copy for the new checkboxes + modal triggers.

### Phase 4: Settings Management (new)

1.  **User profile update API**
    *   `packages/shared/src/shared-types.ts`
        - Add fields to `UpdateUserProfileRequest` for `adminEmailsAccepted`/`marketingEmailsAccepted` (or create a dedicated request type if separation is preferred).
    *   `packages/shared/src/schemas/apiRequests.ts`
        - Extend `UpdateUserProfileRequestSchema` to validate the new fields.
    *   `firebase/functions/src/user/validation.ts`
        - Allow updating the new fields.
    *   `firebase/functions/src/services/UserService2.ts`
        - Persist preference updates to the user document.

2.  **Settings UI**
    *   Identify the settings page section (likely `webapp-v2/src/pages/SettingsPage.tsx` and/or settings components).
    *   Add toggle/checkbox UI for:
        - Account notifications (display-only, required).
        - Marketing emails (optional, user-controlled).
    *   Wire to `apiClient.updateUserProfile` and refresh `authStore` profile state after update.

### Phase 5: Policy Content Update

1.  **Terms of Service**
    *   `firebase/docs/policies/terms-and-conditions.md`
        - Add explicit marketing consent language, clarifying that marketing emails are optional and can be opted in/out.

## Technical Considerations

*   **API Usage**: Reuse existing endpoints:
    *   `GET /policies/:policyId/current` (Public) - For fetching latest policy text.
*   **Existing Components**:
    *   Reuse `PolicyRenderer` for markdown rendering.
    *   Reuse `Checkbox` and `Modal` UI components.
*   **Policy IDs**:
    *   Prefer `PolicyIds.TERMS_OF_SERVICE`, `PolicyIds.PRIVACY_POLICY`, `PolicyIds.COOKIE_POLICY` from shared types.

## Testing Strategy

*   **Unit Tests**:
    *   Verify `UserService` correctly stores the new email preference flags.
    *   Verify update profile allows preference changes and persists them.
    *   Verify registration fails if mandatory fields are missing (though mostly handled by type safety/validation).
*   **E2E/Integration**:
    *   Verify clicking policy links opens the modal with correct content.
    *   Verify registration succeeds with marketing unchecked.
    *   Verify registration succeeds with marketing checked.
    *   Verify registration fails if "Account Notifications" is unchecked.
    *   Verify settings page toggles persist preference updates.

## Open Questions / Decisions Needed

- Should `adminEmailsAccepted` be editable after registration? If it is mandatory, do we expose it as read-only (display-only) in settings?
- Should `adminEmailsAccepted` capture a timestamp (for audit) vs just boolean? If yes, we may want `{ acceptedAt: ISOString, accepted: true }` instead of a bare boolean.
