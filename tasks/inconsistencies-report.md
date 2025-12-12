# Inconsistencies Report

This report summarizes the inconsistencies found in the project's TypeScript (`.ts` and `.tsx`) files when compared against the established coding guidelines.

## Summary of Findings - ALL RESOLVED

### 1. ~~Widespread use of `class` instead of `className` in `.tsx` files.~~ **FIXED**

**Status:** Fixed - Replaced all 712 occurrences of `class='` with `className='` across 57 TSX files for consistency.

### 2. ~~Mixing `useState` and `useSignal`~~ **FIXED**

**Status:** Fixed - Converted the following components to use `useState` consistently:
- `webapp-v2/src/components/comments/CommentInput.tsx` - Converted `isEditing` and `text` signals to useState
- `webapp-v2/src/components/expense/ExpenseDetailModal.tsx` - Converted `expense`, `loading`, `error`, `group`, `members` signals to useState
- `webapp-v2/src/components/settlements/SettlementHistory.tsx` - Converted `showAllSettlements` signal to useState

**Note:** `ShareGroupModal.tsx` uses `useState(() => signal(...))` which is a valid pattern to prevent signal re-creation on re-renders - this was NOT changed.

### 3. ~~Use of Raw HTML Elements Instead of Custom UI Components~~ **NOT VALID**

**Status:** Invalid - The raw `<input>` elements in `SplitAmountInputs.tsx` and `ShareGroupModal.tsx` require features (`inputMode`, `pattern`, `readOnly`) that the custom `Input` component does not support.

### 4. ~~Use of Inline `style` Attributes~~ **NOT VALID**

**Status:** Invalid - The identified cases are legitimate:
- `SplitBreakdown.tsx`: Dynamic percentage width for progress bar - cannot be done with Tailwind classes
- `ExpenseDetailModal.tsx`: Uses CSS variable `var(--lightbox-overlay, ...)` - this IS proper theming
- `SettlementHistory.tsx`: Dynamic theme colors for user-specific styling

### 5. ~~Other Inconsistencies~~ **FIXED**

**Fixed issues:**
- ~~**Emoji Icon:** `ExpenseDetailModal.tsx` uses a `⚠️` emoji.~~ **FIXED** - Replaced with `ExclamationTriangleIcon` from Heroicons
- ~~**Hardcoded Strings:** `ExpenseDetailModal.tsx` contains hardcoded strings within the `navigator.share` functionality.~~ **FIXED** - Added i18n keys `shareTitle` and `shareText`

---

## CSS Class Duplication - Migration Plan

New CSS utilities and components have been created to eliminate class duplication. The following files need to be updated to use them.

### New Utilities & Components Created

| Utility/Component | Location | Purpose |
|-------------------|----------|---------|
| `modal-header` | `global.css` | Modal header: `px-6 py-4 border-b border-border-default` |
| `modal-content` | `global.css` | Modal content: `px-6 py-5 max-h-[70vh] overflow-y-auto` |
| `modal-footer` | `global.css` | Modal footer: `flex justify-end gap-3 px-6 py-4 border-t` |
| `help-text` | `global.css` | Help text: `text-sm text-text-muted` |
| `help-text-xs` | `global.css` | Smaller help text: `text-xs text-text-muted` |
| `field-error` | `global.css` | Error text: `mt-2 text-sm text-semantic-error` |
| `badge` / `badge-*` | `global.css` | Badge styling with variants |
| `ModalHeader` | `Modal.tsx` | Component wrapper for modal headers |
| `ModalContent` | `Modal.tsx` | Component wrapper for modal content |
| `ModalFooter` | `Modal.tsx` | Component wrapper for modal footers |
| `HelpText` | `HelpText.tsx` | Component for help/description text |
| `FieldError` | `FieldError.tsx` | Component for form validation errors |
| `Badge` | `Badge.tsx` | Component for labels/tags/status |

---

### Priority 1: Modal Structure (7 files) - **COMPLETED**

**All modal files have been migrated to use `ModalHeader`, `ModalContent`, `ModalFooter` components:**

