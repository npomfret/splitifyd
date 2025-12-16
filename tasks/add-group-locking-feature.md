# Feature: Group Locking (Read-Only Mode)

**Complexity:** Medium
**Status:** COMPLETED

**Goal:** Introduce a feature that allows a group administrator to "lock" a group. A locked group becomes read-only for all members, preventing any new expenses, settlements, member changes, or settings modifications. The only permitted action on a locked group is for a group admin to unlock it.

---

## Implementation Progress

### Backend - COMPLETED

- [x] **Shared Types & Schemas:**
  - Added `locked: boolean` to `Group` interface in `packages/shared/src/shared-types.ts` (required field, defaults to false)
  - Added `locked?: boolean` to `UpdateGroupRequest` interface
  - Added `'group-locked'` and `'group-unlocked'` to `ActivityFeedEventTypes`
  - Added `locked: z.boolean().optional()` to `UpdateGroupRequestSchema` in `packages/shared/src/schemas/apiRequests.ts`
  - Added `locked: z.boolean().default(false)` to `GroupDocumentSchema` in `firebase/functions/src/schemas/group.ts`

- [x] **Permission Enforcement:**
  - Updated `PermissionEngineAsync` to block all write actions on locked groups (except unlocking)
  - Added `GROUP_LOCKED` error code to `firebase/functions/src/errors/error-codes.ts`

- [x] **Group Service:**
  - Updated `GroupService.updateGroup()` to:
    - Check if group is locked and reject non-unlock updates
    - Generate `group-locked` / `group-unlocked` activity feed events

- [x] **Validation Fix:**
  - Fixed `validateUpdateGroup` transform function in `firebase/functions/src/groups/validation.ts` to include the `locked` field (this was causing the API tests to fail initially)

### Frontend - COMPLETED

- [x] **Client Permission Engine:**
  - Updated `ClientPermissionEngine` in `webapp-v2/src/app/stores/permissions-store.ts` to mirror backend locked check

- [x] **Realtime Coordinator:**
  - No changes needed - coordinator handles all event types generically via `scheduleRefresh()` for any activity event on the active group

- [x] **Lock Toggle UI:**
  - Created `useGroupLockSettings` hook in `webapp-v2/src/app/hooks/useGroupLockSettings.ts`
  - Added lock toggle section in `GroupGeneralTabContent.tsx` (only visible to admins)
  - Integrated hook in `GroupSettingsModal.tsx`

- [x] **Locked Banner & Disabled Actions:**
  - Added computed signal `isGroupLocked` in `GroupDetailPage.tsx`
  - Added warning banner when group is locked
  - Updated `GroupActions.tsx` to disable Add Expense, Settle Up, and Invite buttons when locked
  - Both desktop sidebar and mobile action bars respect locked state

- [x] **Translations:**
  - Added all translation keys to English (`webapp-v2/src/locales/en/translation.json`)
  - Added placeholder keys to all other languages (AR, DE, ES, IT, JA, KO, LV, NL-BE, NO, PH, SV, UK)

### Testing - COMPLETED

- [x] **Backend Unit Tests:**
  - Added `describe('locked group behavior')` test suite in `permission-engine-async.test.ts`
  - Tests: locked group blocks expenseEditing, expenseDeletion, memberInvitation, settingsManagement for both admin and member
  - Tests: locked group allows viewGroup
  - All 20 tests pass

- [x] **Backend API Tests:**
  - Added `describe('group locking')` test suite in `firebase/functions/src/__tests__/unit/api/groups.test.ts`
  - Tests:
    - Admin can lock/unlock a group
    - Non-admin cannot lock a group
    - Locked group rejects name updates
    - Locked group rejects expense creation
    - Activity events generated for lock/unlock
    - Admin can unlock a locked group (only permitted change)
  - All 8 tests pass

### E2E Tests - COMPLETED

