# Task: Unified Group Security Model with Flexible Permissions

## Overview

This task combines the group security model with flexible expense permissions, creating a comprehensive permission system with convenient preset configurations for different collaboration styles.

### Key Design Principles

- **Progressive Disclosure**: Simple presets for casual users, advanced options for power users
- **Real-time Updates**: Permission changes take effect immediately across all active sessions
- **Audit Trail**: All permission and role changes are logged for accountability

## Security Configuration Presets

Rather than rigid "modes", the system provides convenient preset buttons that configure a bundle of security preferences for the group. Users can select a preset and then customize individual settings as needed.

Preset selections are never persisted—only the resulting permission values are stored. The UI can infer which preset best matches the current state but must not rely on a dedicated `securityPreset` flag.

### 1. "Open Collaboration" Preset (Default)

**Convenience preset for casual groups:**

- All members have equal permissions
- **Any member can add, edit, or delete any expense** (addresses unrestrict-expense-permissions requirement)
- All members can invite new users
- New members join immediately via share link
- No role distinctions
- Anyone can change security settings

### 2. "Managed Group" Preset

**Convenience preset for structured groups:**

- Members have defined roles: "Admin" or "Member"
- Role-based permission restrictions
- Admin approval required for new members
- Enhanced audit and control features
- Only admins can change security settings

### 3. Future Presets (Extensible)

**System designed to support additional presets:**

- "Read-Only Viewer" - For stakeholders who need visibility but not editing rights
- "Department Budget" - Specialized for corporate expense tracking
- Custom templates saved by organizations

## Permission Matrix

### Open Collaboration Permissions

| Action                   | Any Member   |
| ------------------------ | ------------ |
| Add expense              | ✅           |
| Edit any expense         | ✅           |
| Delete any expense       | ✅           |
| Invite members           | ✅           |
| Join via link            | ✅ Immediate |
| Change security settings | ✅           |

### Managed Group Permissions

| Action                   | Member | Admin |
| ------------------------ | ------ | ----- |
| Add expense              | ✅     | ✅    |
| Edit own expense         | ✅     | ✅    |
| Edit any expense         | ❌     | ✅    |
| Delete own expense       | ✅     | ✅    |
| Delete any expense       | ❌     | ✅    |
| View all expenses        | ✅     | ✅    |
| Invite members           | ❌     | ✅    |
| Approve join requests    | ❌     | ✅    |
| Promote to Admin         | ❌     | ✅    |
| Demote from Admin        | ❌     | ✅    |
| Change security settings | ❌     | ✅    |

## Implementation Requirements

### 1. Database Schema Changes

Add to group document:

```typescript
interface Group {
    // existing fields...

    // Individual permission settings (customizable after preset selection)
    permissions: {
        expenseEditing: 'anyone' | 'owner-and-admin' | 'admin-only';
        expenseDeletion: 'anyone' | 'owner-and-admin' | 'admin-only';
        memberInvitation: 'anyone' | 'admin-only';
        memberApproval: 'automatic' | 'admin-required';
        settingsManagement: 'anyone' | 'admin-only';
    };

    // Member roles (used when permissions require role-based access)
    members: {
        [userId: string]: {
            role: 'admin' | 'member' | 'viewer'; // default: 'member'
            joinedAt: Timestamp;
            status: 'active' | 'pending'; // pending for admin approval
            lastPermissionChange?: Timestamp; // Track permission updates
        };
    };

    // Permission change history
    permissionHistory?: Array<{
        timestamp: Timestamp;
        changedBy: string;
        changeType: 'preset' | 'custom' | 'role';
        changes: Record<string, any>;
    }>;

    // Invite link configuration
    inviteLinks?: {
        [linkId: string]: {
            createdAt: Timestamp;
            createdBy: string;
            expiresAt?: Timestamp; // Optional expiry for managed groups
            maxUses?: number; // Optional usage limit
            usedCount: number;
        };
    };
}
```

> ℹ️ Preset usage is recorded implicitly by the values written to `permissions` (and explicitly via `permissionHistory` entries). There is **no** `securityPreset` field in the persisted document.

### 2. Backend Changes

#### Update Expense Handlers (`firebase/functions/src/expenses/handlers.ts`)

**updateExpense handler:**

