# Signup Legal Improvements

## Objective
Improve the user registration flow to ensure robust legal compliance and granular consent for email communications.

## Requirements

1.  **Policy Content Visibility**: Users must be able to read the actual content of the policies (Terms, Privacy, Cookies) they are accepting.
    *   Use existing API endpoints to fetch markdown content.
    *   Display content to the user (e.g., in a modal) without requiring navigation away from the registration page.
2.  **Mandatory "Account Admin" Emails**:
    *   A mandatory checkbox acknowledging receipt of essential account notifications (e.g., password resets, billing, security alerts).
    *   User cannot register without accepting this.
3.  **Optional "Marketing" Emails**:
    *   An optional checkbox for marketing/promotional emails.
    *   **Default state**: Unchecked (Opt-out/Explicit Opt-in).
4.  **Terms Update**:
    *   Update the Terms of Service to include language regarding marketing email consent.

## Proposed Implementation Plan

### Phase 1: Shared Types & Backend Schema

1.  **Update Shared Types (`@billsplit-wl/shared`)**:
    *   Update `UserRegistration` interface to include:
        *   `marketingEmailsAccepted: boolean`
    *   Update `ClientUser` and `UserProfile` interfaces to reflect this preference.

2.  **Update Firestore Schema (`firebase/functions/src/schemas/user.ts`)**:
    *   Add `marketingEmailsAccepted` to `UserDocumentSchema`.
    *   (Optional) Add `adminEmailsAccepted` (boolean) for audit purposes, even though it's mandatory.

3.  **Update Registration Logic (`UserService2.ts`)**:
    *   Update `registerUser` and `createUserDirect` to accept and store the `marketingEmailsAccepted` flag in the user document.

### Phase 2: Frontend Implementation (`webapp-v2`)

1.  **Update `RegisterPage.tsx`**:
    *   **Policy Links**:
        *   Replace direct anchor tags (`<a href='/terms'>`) with buttons/links that open a modal.
        *   Implement a mechanism (e.g., `usePolicyContent`) to fetch policy text using `ApiClient.getCurrentPolicy(policyId)`.
        *   Use `PolicyRenderer` inside a generic `Modal` to display the content.
    *   **New Checkboxes**:
        *   Add "Account Notifications" checkbox (Required).
        *   Add "Marketing Emails" checkbox (Optional, default unchecked).
    *   **Form Submission**:
        *   Pass `marketingEmailsAccepted` state to `authStore.register`.

2.  **Update `AuthStore`**:
    *   Update `register` action signature to accept the new boolean flag.

### Phase 3: Content Updates

1.  **Update Policy Documents**:
    *   Modify `firebase/docs/policies/terms-and-conditions.md` to include a section on marketing communications and the optional nature of that consent.

## Technical Considerations

*   **API Usage**: Reuse existing endpoints:
    *   `GET /policies/:policyId/current` (Public) - For fetching latest policy text.
*   **Existing Components**:
    *   Reuse `PolicyRenderer` for markdown rendering.
    *   Reuse `Checkbox` and `Modal` UI components.

## Testing Strategy

*   **Unit Tests**:
    *   Verify `UserService` correctly stores the new email preference flags.
    *   Verify registration fails if mandatory fields are missing (though mostly handled by type safety/validation).
*   **E2E/Integration**:
    *   Verify clicking policy links opens the modal with correct content.
    *   Verify registration succeeds with marketing unchecked.
    *   Verify registration succeeds with marketing checked.
    *   Verify registration fails if "Account Notifications" is unchecked.
