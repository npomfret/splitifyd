# Task: Consolidate Group Settings and Security Modals

## Problem
- Two separate settings buttons ("Group Settings" and "Security & Permissions") displayed on the group page
- Both use the same gear icon (CogIcon), creating visual confusion
- Settings functionality is split across two modals unnecessarily
- User sees duplicate settings buttons in both GroupHeader and GroupActions components

## Current State
- **EditGroupModal**: Handles group name, description, and group deletion
- **SecuritySettingsModal**: Handles permissions, security presets, member roles, and pending member approvals
- Both modals triggered by separate buttons with same icon

## Solution
Merge both modals into a single unified **Group Settings Modal** with tabs for different settings categories.

## Implementation Plan

### 1. Create New Unified Settings Modal Component
**File**: `webapp-v2/src/components/group/GroupSettingsModal.tsx` (new)

**Requirements**:
- Create tabbed modal with two main sections:
  - **General** tab: Group name, description, delete group (content from EditGroupModal)
  - **Security & Permissions** tab: Permissions, presets, member roles, pending approvals (content from SecuritySettingsModal)
- Tab implementation options:
  - Use existing tab component pattern if available
  - Or create simple tab UI with state management
- Consolidate all logic from both existing modals:
  - Form validation from EditGroupModal
  - Permission management from SecuritySettingsModal
  - Member role updates
  - Pending member approval/rejection
  - Group deletion with confirmation dialog

**Props**:
```typescript
interface GroupSettingsModalProps {
    isOpen: boolean;
    group: GroupDTO;
    members: GroupMember[];
    canManageMembers: boolean;
    canApproveMembers: boolean;
    isGroupOwner: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    onDelete?: () => void;
}
```

**Tab State**:
- Accept optional `initialTab?: 'general' | 'security'` prop
- Default to 'general' tab
- Allow switching between tabs without closing modal

### 2. Update GroupActions Component
**File**: `webapp-v2/src/components/group/GroupActions.tsx`

**Changes**:
- Remove `onSecurity` prop
- Remove `securityButton` rendering (lines 67-76)
- Remove `showSecurityButton` prop
- Keep only `onSettings` prop and `settingsButton`
- Update button label from "Group Settings" to just "Settings"

**Before**:
```typescript
interface GroupActionsProps {
    onSettings?: () => void;
    onSecurity?: () => void;
    showSettingsButton?: boolean;
    showSecurityButton?: boolean;
    // ...
}
```

**After**:
```typescript
interface GroupActionsProps {
    onSettings?: () => void;
    showSettingsButton?: boolean;
    // ...
}
```

### 3. Update GroupHeader Component
**File**: `webapp-v2/src/components/group/GroupHeader.tsx`

**Changes**:
- Remove `onSecurity` prop (line 13)
- Remove `showSecurityButton` prop (line 15)
- Remove security button rendering (lines 28-39)
- Keep only single settings button (lines 40-51)

**Before**:
```typescript
interface GroupHeaderProps {
    onSettings?: () => void;
    onSecurity?: () => void;
    showSettingsButton?: boolean;
    showSecurityButton?: boolean;
}
```

**After**:
```typescript
interface GroupHeaderProps {
    onSettings?: () => void;
    showSettingsButton?: boolean;
}
```

### 4. Update GroupDetailPage
**File**: `webapp-v2/src/pages/GroupDetailPage.tsx`

**Changes**:
- Remove `handleSecurity` function (lines 186-188)
- Remove all `onSecurity={handleSecurity}` references:
  - Line 229 (GroupActions in left sidebar)
  - Line 257 (mobile GroupActions)
  - Line 245 (GroupHeader)
- Remove all `showSecurityButton={canManageSecurity.value ?? false}` references:
  - Line 232 (GroupActions in left sidebar)
  - Line 260 (mobile GroupActions)
  - Line 247 (GroupHeader)
- Update modal imports (line 2):
  - Remove `SecuritySettingsModal`
  - Remove `EditGroupModal`
  - Add `GroupSettingsModal`
- Replace both modal renderings (lines 328-352) with single unified modal:

```typescript
{/* Unified Group Settings Modal */}
{(isGroupOwner.value || canManageSecurity.value) && (
    <GroupSettingsModal
        isOpen={modals.showSettingsModal.value}
        onClose={() => modals.closeSettingsModal()}
        group={group.value!}
        members={members.value}
        canManageMembers={canManageSecurity.value ?? false}
        canApproveMembers={canApproveMembers.value ?? false}
        isGroupOwner={isGroupOwner.value ?? false}
        onSuccess={handleGroupUpdateSuccess}
        onDelete={handleGroupDelete}
    />
)}
```