```typescript
// Line ~248-252
const canEdit = checkPermission(group, userId, 'expenseEditing', expense);
if (!canEdit) {
    throw new ForbiddenError('You do not have permission to edit this expense');
}

function checkPermission(group: Group, userId: string, action: string, expense?: Expense): boolean {
    const userRole = group.members[userId]?.role || 'member';
    const permission = group.permissions[action];

    // Viewer role can only read, never modify
    if (userRole === 'viewer' && ['expenseEditing', 'expenseDeletion'].includes(action)) {
        return false;
    }

    switch (permission) {
        case 'anyone':
            return userRole !== 'viewer';
        case 'owner-and-admin':
            return userRole === 'admin' || expense?.createdBy === userId;
        case 'admin-only':
            return userRole === 'admin';
        default:
            return false;
    }
}

// Cache permissions client-side with TTL
class PermissionCache {
    private cache = new Map<string, { value: boolean; expires: number }>();
    private ttl = 60000; // 1 minute TTL

    check(key: string, compute: () => boolean): boolean {
        const cached = this.cache.get(key);
        if (cached && cached.expires > Date.now()) {
            return cached.value;
        }

        const value = compute();
        this.cache.set(key, { value, expires: Date.now() + this.ttl });
        return value;
    }

    invalidate(pattern?: string) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }
}
```

**deleteExpense handler:**

```typescript
// Line ~369-372
const canDelete = checkPermission(group, userId, 'expenseDeletion', expense);
if (!canDelete) {
    throw new ForbiddenError('You do not have permission to delete this expense');
}
```

#### Add Group Management Handlers

New endpoints needed:

- `applySecurityPreset(groupId, preset)` - Apply a convenience preset (batch transaction that writes the corresponding permission values and audit log entries — no preset flag is stored)
- `updateGroupPermissions(groupId, permissions)` - Customize individual permissions
- `setMemberRole(groupId, targetUserId, role)` - Promote/demote members (with last admin check)
- `approveMember(groupId, userId)` - Approve pending members
- `rejectMember(groupId, userId)` - Reject pending members
- `getPendingMembers(groupId)` - List pending members
- `getPermissionHistory(groupId)` - View permission change audit log
- `createInviteLink(groupId)` - Generate invite links that admins can share

**Edge Case Handling:**

````typescript
async function setMemberRole(groupId: string, targetUserId: string, newRole: string) {
  const group = await getGroup(groupId);

  // Prevent last admin from demoting themselves
  if (newRole !== 'admin') {
    const adminCount = Object.values(group.members)
      .filter(m => m.role === 'admin' && m.status === 'active')
      .length;

    if (adminCount === 1 && group.members[targetUserId]?.role === 'admin') {
      throw new Error('Cannot remove last admin. Promote another member first.');
    }
  }

  // Prevent removing group creator without explicit confirmation
  if (targetUserId === group.createdBy && newRole === 'viewer') {
    // Require additional confirmation flag
    throw new Error('Changing creator permissions requires explicit confirmation');
  }

  // Update role with audit log
  await updateMemberRole(groupId, targetUserId, newRole, {
    changedBy: currentUserId,
    timestamp: Date.now(),
    previousRole: group.members[targetUserId]?.role
  });
}

### 3. Join Flow Updates

#### Open Collaboration (unchanged):
1. User clicks share link
2. User joins immediately (automatic approval)
3. Full member access granted

#### Managed Group:
1. User clicks share link
2. Validate invite link is active and has not been revoked
3. User added with `status: 'pending'` if `memberApproval: 'admin-required'`
4. UI shows "Awaiting admin approval"
5. Admins see notification/pending list
6. Admin approves/rejects
7. User gains access or is removed
8. Pending members auto-removed after 7 days if not approved

### 4. Frontend Changes

#### Group Settings UI
Add new section for security management:

**Security Presets Section:**
- Quick preset buttons: "Open Collaboration" | "Managed Group"
- Visual indicator when custom permissions deviate from preset
- Indicator is computed by comparing current permission values to preset definitions (no dedicated flag)
- Description of what each preset configures
- "Permission Simulator" showing what each role can do

**Custom Permissions Section:**
- Individual permission toggles/dropdowns
- Warning dialogs for permission downgrades
- Member list with role indicators and last activity
- Role management controls (for admins)
- Pending members section (when approval required)
- Permission history viewer (last 30 days)

**UI Flow:**
1. User clicks a preset button → confirmation dialog → batch transaction applies all permissions
2. Visual feedback shows which settings changed
3. User can then customize individual permissions if desired
4. Advanced users can ignore presets and configure manually
5. Real-time updates push permission changes to all active sessions

