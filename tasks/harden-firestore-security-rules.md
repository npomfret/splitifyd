# Task: Harden Production Firestore Security Rules

## 1. Overview

A review of the Firebase configuration found that the current Firestore security rules (`firestore.rules`) are intentionally permissive to simplify local development with the emulator. This creates a significant security risk for the production environment, as it removes the database's own layer of security.

## 2. The Problem: Lack of Defense-in-Depth

The current security model has two main issues:

- **Overly Permissive Rules:** For many collections (e.g., `groups`, `expenses`), the rules are simply `allow read, write: if request.auth != null;`. This means any authenticated user can technically read or write any data in those collections, bypassing ownership or group membership checks at the database level.
- **Total Reliance on Backend Logic:** All security enforcement is currently handled by the business logic within the Cloud Functions. While the backend code appears to correctly check permissions, this architecture lacks "defense-in-depth." A single bug in a backend handler could potentially expose or corrupt user data, as there is no second layer of security at the database to stop an invalid request.

The comments within `firestore.rules` confirm this is a deliberate choice for the emulator, but it is not a safe configuration for production.

## 3. The Solution: Environment-Specific Rules

To address this, we must create and enforce a separate, stricter set of rules for the production environment.

### Action Items

1.  **Create Production Rules File:**
    -   Create a new file named `firestore.prod.rules`.
    -   This file should contain strict security rules that mirror the authorization logic currently implemented in the backend handlers. For example:
        -   Access to a group document should be restricted to its members.
        -   The ability to edit an expense should be limited based on the group's security settings (e.g., only the creator or an admin can edit).
        -   Writes to read-only collections (like `group-changes`) should be explicitly denied.

2.  **Update Deployment Workflow:**
    -   The CI/CD pipeline for production deployments (e.g., in `.github/workflows/`) must be modified.
    -   The `firebase deploy` command within the workflow should be updated to specifically target the new rules file:
        ```bash
        firebase deploy --only firestore:rules:prod
        ```

3.  **Update `firebase.json` for Production Deployment:**
    -   To make the deployment explicit, add a dedicated target to the `firestore` configuration in `firebase.json`:
        ```json
        "firestore": {
          "rules": "firestore.rules", // For emulator
          "indexes": "firestore.indexes.json",
          "targets": {
            "prod": {
              "rules": "firestore.prod.rules"
            }
          }
        }
        ```

### Benefits of This Approach

-   **Defense-in-Depth:** Restores the database as a critical security layer.
-   **Reduced Risk:** A potential bug in the backend logic is less likely to result in a data breach.
-   **Clarity:** It makes the security model for production explicit and auditable.
-   **No Impact on Local Development:** Developers can continue to benefit from the simpler emulator-first rules in `firestore.rules`.