- ✅ `components/expense/ExpenseDetailModal.tsx`
- ✅ `components/settlements/SettlementForm.tsx` - ModalHeader + ModalContent
- ✅ `components/expense-form/ExpenseFormModal.tsx` - ModalHeader + ModalContent
- ✅ `components/group/ShareGroupModal.tsx` - ModalHeader + ModalContent
- ✅ `components/group/DeleteGroupConfirmationModal.tsx` - ModalHeader + ModalContent + ModalFooter + replaced ⚠️ emoji with ExclamationTriangleIcon
- ✅ `components/dashboard/CreateGroupModal.tsx` - ModalHeader + ModalContent + ModalFooter
- ✅ `components/admin/UserEditorModal.tsx` - ModalHeader + ModalFooter (content kept custom due to tabs section) + fixed `class=` → `className=` for dynamic template literals

**Skipped (too custom):**
- `components/policy/PolicyAcceptanceModal.tsx` - Has complex flex layout with progress bar section between header and content, custom `flex-1` sizing, and `justify-between` footer. Would require significant restructuring.

**Test updates:**
- ✅ `__tests__/unit/vitest/components/ShareGroupModal.test.tsx` - Updated Modal mock to include `ModalHeader`, `ModalContent`, `ModalFooter` exports

---

### Priority 2: Form Error Messages (6 files) - **COMPLETED**

**All files have been migrated to use the `FieldError` component:**

- ✅ `components/ui/Input.tsx` - Replaced inline error `<p>` with `<FieldError>`
- ✅ `components/ui/FloatingInput.tsx` - Replaced inline error `<p>` with `<FieldError>`
- ✅ `components/ui/Select.tsx` - Replaced inline error `<p>` with `<FieldError>`
- ✅ `components/ui/CurrencyAmountInput.tsx` - Replaced inline error `<p>` with `<FieldError>`
- ✅ `components/ui/MultiLabelInput.tsx` - Replaced inline error `<p>` with `<FieldError>`
- ✅ `components/settlements/SettlementForm.tsx` - Replaced inline error `<p>` with `<FieldError>`

---

### Priority 3: Help Text (30 files) - **COMPLETED**

**All files have been migrated to use the `help-text` utility class:**

**Pages:**
- ✅ `pages/SettingsPage.tsx` - 6 occurrences
- ✅ `pages/TenantBrandingPage.tsx` - 5 occurrences
- ✅ `pages/NotFoundPage.tsx`
- ✅ `pages/JoinGroupPage.tsx`
- ✅ `pages/ResetPasswordPage.tsx`
- ✅ `pages/LoginPage.tsx`
- ✅ `pages/RegisterPage.tsx`

**Components:**
- ✅ `components/dashboard/EmptyGroupsState.tsx`
- ✅ `components/policy/PolicyAcceptanceModal.tsx`
- ✅ `components/dashboard/GroupCard.tsx`
- ✅ `components/dashboard/CreateGroupModal.tsx`
- ✅ `components/admin/TenantImageLibrary.tsx`
- ✅ `components/admin/UserEditorModal.tsx`
- ✅ `components/admin/TenantEditorModal.tsx`
- ✅ `components/layout/Footer.tsx`
- ✅ `components/expense-form/PayerSelector.tsx`
- ✅ `components/expense-form/SplitAmountInputs.tsx`
- ✅ `components/group/GroupActivityFeed.tsx`
- ✅ `components/group/GroupHeader.tsx`
- ✅ `components/group/settings/GroupCurrencySettings.tsx`
- ✅ `components/join-group/GroupPreview.tsx`
- ✅ `components/settlements/SettlementHistory.tsx`

**UI Components:**
- ✅ `components/ui/LoadingState.tsx`
- ✅ `components/ui/CurrencyAmountInput.tsx`
- ✅ `components/ui/LoadingSpinner.tsx`
- ✅ `components/ui/ImageUploadField.tsx`
- ✅ `components/ui/Switch.tsx`
- ✅ `components/ui/ErrorState.tsx`

**Not migrated (by design):**
- `components/ui/Typography.tsx` - Uses `text-sm text-text-muted` in `caption` variant definition (this IS the abstraction)
- `components/comments/CommentsSection.tsx` - No instances found

---

### Priority 3b: Help Text XS (additional consistency migration)

For consistency, also migrated `text-xs text-text-muted` pattern to use `help-text-xs` utility class:

- ✅ `pages/TenantBrandingPage.tsx` - 3 occurrences
- ✅ `pages/SettingsPage.tsx` - 1 occurrence
- ✅ `components/auth/FloatingPasswordInput.tsx`
- ✅ `components/expense/SplitBreakdown.tsx` - 2 occurrences
- ✅ `components/dashboard/ActivityFeedCard.tsx`
- ✅ `components/comments/CommentInput.tsx`
- ✅ `components/expense-form/ExpenseBasicFields.tsx`
- ✅ `components/group/BalanceSummary.tsx` - 2 occurrences
- ✅ `components/ui/MultiLabelInput.tsx` - 2 occurrences
- ✅ `components/group/ExpenseItem.tsx` - with opacity override
- ✅ `components/admin/forms/AdminFormSection.tsx`
- ✅ `components/admin/forms/AdminFormToggle.tsx`
- ✅ `components/group/MembersListWithManagement.tsx`
- ✅ `components/layout/UserMenu.tsx` - 2 occurrences
- ✅ `components/admin/TenantEditorModal.tsx`
- ✅ `components/admin/TenantImageLibrary.tsx`
- ✅ `components/group/GroupActivityFeed.tsx`
- ✅ `components/expense-form/SplitAmountInputs.tsx`
- ✅ `components/settlements/SettlementHistory.tsx`

**Not migrated (by design):**
- `components/ui/ColorInput.tsx` - Uses `text-xs text-text-muted font-mono` for input field styling (monospace for hex/rgba values)

---

### Priority 4: Badge/Chip Styling (5 files)

Files with inline badge/chip styling that should use `Badge` component:

| File | Current Pattern |
|------|-----------------|
| `pages/AdminTenantsPage.tsx` | Status badges with `rounded-full text-xs font-medium` |
| `components/policy/PolicyAcceptanceModal.tsx` | Policy type badge |
| `components/dashboard/GroupCard.tsx` | Group status/role badges |
| `components/expense/SplitBreakdown.tsx` | Split type indicators |
| `components/ui/MultiLabelInput.tsx` | Label tags |

**Already done:**
- ✅ `components/expense/ExpenseDetailModal.tsx` - Labels now use `<Badge>`

---

## Migration Notes

### How to migrate Modal files:

```tsx
// Before
<div className='px-6 py-4 border-b border-border-default'>
  <h2>Title</h2>
</div>
<div className='px-6 py-5 max-h-[70vh] overflow-y-auto'>
  {/* content */}
</div>
<div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default'>
  <Button>Cancel</Button>
  <Button>Submit</Button>
</div>

// After
import { ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal';

<ModalHeader>
  <h2>Title</h2>
</ModalHeader>
<ModalContent>
  {/* content */}
</ModalContent>
<ModalFooter>
  <Button>Cancel</Button>
  <Button>Submit</Button>
</ModalFooter>
```

### How to migrate error messages:

```tsx
// Before
<p className='mt-2 text-sm text-semantic-error' role='alert'>
  {error}
</p>

// After
import { FieldError } from '@/components/ui';

<FieldError>{error}</FieldError>
```

### How to migrate help text:

```tsx
// Before
<p className='text-sm text-text-muted'>Helper text</p>

// After (component)
import { HelpText } from '@/components/ui';
<HelpText>Helper text</HelpText>

// After (utility class)
<p className='help-text'>Helper text</p>

// For smaller help text (text-xs)
<p className='help-text-xs'>Smaller helper text</p>

// With opacity override
<p className='help-text-xs text-text-muted/70'>De-emphasized text</p>
```

### How to migrate badges:

```tsx
// Before
<span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-interactive-primary/10 text-interactive-primary border border-interactive-primary/20'>
  Label
</span>

// After
import { Badge } from '@/components/ui';
<Badge variant='primary'>Label</Badge>
```

---

## Summary

| Category | Files to Update | Priority | Status |
|----------|-----------------|----------|--------|
| Modal structure | 7 | High | ✅ **DONE** (6 migrated, 1 skipped, tests updated) |
| Form errors | 6 | High | ✅ **DONE** (6 migrated) |
| Help text | 30 | Medium | ✅ **DONE** (28 migrated, 2 not applicable) |
| Help text XS | 19 | Medium | ✅ **DONE** (19 migrated, 1 not applicable) |
| Badges | 5 | Medium | Pending |
| **Total** | **67** | | |

Priorities 1-3 (including 3b) complete. All builds pass. Next priority is Badges (Priority 4).
