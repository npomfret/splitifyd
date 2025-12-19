# Webapp Standardization

## Status: Phase 2 Complete

Phase 1 complete: Layout components, hooks, and utilities created.
Phase 2 complete: Modal/List migrations and additional UI components.

---

## Completed in Phase 2

### Modals - Migrated to `useModalOpen`

Enhanced `useModalOpen` hook to support both `onOpen` and `onClose` callbacks.
Created `useModalOpenOrChange` hook for entity-editing modals (resets on open OR when entity changes).

- [x] `CreateGroupModal.tsx` - Simple open reset
- [x] `ShareGroupModal.tsx` - Uses useModalOpenOrChange with groupId
- [x] `UserEditorModal.tsx` - Uses useModalOpenOrChange with userId
- [x] `TenantEditorModal.tsx` - Uses useModalOpenOrChange with tenantId
- [x] `ExpenseDetailModal.tsx` - Both onOpen and onClose callbacks
- [x] `SettlementForm.tsx` - Complex initialization on open
- [x] `GroupSettingsModal.tsx` - Tab reset on open
- [x] `LeaveGroupDialog.tsx` - No migration needed (wraps ConfirmDialog)

### Lists - Migrated to `ListStateRenderer`

- [x] `ExpensesList.tsx`
- [x] `GroupsList.tsx`
- [x] `CommentsList.tsx`
- [x] `SettlementsList.tsx` - Not migrated (complex filtering/visibility logic)
- [x] `MembersList.tsx` - Not migrated (complex pattern with MembersListWithManagement)

### Additional UI Components Created

1. **`<ModalFormFooter>`** - Standardized Cancel + Submit button footer
   - Supports primary/danger variants
   - Handles loading and disabled states
   - Used in CreateGroupModal, DeleteGroupConfirmationModal

2. **`<FormFieldLabel>`** - Label + required indicator + tooltip
   - Auto-renders required asterisk when `required` prop set
   - Includes info icon tooltip when `helpText` provided
   - Used in CreateGroupModal (3 fields)

3. **`<CurrencyPicker>`** - Skipped
   - GroupCurrencySettings component already exists with this pattern
   - CreateGroupModal should ideally use GroupCurrencySettings directly

---

## Remaining Work (Deferred)

### Layout - GroupDetailPage Migration

The GroupDetailPage has a complex mobile/desktop pattern where:
- Components appear in different physical locations on mobile vs desktop
- The same component (e.g., BalancesSection) is rendered twice with `lg:hidden`/`hidden lg:block`

**Why it's complex:**
- Items need to physically move between columns (not just reorder within a column)
- On mobile: all items stack in a single column with specific order
- On desktop: items are distributed across left sidebar, main, and right sidebar

**Solution needed:** CSS Grid template areas with complete grid restructuring at breakpoints. The `ResponsiveColumns` component doesn't solve this because it only reorders items within the same grid flow.

---

## Files Created/Modified

### New Files
- `src/components/ui/ModalFormFooter.tsx`
- `src/components/ui/FormFieldLabel.tsx`

### Modified Files
- `src/app/hooks/useModalOpen.ts` - Added callbacks object, useModalOpenOrChange
- `src/components/ui/ListStateRenderer.tsx` - Fixed loading state logic
- `src/components/ui/index.ts` - Added exports
- Modal files (7) - Migrated to useModalOpen
- List files (3) - Migrated to ListStateRenderer