- [x] **E2E Tests:**
  - Created `e2e-tests/src/__tests__/integration/group-locking.e2e.test.ts`
  - Admin flow: lock group, verify banner, verify disabled buttons, unlock
  - Member flow: verify real-time locked state propagation
  - Dashboard activity: verify lock/unlock events in activity feed
  - Page objects updated:
    - `GroupSettingsModalPage`: Added lock toggle methods
    - `GroupDetailPage`: Added locked banner and disabled action button verification

---

## Critical Files Modified

| Area | File | Change |
|------|------|--------|
| Shared Types | `packages/shared/src/shared-types.ts` | Added `locked` to Group, UpdateGroupRequest, ActivityFeedEventTypes |
| Shared Schemas | `packages/shared/src/schemas/apiRequests.ts` | Added `locked` to UpdateGroupRequestSchema |
| Firestore Schema | `firebase/functions/src/schemas/group.ts` | Added `locked` to GroupDocumentSchema |
| Backend Validation | `firebase/functions/src/groups/validation.ts` | Added `locked` to validateUpdateGroup transform |
| Backend Permissions | `firebase/functions/src/permissions/permission-engine-async.ts` | Added locked check |
| Backend Service | `firebase/functions/src/services/GroupService.ts` | Handle locked logic + activity events |
| Error Codes | `firebase/functions/src/errors/error-codes.ts` | Added GROUP_LOCKED |
| Frontend Permissions | `webapp-v2/src/app/stores/permissions-store.ts` | Added locked check |
| Frontend Hook | `webapp-v2/src/app/hooks/useGroupLockSettings.ts` | Created new hook |
| Settings UI | `webapp-v2/src/components/group/settings/GroupGeneralTabContent.tsx` | Added lock toggle section |
| Settings Modal | `webapp-v2/src/components/group/GroupSettingsModal.tsx` | Integrated lock settings hook |
| Group Detail | `webapp-v2/src/pages/GroupDetailPage.tsx` | Added locked banner + disabled handlers |
| Group Actions | `webapp-v2/src/components/group/GroupActions.tsx` | Added isGroupLocked prop |
| Translations | `webapp-v2/src/locales/*/translation.json` | Added lock-related strings (all languages) |
| E2E Tests | `e2e-tests/src/__tests__/integration/group-locking.e2e.test.ts` | Created E2E test suite |
| Test Page Objects | `packages/test-support/src/page-objects/GroupSettingsModalPage.ts` | Added lock toggle methods |
| Test Page Objects | `packages/test-support/src/page-objects/GroupDetailPage.ts` | Added locked banner and button verification methods |

## Bug Fixes During Implementation

1. **validateUpdateGroup missing locked field**: The transform function in `groups/validation.ts` was not including the `locked` field in its output, causing the lock status to be stripped before reaching GroupService. Fixed by adding:
   ```typescript
   if (value.locked !== undefined) {
       update.locked = value.locked;
   }
   ```

---

## Research Findings (Preserved for Reference)

### Permission System Architecture

The permission system is well-architected with clear separation:

**Backend (`PermissionEngineAsync`)** - `firebase/functions/src/permissions/permission-engine-async.ts`
- Static, synchronous `checkPermission()` method
- Checks: member existence -> member status (ACTIVE required) -> viewer blocking -> permission level evaluation
- Actions checked: `expenseEditing`, `expenseDeletion`, `memberInvitation`, `settingsManagement`, `viewGroup`

**Frontend (`ClientPermissionEngine`)** - `webapp-v2/src/app/stores/permissions-store.ts`
- Mirrors backend logic exactly for immediate UI feedback
- Uses `PermissionsStore` with reference counting for component lifecycle
- Returns computed permissions: `canEditAnyExpense`, `canDeleteAnyExpense`, `canInviteMembers`, `canManageSettings`

### Existing Locked Item Patterns

The codebase already has `isLocked` patterns for expenses and settlements:
- `ExpenseDTO.isLocked` - True if any participant has left the group
- `SettlementDTO.isLocked` - True if payer or payee has left
- UI shows disabled edit buttons with tooltips when locked