### 5. Update useGroupModals Hook
**File**: `webapp-v2/src/app/hooks/useGroupModals.ts`

**Changes**:
- Remove `showSecurityModal` signal
- Remove `openSecurityModal()` function
- Remove `closeSecurityModal()` function
- Rename `showEditModal` → `showSettingsModal` (for clarity)
- Rename `openEditModal()` → `openSettingsModal()`
- Rename `closeEditModal()` → `closeSettingsModal()`

**OR** keep existing names if preferred (editModal can mean "edit group settings")

### 6. Update Translations
**Files**: `webapp-v2/src/locales/en/translation.json` (and other locales)

**Add new keys**:
```json
{
  "groupSettingsModal": {
    "title": "Group Settings",
    "tabs": {
      "general": "General",
      "security": "Security & Permissions"
    }
  },
  "groupActions": {
    "settings": "Settings"
  },
  "groupHeader": {
    "groupSettingsAriaLabel": "Group settings"
  }
}
```

**Reuse existing keys**:
- Keep all `editGroupModal.*` keys for general tab content
- Keep all `securitySettingsModal.*` keys for security tab content

### 7. Update Component Exports
**File**: `webapp-v2/src/components/group/index.ts`

**Changes**:
- Remove exports for `EditGroupModal` and `SecuritySettingsModal`
- Add export for `GroupSettingsModal`

### 8. Delete Old Files (after successful migration and testing)
- Delete `webapp-v2/src/components/group/EditGroupModal.tsx`
- Delete `webapp-v2/src/components/group/SecuritySettingsModal.tsx`

## Testing Checklist

### Manual Testing
- [ ] Single settings button appears in GroupHeader (top right)
- [ ] Single settings button appears in GroupActions sidebar
- [ ] Settings button only shown to users with appropriate permissions
- [ ] Modal opens with General tab by default
- [ ] Can switch between General and Security tabs
- [ ] General tab: Can edit group name and description
- [ ] General tab: Can delete group (owner only)
- [ ] General tab: Form validation works correctly
- [ ] Security tab: Can apply security presets
- [ ] Security tab: Can customize individual permissions
- [ ] Security tab: Can update member roles
- [ ] Security tab: Can approve/reject pending members
- [ ] Security tab only accessible to users with `canManageSettings` permission
- [ ] Modal closes properly and doesn't leave state artifacts
- [ ] All error messages display correctly
- [ ] Loading states work correctly

### E2E Test Updates Required
Check for tests that reference:
- `group-settings-button` (should work unchanged)
- `group-security-button` (needs removal or update)
- `edit-group-modal-title` (update to `group-settings-modal-title`)
- `close-security-modal-button` (consolidate with general close)
- Any tests that open security modal specifically

Files to check:
- `e2e-tests/src/page-objects/group-header.page.ts`
- `e2e-tests/src/page-objects/group-actions.page.ts`
- Any tests in `e2e-tests/src/tests/` that interact with group settings

## Benefits

### UX Improvements
- Single, clear entry point for all group settings
- Better organization with tabbed interface
- Reduced visual clutter (one button instead of two identical icons)
- Consistent with common settings UI patterns

### Code Quality
- Reduced code duplication
- Simpler permission logic (one modal to control access)
- Easier maintenance (one place to update settings UI)
- Clearer component responsibilities

### Performance
- Slightly reduced bundle size (one modal instead of two)
- Simpler component tree

## Edge Cases to Handle

1. **Permission-based tab visibility**:
   - Users with only `isGroupOwner` should see both tabs
   - Users with only `canManageSettings` should see only Security tab
   - Hide tabs user doesn't have permission for

2. **Unsaved changes warning**:
   - Warn when switching tabs with unsaved changes
   - Warn when closing modal with unsaved changes

3. **Tab persistence**:
   - Consider remembering last active tab in session storage
   - Or always default to General tab for consistency

4. **Mobile responsiveness**:
   - Ensure tabs work well on mobile screens
   - Consider stacked layout for narrow viewports

## Implementation Order

1. Create new `GroupSettingsModal.tsx` with both tabs working
2. Update `GroupDetailPage.tsx` to use new modal (test in isolation)
3. Update `GroupActions.tsx` to remove security button
4. Update `GroupHeader.tsx` to remove security button
5. Update `useGroupModals` hook
6. Update translations
7. Update e2e tests
8. Delete old modal files
9. Final smoke testing

## Rollback Plan

If issues arise:
- Keep old modal files until fully tested
- Use feature flag or conditional rendering to toggle between old/new modals
- Revert GroupDetailPage changes to restore dual-modal setup
