# Feature: Group Locking (Read-Only Mode)

**Complexity:** Medium

**Goal:** Introduce a feature that allows a group administrator to "lock" a group. A locked group becomes read-only for all members, preventing any new expenses, settlements, member changes, or settings modifications. The only permitted action on a locked group is for a group admin to unlock it.

---

## Implementation Plan

### 1. Backend Implementation

-   [ ] **Update Shared Types:**
    -   In `packages/shared/src/shared-types.ts`, add a new optional boolean property `locked: boolean` to the `GroupDTO` interface.
    -   In the same file, add the `locked?: boolean` property to the `UpdateGroupRequest` interface to allow the client to send lock/unlock requests.

-   [ ] **Update Firestore Documents & Schemas:**
    -   In `firebase/functions/src/schemas/groups.ts`, add `locked: z.boolean().optional()` to the `GroupDocumentSchema`.

-   [ ] **Update API Endpoint (`updateGroup`):**
    -   Modify the `updateGroup` handler (likely within `firebase/functions/src/groups/handlers.ts` or a service it calls).
    -   The logic should allow an update to the `locked` status.
    -   If a group is already locked (`group.locked === true`), the handler must reject any incoming `UpdateGroupRequest` unless the request comes from a group admin **and** the only field being changed is `locked`.
    -   This logic should live in `firebase/functions/src/services/GroupService.ts`.

-   [ ] **Enforce Read-Only State via Permissions:**
    -   Modify the `PermissionEngineAsync` in `firebase/functions/src/permissions/permission-engine-async.ts`.
    -   The `checkPermission` method should be updated to check for `group.locked`.
    -   If `group.locked` is `true`, it must return `false` for permissions related to writing or modifying data, such as:
        -   `expenseEditing`
        -   `expenseDeletion`
        -   `memberInvitation`
        -   `settingsManagement`
        -   `createSettlement` (this might need a new permission level or a direct check).
    -   This will be the primary mechanism for enforcing the read-only state across the application.

### 2. Frontend Implementation

-   [ ] **Add UI Control for Locking:**
    -   In the group settings page, likely `webapp-v2/src/pages/group/settings/GroupSettingsGeneralPage.tsx`, add a new section for "Group Locking".
    -   This section should contain a toggle switch or a button labeled "Lock Group".
    -   This UI control should only be visible and enabled for users who are `admin`s of the group.

-   [ ] **Update API Client Call:**
    -   The event handler for the new lock toggle will call `apiClient.updateGroup`, passing the new `locked` status in the request body.

-   [ ] **Update Client-Side Permission Engine:**
    -   Modify the `ClientPermissionEngine` in `webapp-v2/src/app/stores/permissions-store.ts` to account for the new `group.locked` property.
    -   Computed permissions (e.g., `canEditExpense`, `canInviteMembers`) should all return `false` if `group.locked` is `true`, regardless of the user's role or other settings.

-   [ ] **Comprehensive UI Audit for Read-Only State:**
    -   Systematically go through all components and pages related to a group and ensure they respect the locked state.
    -   Use the updated `permissionsStore` to disable buttons, hide forms, and prevent navigation to editing pages.
    -   Key areas to check:
        -   `GroupDetailPage`: The "Add Expense" button should be disabled.
        -   `ExpenseListItem`: Edit/delete options should be hidden or disabled.
        -   `SettlementContainer`: The "Settle Up" button and form should be disabled.
        -   `GroupMembersPage`: The "Invite Member" button should be disabled.
        -   `GroupSettings` pages: All form fields and save buttons should be disabled (except for the unlock control).
        -   An unobtrusive banner or indicator should be displayed on the group detail page, making it clear that the group is locked.

### 3. Testing

-   [ ] **Backend Unit Tests:**
    -   Add test cases to `permission-engine.test.ts` to verify that all relevant permissions are denied when a group is locked.
    -   Test both `member` and `admin` roles to ensure the lock applies to everyone.

-   [ ] **Backend Integration Tests:**
    -   Add tests for the `updateGroup` API endpoint.
    -   Verify that a non-admin cannot lock or unlock a group.
    -   Verify that an admin *can* lock and unlock a group.
    -   Verify that if a group is locked, any attempt to modify other properties (e.g., `name`, `description`) is rejected with a `403 Forbidden` or `400 Bad Request`.
    -   Verify that attempts to create expenses, settlements, etc., in a locked group are rejected.

-   [ ] **Frontend (Playwright) E2E Tests:**
    -   Create a new test file for the group locking feature.
    -   **Admin flow:**
        -   As a group admin, navigate to settings, lock the group.
        -   Verify a "Group is locked" indicator appears.
        -   Verify all action buttons ("Add Expense", "Settle Up", etc.) are disabled.
        -   Navigate back to settings and unlock the group.
        -   Verify the indicator disappears and UI controls are re-enabled.
    -   **Member flow:**
        -   As a regular member in a locked group, verify all action buttons are disabled.
        -   Verify the lock/unlock control in settings is not visible or is disabled.
