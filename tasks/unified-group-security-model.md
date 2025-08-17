# Task: Unified Group Security Model with Flexible Permissions

## Overview

This task combines the group security model with flexible expense permissions, creating a comprehensive permission system with convenient preset configurations for different collaboration styles.

### Key Design Principles

- **Progressive Disclosure**: Simple presets for casual users, advanced options for power users
- **Backward Compatibility**: Default configuration preserves existing behavior
- **Real-time Updates**: Permission changes take effect immediately across all active sessions
- **Audit Trail**: All permission and role changes are logged for accountability

## Security Configuration Presets

Rather than rigid "modes", the system provides convenient preset buttons that configure a bundle of security preferences for the group. Users can select a preset and then customize individual settings as needed.

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

    // Security Configuration
    securityPreset: 'open' | 'managed' | 'custom'; // default: 'open'
    presetAppliedAt?: Timestamp; // Track when preset was last applied

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

- `applySecurityPreset(groupId, preset)` - Apply a convenience preset (batch transaction)
- `updateGroupPermissions(groupId, permissions)` - Customize individual permissions
- `setMemberRole(groupId, targetUserId, role)` - Promote/demote members (with last admin check)
- `approveMember(groupId, userId)` - Approve pending members
- `rejectMember(groupId, userId)` - Reject pending members
- `getPendingMembers(groupId)` - List pending members
- `getPermissionHistory(groupId)` - View permission change audit log
- `createInviteLink(groupId, options)` - Create time-limited or single-use invite links

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
2. Check invite link validity (expiry, usage limits)
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

- All existing groups get **"Open Collaboration" preset** applied
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
    - Verify TTL expiry works correctly
3. **Real-time Sync Tests**:
    - Verify permission changes propagate to all active sessions
    - Verify UI updates when permissions change
4. **Edge Case Tests**:
    - Verify last admin cannot demote themselves
    - Verify pending members are auto-removed after 7 days
    - Verify invite links expire correctly
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

## Future Enhancements

1. **Permission Templates**: Allow organizations to save and share custom permission configurations
2. **Bulk Operations**: UI for managing multiple members' roles simultaneously
3. **Permission Delegation**: Allow admins to delegate specific permissions to trusted members
4. **Time-based Permissions**: Temporary admin rights for specific tasks
5. **API Keys**: Generate scoped API keys for third-party integrations
6. **Compliance Mode**: Enhanced audit and approval workflows for regulated industries
7. **Permission Analytics**: Dashboard showing permission usage patterns
8. **Smart Suggestions**: AI-powered preset recommendations based on group activity
