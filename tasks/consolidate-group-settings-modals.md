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

### 1. Create New Unified Settings Modal Component ✅
**Status**: Implemented (`webapp-v2/src/components/group/GroupSettingsModal.tsx`)

- Consolidates the previous general/security modals into a tabbed UI.
- Supports `initialTab`, permission-gated tab visibility, and shared delete workflow.
- General tab reuses existing validation strings and delete confirmation copy.
- Security tab covers presets, granular permissions, member-role changes, and pending approvals.
- New props signature:

```typescript
interface GroupSettingsModalProps {
    isOpen: boolean;
    group: GroupDTO;
    members: GroupMember[];
    canManageMembers: boolean;
    canApproveMembers: boolean;
    isGroupOwner: boolean;
    onClose: () => void;
    onGroupUpdated?: () => Promise<void> | void;
    onDelete?: () => void;
    initialTab?: 'general' | 'security';
}
```

### 2. Update GroupActions Component ✅
- Removed security-specific props and button.
- Button text now reads `Settings` and maps to the new translation key.

### 3. Update GroupHeader Component ✅
- Only renders the single settings cog with updated copy.

### 4. Update GroupDetailPage ✅
- Routes all entry points through the unified modal.
- Computes `canShowSettingsButton` so owners and admins with manage/approve permissions see the button.
- Defaults the modal tab to `'general'` for owners and `'security'` for non-owners with manage permissions.

### 5. Update useGroupModals Hook ✅
- Replaced edit/security signals with `showGroupSettingsModal` plus `groupSettingsInitialTab`.
- Exposes `openGroupSettingsModal(tab)` and `closeGroupSettingsModal()`.

### 6. Update Translations ✅
- Added `groupSettingsModal` namespace and `groupActions.settings` string.
- Existing edit/security strings reused by the unified modal.

### 7. Update Component Exports ✅
- `GroupSettingsModal` is exported; legacy modal exports removed.

### 8. Delete Old Files ✅
- Removed `EditGroupModal.tsx` and `SecuritySettingsModal.tsx`.

### 9. Update Shared Test Support ✅
- Added `GroupSettingsModalPage` and refactored Playwright helpers to target the unified modal/tabs.
- Updated `GroupDetailPage` page object to use the new modal API.
- Removed legacy modal page objects.

### 10. Update App/Playwright Tests ✅
- Adjusted `group-detail.test.ts` to open the security tab via the new modal.
- Confirmed build passes (`npm run build`).

## Testing Checklist

### Manual Testing
- [ ] Single settings button appears in GroupHeader (top right)
- [ ] Single settings button appears in GroupActions sidebar
- [ ] Settings button only shown to users with appropriate permissions
- [ ] Modal opens with correct default tab based on permissions
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
Updates completed:
- Playwright/shared page objects now target `GroupSettingsModalPage`.
- Integration test (`group-detail.test.ts`) opens the security tab through the new modal API.

Still to do:
- Run the Playwright/e2e suites to confirm flows and adjust any downstream selectors if failures surface.
- Audit any external consumers outside this repo that may still import the removed modal page objects.

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

### Validation
- [x] `npm run build`
- [ ] Playwright/E2E suites

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
