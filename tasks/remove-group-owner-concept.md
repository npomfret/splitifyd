# Remove Group Owner Concept

## Overview

The codebase has a legacy "group owner" concept based on `group.createdBy` that should be replaced entirely by the group permissions system (admin role, permission levels). The creator should have no special privileges beyond being automatically assigned as the first admin.

## Requirements

1. **Remove creator-based restrictions** - Any admin can leave or be removed (not just the creator)
2. **Permission-based settings access** - Use `canManageSettings` permission instead of checking creator
3. **Remove `createdBy` field** - No longer needed on groups
4. **Rename `OWNER_AND_ADMIN`** - Rename to clarify it means "expense creator + admins"
5. **Protect last admin** - Server must prevent the last admin from being downgraded or removed

---

## Implementation Plan

### Phase 1: Backend - Protect Last Admin

**File: `firebase/functions/src/services/GroupMemberService.ts`**

1. Add helper method to check if user is the last admin:
   ```typescript
   private async isLastAdmin(groupId: GroupId, userId: UserId): Promise<boolean>
   ```

2. Update `leaveGroup()` (around line 407):
   - Remove `group.createdBy === targetUserId` check
   - Add check: if user is admin AND is last admin, throw error
   - New error: `'Last admin cannot leave the group'`

3. Update `removeMember()` (around line 417-422):
   - Remove `group.createdBy !== requestingUserId` check
   - Remove `targetUserId === group.createdBy` check
   - Add check: if target is last admin, throw error
   - New error: `'Last admin cannot be removed'`

4. Add new endpoint or update existing for role changes:
   - Prevent downgrading the last admin to member/viewer
   - New error: `'Cannot downgrade the last admin'`

**File: `firebase/functions/src/errors/ErrorCode.ts`**
- Remove or repurpose `NOT_OWNER` error detail
- Add `LAST_ADMIN_PROTECTED` error detail

### Phase 2: Backend - Remove createdBy from Groups

**File: `packages/shared/src/shared-types.ts`**
- Remove `createdBy: UserId` from `Group` interface (line 825)
- Keep `createdBy` on `Expense`, `Settlement`, `InviteLink` etc. (those are valid)

**File: `firebase/functions/src/services/GroupService.ts`**
- Line 326: Remove `createdBy: userId` from group document creation
- Lines 308-309: Update comments to remove "owner" terminology

**File: `firebase/functions/src/schemas/`**
- Update group document schema to remove `createdBy` field

**File: `packages/shared/src/schemas/apiSchemas.ts`**
- Update `GroupDTOSchema` to remove `createdBy`

### Phase 3: Backend - Rename Permission Level

**File: `packages/shared/src/shared-types.ts`**
- Rename `OWNER_AND_ADMIN` to `CREATOR_AND_ADMIN` (lines 343-346)
- This refers to expense/settlement creator, not group owner

**File: `packages/shared/src/schemas/apiSchemas.ts`**
- Update permission level validation from `'owner-and-admin'` to `'creator-and-admin'`

**File: `firebase/functions/src/permissions/permission-engine-async.ts`**
- Update permission level constant reference

**File: `webapp-v2/src/locales/en/translation.json`**
- Update translation key and possibly the display text

### Phase 4: Frontend - Permission-Based Settings Access

**File: `webapp-v2/src/pages/GroupDetailPage.tsx`**
- Remove `isGroupOwner` computed signal (line 63)
- Update `canShowSettingsButton` to not use `isGroupOwner`
- Update `canLeaveGroup` - remove `!isGroupOwner.value` (any admin can leave if not last)
- Remove owner-specific default tab logic (line 299)
- Update `GroupSettingsModal` props - remove `isGroupOwner`

**File: `webapp-v2/src/components/group/GroupSettingsModal.tsx`**
- Remove `isGroupOwner` prop
- Change `canManageGeneralSettings` to use `canManageSettings` permission
- Update `securityTabAvailable` logic

### Phase 5: Test Updates

**File: `firebase/functions/src/__tests__/unit/services/GroupMemberService.test.ts`**
- Update test `'should prevent group creator from leaving'` → `'should prevent last admin from leaving'`
- Update test `'should prevent removing the group creator'` → `'should prevent removing the last admin'`
- Add test: `'should allow admin to leave if other admins exist'`
- Add test: `'should prevent downgrading the last admin'`

**File: `packages/test-support/src/builders/GroupDTOBuilder.ts`**
- Remove `createdBy` from default group builder

**E2E Tests**: Update any tests that rely on owner behavior

---

## Migration Considerations

- Existing groups have `createdBy` field - can be left in Firestore (ignored) or cleaned up separately
- No data migration script needed - the field simply becomes unused
- Frontend will stop reading it, backend will stop writing it

---

## Files to Modify

| File | Changes |
|------|---------|
| `firebase/functions/src/services/GroupMemberService.ts` | Replace owner checks with last-admin checks |
| `firebase/functions/src/services/GroupService.ts` | Remove createdBy, update comments |
| `firebase/functions/src/errors/ErrorCode.ts` | Update error codes |
| `packages/shared/src/shared-types.ts` | Remove createdBy from Group, rename permission |
| `packages/shared/src/schemas/apiSchemas.ts` | Update schemas |
| `firebase/functions/src/schemas/` | Update group document schema |
| `firebase/functions/src/permissions/permission-engine-async.ts` | Update permission level name |
| `webapp-v2/src/pages/GroupDetailPage.tsx` | Remove isGroupOwner logic |
| `webapp-v2/src/components/group/GroupSettingsModal.tsx` | Use permission instead of owner check |
| `webapp-v2/src/locales/en/translation.json` | Update permission level translation |
| Various test files | Update test expectations |

---

## Acceptance Criteria

- [ ] Last admin cannot leave the group (server enforced)
- [ ] Last admin cannot be removed (server enforced)
- [ ] Last admin cannot be downgraded to member/viewer (server enforced)
- [ ] Any admin (not just creator) can access general settings if they have `canManageSettings`
- [ ] Any admin can leave if other admins exist
- [ ] `createdBy` field no longer written to new groups
- [ ] No UI references to "owner" concept for groups
- [ ] All existing tests pass or are updated
- [ ] Permission level renamed from `owner-and-admin` to `creator-and-admin`
