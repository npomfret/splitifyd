# Feature: Group Locking (Read-Only Mode)

**Complexity:** Medium

**Goal:** Introduce a feature that allows a group administrator to "lock" a group. A locked group becomes read-only for all members, preventing any new expenses, settlements, member changes, or settings modifications. The only permitted action on a locked group is for a group admin to unlock it.

---

## Research Findings

### Permission System Architecture

The permission system is well-architected with clear separation:

**Backend (`PermissionEngineAsync`)** - `firebase/functions/src/permissions/permission-engine-async.ts`
- Static, synchronous `checkPermission()` method
- Checks: member existence → member status (ACTIVE required) → viewer blocking → permission level evaluation
- Actions checked: `expenseEditing`, `expenseDeletion`, `memberInvitation`, `settingsManagement`, `viewGroup`
- **Key insight**: Add locked check early (after member validation, before action-specific logic)

**Frontend (`ClientPermissionEngine`)** - `webapp-v2/src/app/stores/permissions-store.ts`
- Mirrors backend logic exactly for immediate UI feedback
- Uses `PermissionsStore` with reference counting for component lifecycle
- Returns computed permissions: `canEditAnyExpense`, `canDeleteAnyExpense`, `canInviteMembers`, `canManageSettings`

### Group Types & Update Flow

**Group Interface** - `packages/shared/src/shared-types.ts` (lines 819-851)
```typescript
interface Group {
    name: GroupName;
    description?: string;
    permissions: GroupPermissions;
    permissionHistory?: PermissionChangeLog[];
    inviteLinks?: Record<string, InviteLink>;
    currencySettings?: GroupCurrencySettings;
    recentlyUsedLabels?: Record<ExpenseLabel, ISOString>;
    // Need to add: locked?: boolean;
}
```

**UpdateGroupRequest** - Same file (lines 861-865)
```typescript
export interface UpdateGroupRequest {
    name?: GroupName;
    description?: Description;
    currencySettings?: GroupCurrencySettings | null;
    // Need to add: locked?: boolean;
}
```

**GroupService.updateGroup()** - `firebase/functions/src/services/GroupService.ts`
- Uses `GroupTransactionManager` with optimistic locking (`updatedAt` comparison)
- Access control via `fetchGroupWithAccess()` + `ensureActiveGroupAdmin()`
- Activity feed events generated after transaction commits

### Existing Locked Item Patterns

The codebase already has `isLocked` patterns for expenses and settlements:
- `ExpenseDTO.isLocked` - True if any participant has left the group
- `SettlementDTO.isLocked` - True if payer or payee has left
- UI shows disabled edit buttons with tooltips when locked

### Frontend UI Patterns

**GroupDetailPage** uses computed signals for permissions:
```typescript
const canManageSettings = useComputed(() => Boolean(userPermissions.value.canManageSettings));
```

**GroupActions** conditionally renders buttons based on prop availability (undefined = hidden).

**Locked items** use disabled buttons with aria-describedby for tooltips.

### Decision: Activity Feed Events

**Chosen approach**: New dedicated event types (`group-locked`, `group-unlocked`) rather than reusing `group-updated`. This provides clearer activity history and better filtering options.

---

## Implementation Plan

### 1. Backend Implementation

-   [ ] **Update Shared Types:**
    -   In `packages/shared/src/shared-types.ts`:
        -   Add `locked?: boolean` to the `Group` interface (line ~823)
        -   Add `locked?: boolean` to `UpdateGroupRequest` interface (line ~865)
        -   Add `'group-locked'` and `'group-unlocked'` to `ActivityFeedEventTypes`
    -   In `packages/shared/src/schemas/apiRequests.ts`:
        -   Add `locked: z.boolean().optional()` to `UpdateGroupRequestSchema`

-   [ ] **Update Firestore Documents & Schemas:**
    -   In `firebase/functions/src/schemas/groups.ts`, add `locked: z.boolean().optional()` to the `GroupDocumentSchema`.

-   [ ] **Update API Endpoint (`updateGroup`):**
    -   Modify the `updateGroup` handler (likely within `firebase/functions/src/groups/handlers.ts` or a service it calls).
    -   The logic should allow an update to the `locked` status.
    -   If a group is already locked (`group.locked === true`), the handler must reject any incoming `UpdateGroupRequest` unless the request comes from a group admin **and** the only field being changed is `locked`.
    -   This logic should live in `firebase/functions/src/services/GroupService.ts`.

-   [ ] **Enforce Read-Only State via Permissions:**
    -   Modify `PermissionEngineAsync` in `firebase/functions/src/permissions/permission-engine-async.ts`
    -   Add check after member validation (around line 26), before viewer blocking:
    ```typescript
    // Block all write actions if group is locked
    if (group.locked === true && action !== 'viewGroup') {
        return false;
    }
    ```
    -   This blocks: `expenseEditing`, `expenseDeletion`, `memberInvitation`, `settingsManagement`
    -   Settlement creation uses `expenseEditing` permission, so it will also be blocked

