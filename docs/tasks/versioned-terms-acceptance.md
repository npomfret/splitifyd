## Task: Implement Versioned Terms and Cookie Policy Acceptance

**Goal:**
Create a system that tracks which version of the Terms of Service and Cookie Policy a user has accepted. If a policy is updated, the system must prompt the user to accept the new version before they can continue using the app.

**Justification:**
This ensures that we have a clear and auditable record of user consent for specific versions of our legal policies, which is critical for compliance and legal protection.

---

### Proposed Solution Design

#### 1. Firestore Data Model

We will use Firestore to store the policies and the user's acceptance records.

**A. Policies Collection**

A new collection named `policies` will store the content and versioning information for each legal document.

- **Collection:** `policies`
- **Document IDs:** `termsOfService`, `cookiePolicy`

**Document Structure (`/policies/termsOfService`):**
```json
{
  "policyName": "Terms of Service",
  "currentVersionHash": "sha256-abc123def456...",
  "versions": {
    "sha256-abc123def456...": {
      "text": "The full text of the new terms...",
      "createdAt": "2025-09-15T10:00:00Z"
    },
    "sha256-xyz789uvw123...": {
      "text": "The full text of the old terms...",
      "createdAt": "2025-01-20T14:30:00Z"
    }
  }
}
```
- `currentVersionHash`: The hash of the currently active policy version.
- `versions`: A map where each key is the SHA-256 hash of the policy text, and the value is an object containing the text and a timestamp.

**B. User Document Enhancement**

The user's document in the `users` collection will be updated to store the hash of the policy version they accepted.

- **Collection:** `users`
- **Document ID:** `[userId]`

**Document Structure (`/users/{userId}`):**
```json
{
  "email": "user@example.com",
  // ... other user fields
  "acceptedPolicies": {
    "termsOfService": "sha256-xyz789uvw123...",
    "cookiePolicy": "sha256-jkl456mno789..."
  }
}
```
- `acceptedPolicies`: A map where each key is the policy ID and the value is the hash of the version the user last accepted.

---

#### 2. System Logic

**A. Updating a Policy**

1.  An admin updates the policy text.
2.  A script or Cloud Function calculates the SHA-256 hash of the new text.
3.  This script updates the relevant document in the `policies` collection by:
    - Adding a new entry to the `versions` map with the new hash and text.
    - Updating the `currentVersionHash` field to the new hash.

**B. Checking for Acceptance (App Load/Login)**

1.  When a user logs in or opens the app, the client fetches the `currentVersionHash` for all policies from the `/policies` collection.
2.  The client also fetches the user's `acceptedPolicies` map from their user document.
3.  For each policy, the client compares the `currentVersionHash` with the hash stored in the user's `acceptedPolicies`.
4.  **If the hashes do not match** for any policy, the user has not accepted the latest version.

**C. Prompting for Re-acceptance**

1.  If a mismatch is detected, the application should immediately block access to its main features.
2.  A modal or a dedicated, full-screen page must be displayed.
3.  This screen will show the new policy text (fetched from `policies/{policyId}/versions/{currentVersionHash}`).
4.  The user must check a box and click an "I Accept" button.
5.  Upon acceptance, the client updates the user's document in Firestore, setting the appropriate field in `acceptedPolicies` to the `currentVersionHash`.
6.  Once all required policies are accepted, the block is removed, and the user can access the app normally.

---

#### 3. Admin Interface for Policy Management

To manage these policies, a secure admin interface is required.

**A. Access Control**
- Only users with an `admin` role should be able to access this interface.
- Access should be controlled via Firestore Security Rules and checked on the client and in any backend functions.

**B. UI Components**

1.  **Policy List View:**
    - A dashboard page that lists all the documents in the `policies` collection (e.g., "Terms of Service", "Cookie Policy").
    - Each item should show the `policyName` and the `currentVersionHash`.

2.  **Policy Detail/Editor View:**
    - Clicking a policy opens an editor page.
    - The page should have a large text area (supporting Markdown or rich text) to edit the policy content.
    - It should display a list or dropdown of all historical versions of the policy, allowing an admin to view the text of any previous version.

3.  **Publishing Workflow:**
    - After editing the text, the admin can save the changes.
    - Saving a change should NOT automatically make it the live version. It should be saved as a new, inactive version.
    - A separate, explicit "Set as Current Version" or "Publish" button is required.
    - Clicking this button will:
        a. Calculate the SHA-256 hash of the new text.
        b. Add the new version to the `versions` map in the policy document.
        c. Update the `currentVersionHash` field to the new hash.
        d. This action should have a confirmation dialog (e.g., "Are you sure you want to publish this version? All users will be required to re-accept.") to prevent accidental updates.
