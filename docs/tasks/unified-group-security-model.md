# Task: Unified Group Security Model with Flexible Permissions

## Overview

This task combines the group security model with flexible expense permissions, creating a comprehensive permission system that supports both collaborative (Open Mode) and controlled (Managed Mode) environments.

## Security Modes

### 1. Open Mode (Default)
**Current behavior with enhanced flexibility:**
- All members have equal permissions
- **Any member can add, edit, or delete any expense** (addresses unrestrict-expense-permissions requirement)
- All members can invite new users
- New members join immediately via share link
- No role distinctions

### 2. Managed Mode
**Structured role-based permissions:**
- Members have defined roles: "Admin" or "Member"
- Controlled permissions based on role
- Approval workflow for new members
- Enhanced audit and control features

## Permission Matrix

### Open Mode Permissions
| Action | Any Member |
|--------|------------|
| Add expense | ✅ |
| Edit any expense | ✅ |
| Delete any expense | ✅ |
| Invite members | ✅ |
| Join via link | ✅ Immediate |
| Change security mode | ✅ |

### Managed Mode Permissions
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
| Change security mode | ❌ | ✅ |

## Implementation Requirements

### 1. Database Schema Changes

Add to group document:
```typescript
interface Group {
  // existing fields...
  securityMode: 'open' | 'managed'; // default: 'open'
  members: {
    [userId: string]: {
      role: 'admin' | 'member'; // only used in managed mode
      joinedAt: Timestamp;
      status: 'active' | 'pending'; // pending for managed mode approvals
    }
  };
}
```

### 2. Backend Changes

#### Update Expense Handlers (`firebase/functions/src/expenses/handlers.ts`)

**updateExpense handler:**
```typescript
// Line ~248-252
if (group.securityMode === 'managed') {
  const isAdmin = group.members[userId]?.role === 'admin';
  if (expense.createdBy !== userId && !isAdmin) {
    throw new ForbiddenError('Only expense creator or admin can edit this expense');
  }
}
// In open mode, no restrictions - any member can edit
```

**deleteExpense handler:**
```typescript
// Line ~369-372
if (group.securityMode === 'managed') {
  const isAdmin = group.members[userId]?.role === 'admin';
  if (expense.createdBy !== userId && !isAdmin) {
    throw new ForbiddenError('Only expense creator or admin can delete this expense');
  }
}
// In open mode, no restrictions - any member can delete
```

#### Add Group Management Handlers

New endpoints needed:
- `setSecurityMode(groupId, mode)` - Change security mode
- `setMemberRole(groupId, targetUserId, role)` - Promote/demote members
- `approveMember(groupId, userId)` - Approve pending members
- `rejectMember(groupId, userId)` - Reject pending members
- `getPendingMembers(groupId)` - List pending members

### 3. Join Flow Updates

#### Open Mode (unchanged):
1. User clicks share link
2. User joins immediately
3. Full member access granted

#### Managed Mode:
1. User clicks share link
2. User added with `status: 'pending'`
3. UI shows "Awaiting admin approval"
4. Admins see notification/pending list
5. Admin approves/rejects
6. User gains access or is removed

### 4. Frontend Changes

#### Group Settings UI
Add new section for security management:
- Toggle between Open/Managed mode
- Member list with role indicators
- Role management controls (for admins)
- Pending members section (managed mode)

#### Expense UI
- Show edit/delete buttons based on permissions
- In managed mode, only show for own expenses (unless admin)
- In open mode, show for all expenses

### 5. Migration & Defaults

- All existing groups default to **Open Mode**
- Group creator becomes first admin when switching to Managed Mode
- Last admin check: Auto-revert to Open Mode if last admin leaves/demoted

## Security Considerations

1. **Group boundary protection** remains paramount
2. **Audit trail** preserved for all operations:
   - `createdBy`, `modifiedBy`, `deletedBy` tracked
   - Role changes logged
   - Security mode changes logged
3. **Permission checks** enforced at API level
4. **Gradual rollout** possible via feature flag

## Testing Requirements

### Open Mode Tests
1. Verify any member can edit any expense
2. Verify any member can delete any expense
3. Verify immediate join via share link
4. Verify all members can change security mode

### Managed Mode Tests
1. Verify members can only edit/delete own expenses
2. Verify admins can edit/delete any expense
3. Verify pending approval flow for new members
4. Verify role promotion/demotion
5. Verify auto-revert when last admin removed

### Security Tests
1. Verify non-members cannot access group
2. Verify audit trail captures all changes
3. Verify permission boundaries enforced
4. Verify mode transitions preserve data integrity

## Rollout Strategy

1. **Phase 1**: Implement Open Mode with unrestricted permissions
2. **Phase 2**: Add Managed Mode behind feature flag
3. **Phase 3**: Enable mode switching UI
4. **Phase 4**: Full production release

## Benefits

- **Flexibility**: Groups can choose their collaboration style
- **Backward Compatibility**: Default Open Mode preserves current behavior
- **Enhanced Control**: Managed Mode for organizations/formal groups
- **Clear Permission Model**: Explicit rules reduce confusion
- **Scalability**: Supports both casual and professional use cases