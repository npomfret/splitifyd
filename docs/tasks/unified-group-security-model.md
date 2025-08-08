# Task: Unified Group Security Model with Flexible Permissions

## Overview

This task combines the group security model with flexible expense permissions, creating a comprehensive permission system with convenient preset configurations for different collaboration styles.

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

## Permission Matrix

### Open Collaboration Permissions
| Action | Any Member |
|--------|------------|
| Add expense | ✅ |
| Edit any expense | ✅ |
| Delete any expense | ✅ |
| Invite members | ✅ |
| Join via link | ✅ Immediate |
| Change security settings | ✅ |

### Managed Group Permissions
| Action | Member | Admin |
|--------|--------|-------|
| Add expense | ✅ | ✅ |
| Edit own expense | ✅ | ✅ |
| Edit any expense | ❌ | ✅ |
| Delete own expense | ✅ | ✅ |
| Delete any expense | ❌ | ✅ |
| View all expenses | ✅ | ✅ |
| Invite members | ❌ | ✅ |
| Approve join requests | ❌ | ✅ |
| Promote to Admin | ❌ | ✅ |
| Demote from Admin | ❌ | ✅ |
| Change security settings | ❌ | ✅ |

## Implementation Requirements

### 1. Database Schema Changes

Add to group document:
```typescript
interface Group {
  // existing fields...
  
  // Security Configuration
  securityPreset: 'open' | 'managed'; // default: 'open'
  
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
      role: 'admin' | 'member'; // default: 'member'
      joinedAt: Timestamp;
      status: 'active' | 'pending'; // pending for admin approval
    }
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
  
  switch (permission) {
    case 'anyone':
      return true;
    case 'owner-and-admin':
      return userRole === 'admin' || expense?.createdBy === userId;
    case 'admin-only':
      return userRole === 'admin';
    default:
      return false;
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
- `applySecurityPreset(groupId, preset)` - Apply a convenience preset
- `updateGroupPermissions(groupId, permissions)` - Customize individual permissions
- `setMemberRole(groupId, targetUserId, role)` - Promote/demote members
- `approveMember(groupId, userId)` - Approve pending members
- `rejectMember(groupId, userId)` - Reject pending members
- `getPendingMembers(groupId)` - List pending members

### 3. Join Flow Updates

#### Open Collaboration (unchanged):
1. User clicks share link
2. User joins immediately (automatic approval)
3. Full member access granted

#### Managed Group:
1. User clicks share link
2. User added with `status: 'pending'` if `memberApproval: 'admin-required'`
3. UI shows "Awaiting admin approval"
4. Admins see notification/pending list
5. Admin approves/rejects
6. User gains access or is removed

### 4. Frontend Changes

#### Group Settings UI
Add new section for security management:

**Security Presets Section:**
- Quick preset buttons: "Open Collaboration" | "Managed Group"
- Description of what each preset configures

**Custom Permissions Section:**
- Individual permission toggles/dropdowns
- Member list with role indicators
- Role management controls (for admins)
- Pending members section (when approval required)

**UI Flow:**
1. User clicks a preset button → all permissions configured instantly
2. User can then customize individual permissions if desired
3. Advanced users can ignore presets and configure manually

#### Expense UI
- Show edit/delete buttons based on current permission settings
- Dynamic based on individual permissions, not preset
- Permission tooltips explain why actions are/aren't available

### 5. Migration & Defaults

- All existing groups get **"Open Collaboration" preset** applied
- Group creator becomes first admin when using role-based permissions
- Last admin check: Auto-assign admin role to another member or revert to open permissions

## Security Considerations

1. **Group boundary protection** remains paramount
2. **Audit trail** preserved for all operations:
   - `createdBy`, `modifiedBy`, `deletedBy` tracked
   - Role changes logged
   - Permission changes logged
   - Preset applications logged
3. **Permission checks** enforced at API level based on current settings
4. **Gradual rollout** possible via feature flag

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

## Rollout Strategy

1. **Phase 1**: Implement permission system with Open Collaboration preset
2. **Phase 2**: Add Managed Group preset behind feature flag
3. **Phase 3**: Add custom permission controls
4. **Phase 4**: Full production release with preset UI

## Benefits

- **User-Friendly**: Simple preset buttons for common configurations
- **Flexible**: Individual permissions can be customized after preset selection
- **Backward Compatibility**: Default Open Collaboration preserves current behavior
- **Progressive Disclosure**: Simple presets for casual users, advanced options for power users
- **Clear Mental Model**: Presets as starting points, not rigid constraints
- **Scalability**: Supports both casual groups and formal organizations