-   [ ] **Add Activity Feed Events:**
    -   In `GroupService.updateGroup()`, after successful lock/unlock:
    ```typescript
    if (updates.locked !== undefined && updates.locked !== group.locked) {
        const eventType = updates.locked ? 'group-locked' : 'group-unlocked';
        await this.activityFeedService.recordEvent({
            type: eventType,
            groupId,
            actorUserId: userId,
            timestamp: now,
        });
    }
    ```

-   [ ] **Add Error Code:**
    -   Add `GROUP_LOCKED` to `firebase/functions/src/errors/error-codes.ts` for clear error messages

### 2. Frontend Implementation

-   [ ] **Add UI Control for Locking:**
    -   In the group settings page, likely `webapp-v2/src/pages/group/settings/GroupSettingsGeneralPage.tsx`, add a new section for "Group Locking".
    -   This section should contain a toggle switch or a button labeled "Lock Group".
    -   This UI control should only be visible and enabled for users who are `admin`s of the group.

-   [ ] **Update API Client Call:**
    -   The event handler for the new lock toggle will call `apiClient.updateGroup`, passing the new `locked` status in the request body.

-   [ ] **Update Client-Side Permission Engine:**
    -   Modify `ClientPermissionEngine.checkPermission()` in `webapp-v2/src/app/stores/permissions-store.ts`
    -   Add the same locked check as backend (mirrors logic exactly):
    ```typescript
    // Block write actions if group is locked
    if (group.locked === true && action !== 'viewGroup') {
        return false;
    }
    ```
    -   This ensures `canEditAnyExpense`, `canDeleteAnyExpense`, `canInviteMembers`, `canManageSettings` all return `false` when locked

-   [ ] **Handle Activity Feed Events:**
    -   In `webapp-v2/src/app/stores/helpers/group-detail-realtime-coordinator.ts`
    -   Add `'group-locked'` and `'group-unlocked'` to events that trigger `refreshAll()`

-   [ ] **Add Translations:**
    -   In `webapp-v2/public/locales/en/translation.json`:
    ```json
    "group": {
      "locked": {
        "banner": "This group is locked. No changes can be made until an admin unlocks it.",
        "toggle": "Lock Group",
        "toggleDescription": "Prevent all members from making changes to this group.",
        "warning": "Locking this group will prevent anyone from adding expenses, settling up, or changing settings."
      }
    }
    ```

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
    -   Create a new test file: `e2e-tests/src/__tests__/integration/group-locking.test.ts`
    -   **Admin flow:**
        -   As a group admin, navigate to settings, lock the group.
        -   Verify a "Group is locked" indicator appears.
        -   Verify all action buttons ("Add Expense", "Settle Up", etc.) are disabled.
        -   Navigate back to settings and unlock the group.
        -   Verify the indicator disappears and UI controls are re-enabled.
    -   **Member flow:**
        -   As a regular member in a locked group, verify all action buttons are disabled.
        -   Verify the lock/unlock control in settings is not visible or is disabled.

---

## Critical Files Summary

| Area | File | Change |
|------|------|--------|
| Shared Types | `packages/shared/src/shared-types.ts` | Add `locked` to Group, UpdateGroupRequest, ActivityFeedEventTypes |
| Shared Schemas | `packages/shared/src/schemas/apiRequests.ts` | Add `locked` to UpdateGroupRequestSchema |
| Firestore Schema | `firebase/functions/src/schemas/group.ts` | Add `locked` to GroupDocumentSchema |
| Backend Permissions | `firebase/functions/src/permissions/permission-engine-async.ts` | Add locked check |
| Backend Service | `firebase/functions/src/services/GroupService.ts` | Handle locked logic + activity events |
| Error Codes | `firebase/functions/src/errors/error-codes.ts` | Add GROUP_LOCKED |
| Frontend Permissions | `webapp-v2/src/app/stores/permissions-store.ts` | Add locked check |
| Frontend Realtime | `webapp-v2/src/app/stores/helpers/group-detail-realtime-coordinator.ts` | Handle new events |
| Settings UI | `webapp-v2/src/pages/group/settings/GroupSettingsGeneralPage.tsx` | Add lock toggle |
| Group Detail | `webapp-v2/src/pages/GroupDetailPage.tsx` | Add locked banner |
| Translations | `webapp-v2/public/locales/en/translation.json` | Add lock-related strings |

## Implementation Order

1. **Shared Types & Schemas** - Foundation for all other changes
2. **Backend Permission Engine** - Core enforcement mechanism
3. **Backend GroupService** - Handle lock/unlock requests + activity events
4. **Frontend Permission Engine** - Mirror backend for UI
5. **Frontend Realtime Coordinator** - Handle new activity events
6. **Frontend Settings UI** - Admin lock toggle
7. **Frontend Group Detail** - Banner + disabled actions
8. **Backend Unit Tests** - Permission engine tests
9. **Backend API Tests** - Integration tests for updateGroup
10. **E2E Tests** - Full user flow validation