#### Expense UI
- Show edit/delete buttons based on current permission settings
- Dynamic based on individual permissions, not preset
- Permission tooltips explain why actions are/aren't available

### 5. Migration & Defaults

- All existing groups have their permission fields set to the **"Open Collaboration"** defaults
- Group creator becomes first admin when using role-based permissions
- Last admin check: Auto-assign admin role to another member or revert to open permissions
- Migration preview mode: Show admins what would change before applying
- Batch migration with progress tracking for large deployments

### 6. Real-time Permission Synchronization

```typescript
// Client-side permission sync
class PermissionSync {
  private unsubscribe: (() => void) | null = null;

  subscribeToPermissionChanges(groupId: string) {
    // Listen for permission changes
    this.unsubscribe = onSnapshot(
      doc(db, 'groups', groupId),
      (snapshot) => {
        const data = snapshot.data();
        if (data?.permissions) {
          // Update local permission cache
          permissionCache.invalidate(groupId);

          // Update UI to reflect new permissions
          updateUIPermissions(data.permissions);

          // Show notification if user's own permissions changed
          if (hasUserPermissionsChanged(data)) {
            showNotification('Your permissions have been updated');
          }
        }
      }
    );
  }

  dispose() {
    this.unsubscribe?.();
  }
}
````

## Security Considerations

1. **Group boundary protection** remains paramount
2. **Audit trail** preserved for all operations:
    - `createdBy`, `modifiedBy`, `deletedBy` tracked
    - Role changes logged with timestamp and actor
    - Permission changes logged with before/after state
    - Preset applications logged
    - Audit log retention: 90 days minimum
3. **Permission checks** enforced at API level based on current settings
4. **Rate limiting** on permission changes (max 10 changes per minute per group)
5. **Race condition prevention** using optimistic locking for concurrent permission changes
6. **Permission escalation protection** - users cannot grant themselves higher permissions
7. **Invite link security**:
    - Time-limited links for managed groups (default 7 days)
    - Single-use option for high-security groups
    - Link revocation capability
8. **Gradual rollout** possible via feature flags:
    - `enableManagedGroups`
    - `enableCustomPermissions`
    - `enablePendingApprovals`
    - `enablePermissionHistory`

## Testing Requirements

### Open Collaboration Tests

1. Verify preset applies all expected permissions
2. Verify any member can edit any expense
3. Verify any member can delete any expense
4. Verify immediate join via share link
5. Verify all members can change security settings

### Managed Group Tests

1. Verify preset applies all expected permissions
2. Verify members can only edit/delete own expenses
3. Verify admins can edit/delete any expense
4. Verify pending approval flow for new members
5. Verify role promotion/demotion
6. Verify auto-admin assignment when last admin removed

### Custom Permission Tests

1. Verify individual permission overrides work
2. Verify mixed permission combinations
3. Verify permission changes take effect immediately
4. Verify UI reflects current permissions accurately

### Security Tests

1. Verify non-members cannot access group
2. Verify audit trail captures all changes
3. Verify permission boundaries enforced
4. Verify preset transitions preserve data integrity

### Additional Tests

1. **Concurrent Edit Tests**:
    - Verify no data loss when two admins change permissions simultaneously
    - Verify optimistic locking prevents conflicting changes
2. **Permission Cache Tests**:
    - Verify cache invalidation on permission changes
3. **Real-time Sync Tests**:
    - Verify permission changes propagate to all active sessions
    - Verify UI updates when permissions change
4. **Edge Case Tests**:
    - Verify last admin cannot demote themselves
    - Verify pending members are auto-removed after 7 days
5. **Performance Tests**:
    - Verify permission checks don't impact API response times
    - Test with groups having 100+ members
6. **Rate Limiting Tests**:
    - Verify rate limits prevent permission change spam
    - Verify legitimate changes aren't blocked

## Rollout Strategy

1. **Phase 1**: Implement permission system with Open Collaboration preset
    - Core permission framework
    - Basic UI with preset selection
    - Migration for existing groups
2. **Phase 2**: Add Managed Group preset behind feature flag
    - Role-based permissions
    - Admin approval flow
    - Pending member management
3. **Phase 3**: Add advanced features
    - Custom permission controls
    - Permission history viewer
    - Time-limited invite links
    - Permission simulator UI
4. **Phase 4**: Full production release
    - Remove feature flags
    - Enable all presets
    - Launch user education campaign

## Benefits

- **User-Friendly**: Simple preset buttons for common configurations
- **Flexible**: Individual permissions can be customized after preset selection
- **Backward Compatibility**: Default Open Collaboration preserves current behavior
- **Progressive Disclosure**: Simple presets for casual users, advanced options for power users
- **Clear Mental Model**: Presets as starting points, not rigid constraints
- **Scalability**: Supports both casual groups and formal organizations
- **Security**: Comprehensive audit trail and permission boundaries
- **Performance**: Cached permissions with smart invalidation
- **Real-time**: Permission changes propagate instantly to all users
- **Extensible**: Easy to add new presets and permission types

## Implementation Plan

### Phase 1: Core Permission Framework (Week 1-2) ✅ COMPLETED

**Goal**: Establish foundation with Open Collaboration preset

**Backend Tasks**:

1. **Database Schema Migration** (`firebase/functions/src/migrations/`) ✅ COMPLETED
    - ✅ Create migration script to align existing groups' permissions with the Open Collaboration defaults
    - ✅ Add new fields to Group interface in `shared/shared-types.ts`
    - Update group validation schemas in `groups/validation.ts` (pending)

2. **Permission System Core** (`firebase/functions/src/permissions/`) ✅ COMPLETED
    - ✅ Create `PermissionEngine` class with role/permission checking logic
    - ✅ Implement `checkPermission()` function for expense operations
    - ✅ Add `PermissionCache` class with TTL-based caching
    - ✅ Create permission constants and types

3. **Update Expense Handlers** (`firebase/functions/src/expenses/handlers.ts`) ✅ COMPLETED
    - ✅ Integrate permission checks in `updateExpense` (lines ~243-248)
    - ✅ Integrate permission checks in `deleteExpense` (lines ~424-430)
    - ✅ Add permission validation to `createExpense`

**Frontend Tasks**: 4. **Shared Types** (`firebase/functions/src/shared/shared-types.ts`) ✅ COMPLETED

- ✅ Add Group security interfaces
- ✅ Add Permission enums and types
- ✅ Export for frontend consumption via `@shared`

5. **Permission Store** (`webapp-v2/src/stores/permissions-store.ts`) ✅ COMPLETED
    - ✅ Create reactive store for user permissions
    - ✅ Implement real-time permission sync
    - ✅ Cache permissions with invalidation

**Testing**: 6. **Unit Tests** (`firebase/functions/src/__tests__/unit/`) ✅ COMPLETED

- ✅ Permission engine logic tests
- ✅ Cache behavior tests
- Migration script tests (pending)

7. **Integration Tests** (`firebase/functions/src/__tests__/integration/`)
    - Expense CRUD with permission checks (pending)
    - Group creation with default permissions (pending)
    - Permission inheritance tests (pending)

**Remaining Tasks**: 8. **Fix TypeScript Compilation Errors** ✅ COMPLETED

- ✅ Update existing test builders to use new MemberRole types
- ✅ Fix type mismatches between legacy "owner"/"member" and new role system
- ✅ Update group helpers to use new permission system
- ✅ Resolve balance calculation type conflicts

### Phase 2: Managed Group Preset (Week 3-4) ⚠️ PARTIALLY COMPLETE

**Goal**: Add role-based permissions and admin approval

**Backend Tasks**: 8. **Group Management Handlers** (`firebase/functions/src/groups/handlers.ts`) ✅ COMPLETED

- ✅ `applySecurityPreset(groupId, preset)` endpoint
- ✅ `setMemberRole(groupId, targetUserId, role)` with last admin protection
- ✅ `approveMember(groupId, userId)` and `rejectMember(groupId, userId)`
- ✅ `getPendingMembers(groupId)` endpoint

**Frontend Tasks**: 10. **Security Settings UI** (`webapp-v2/src/components/group/SecuritySettingsModal.tsx`) ✅ COMPLETED - Added presets, custom toggles, role management, and pending approvals in dedicated modal

11. **Permission-Aware Components** ⚠️ PARTIALLY COMPLETE
    - ✅ Primary actions and headers respect computed permissions
    - Update expense list/forms to show/hide edit/delete based on permissions
    - Add permission tooltips explaining restrictions
    - Update member invitation flow for managed groups

**Testing**: 12. **Role-based Permission Tests** ✅ PARTIALLY IMPLEMENTED - ✅ Admin vs member permission boundaries - **4 tests passing for preset application (permissions updated correctly) and role changes** - ✅ Last admin protection scenarios - **Unit tests now cover last-admin protection** - ✅ Pending member approval workflow - **Unit tests cover join pending flow; integration test exercises approval/rejection APIs** - ✅ Frontend security modal behaviours covered by Playwright

**Current Changeset Analysis (2025-08-27):**

**✅ Completed in this changeset:**

1. **System Role Renaming**: Changed `UserRoles.ADMIN/USER` → `SystemUserRoles.SYSTEM_ADMIN/SYSTEM_USER`
2. **Type System Improvements**:
    - Fixed User interface to use `SystemUserRole` instead of incorrectly using `MemberRole`
    - Added backward compatibility alias `UserRoles = SystemUserRoles`
    - Clear separation between system-level roles (app admin) and group-level roles (group admin/member/viewer)
3. **Test Infrastructure**:
    - Added 6 new ApiDriver methods for security management
    - Created integration tests verifying preset application updates permissions and role management
    - Tests confirm permission boundaries work (admins can change settings, members cannot)

**⚠️ Key Findings:**

1. **Preset application tests PASS** - Admin can trigger permission bundles, members get 403
2. **Member role tests PASS** - Admin can change roles, members get 403, last admin protected
3. **Pending member tests FAIL** - Endpoints return 404 (not implemented)
4. **Type confusion fixed** - User.role now correctly typed as SystemUserRole

**Next Steps Required:**

1. Verify backend handler implementations for preset application and role management
2. Implement pending member approval endpoints (currently missing)
3. Build frontend UI components for security management

### Phase 3: Advanced Features (Week 5-6)

**Goal**: Complete the full feature set

**Backend Tasks**: 13. **Audit System** (`firebase/functions/src/audit/`) - `getPermissionHistory(groupId)` endpoint - Permission change logging middleware - Audit log retention policies (90 days)

14. **Rate Limiting** (`firebase/functions/src/middleware/`)
    - Permission change rate limiting (10/minute per group)
    - Optimistic locking for concurrent changes

**Frontend Tasks**: 15. **Advanced UI Features** - Permission history viewer - Permission simulator showing role capabilities

- Batch member role changes - Real-time permission change notifications

16. **UX Enhancements**
    - Confirmation dialogs for permission downgrades
    - Visual indicators when permissions deviate from preset
    - Progressive disclosure of advanced options

**Testing**: 17. **E2E Tests** (`e2e-tests/src/tests/`) - Complete user journeys for both presets - Multi-user permission scenarios - Real-time permission updates across sessions - Edge cases and error conditions

### Phase 4: Production Readiness (Week 7)

**Goal**: Deploy-ready with monitoring and documentation

18. **Feature Flags** (`firebase/functions/src/config/`)
    - `enableManagedGroups`, `enableCustomPermissions` flags
    - Gradual rollout configuration

19. **Performance Optimization**
    - Permission cache performance testing
    - Database query optimization for role lookups
    - Real-time sync performance tuning

20. **Documentation & Migration**
    - User-facing documentation for new features
    - Admin guide for permission management
    - Deployment runbook and rollback procedures

### Critical Path Dependencies

1. **Phase 1 → Phase 2**: Core permission system must be solid before adding roles
2. **Database Schema → All Backend**: Migration must complete before handler updates
3. **Backend APIs → Frontend**: Core endpoints needed before UI development
4. **Permission Store → UI Components**: Reactive state needed for real-time updates

### Risk Mitigation

- **Backward Compatibility**: All existing groups default to Open Collaboration (no behavior change)
- **Feature Flags**: Managed Groups behind flag for safe rollout
- **Migration Safety**: Preview mode shows changes before applying
- **Performance**: Permission caching prevents API slowdown
- **Testing Coverage**: Comprehensive tests at unit, integration, and E2E levels

### Success Metrics

- **Zero Breaking Changes**: Existing functionality unchanged
- **Performance**: <100ms added latency for permission checks
- **Adoption**: 20% of groups use Managed preset within 30 days
- **Reliability**: <0.1% error rate on permission operations

## Future Enhancements

1. **Permission Templates**: Allow organizations to save and share custom permission configurations
2. **Bulk Operations**: UI for managing multiple members' roles simultaneously
3. **Permission Delegation**: Allow admins to delegate specific permissions to trusted members
4. **Time-based Permissions**: Temporary admin rights for specific tasks
5. **API Keys**: Generate scoped API keys for third-party integrations
6. **Compliance Mode**: Enhanced audit and approval workflows for regulated industries
7. **Permission Analytics**: Dashboard showing permission usage patterns
8. **Smart Suggestions**: AI-powered preset recommendations based on group activity
