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
| `field-error` | `global.css` | Error text: `mt-2 text-sm text-semantic-error` |
| `badge` / `badge-*` | `global.css` | Badge styling with variants |
| `ModalHeader` | `Modal.tsx` | Component wrapper for modal headers |
| `ModalContent` | `Modal.tsx` | Component wrapper for modal content |
| `ModalFooter` | `Modal.tsx` | Component wrapper for modal footers |
| `HelpText` | `HelpText.tsx` | Component for help/description text |
| `FieldError` | `FieldError.tsx` | Component for form validation errors |
| `Badge` | `Badge.tsx` | Component for labels/tags/status |

---

### Priority 1: Modal Structure (7 files)

Files using manual modal header/content/footer classes that should use `ModalHeader`, `ModalContent`, `ModalFooter`:

| File | Changes Needed |
|------|----------------|
| `components/settlements/SettlementForm.tsx` | Replace header (L405), content (L427), footer divs |
| `components/expense-form/ExpenseFormModal.tsx` | Replace header (L81), content (L104), footer divs |
| `components/group/ShareGroupModal.tsx` | Replace header (L172), content, footer divs |
| `components/group/DeleteGroupConfirmationModal.tsx` | Replace header (L37), content, footer divs |
| `components/dashboard/CreateGroupModal.tsx` | Replace header, content, footer divs |
| `components/policy/PolicyAcceptanceModal.tsx` | Replace header, content, footer divs |
| `components/admin/UserEditorModal.tsx` | Replace header, content, footer divs |

**Already done:**
- ✅ `components/expense/ExpenseDetailModal.tsx`

---

### Priority 2: Form Error Messages (6 files)

Files with inline error styling that should use `FieldError` component:

| File | Line | Current Pattern |
|------|------|-----------------|
| `components/ui/Input.tsx` | 99 | `<p className='mt-2 text-sm text-semantic-error'>` |
| `components/ui/FloatingInput.tsx` | 133 | `<p className='mt-2 text-sm text-semantic-error'>` |
| `components/ui/Select.tsx` | 118 | `<p className='mt-2 text-sm text-semantic-error'>` |
| `components/ui/CurrencyAmountInput.tsx` | 309 | `<p className='mt-2 text-sm text-semantic-error'>` |
| `components/ui/MultiLabelInput.tsx` | 257 | `<p className='mt-2 text-sm text-semantic-error'>` |
| `components/settlements/SettlementForm.tsx` | 555 | `<p className='mt-2 text-sm text-semantic-error'>` |

---

### Priority 3: Help Text (30 files)

Files with `text-sm text-text-muted` that could use `HelpText` component or `help-text` utility:

**High-frequency files (3+ occurrences):**
- `pages/SettingsPage.tsx` - 4 occurrences
- `pages/TenantBrandingPage.tsx` - 3 occurrences
- `components/dashboard/EmptyGroupsState.tsx` - 3 occurrences

**Other files:**
- `pages/NotFoundPage.tsx`
- `pages/JoinGroupPage.tsx`
- `pages/ResetPasswordPage.tsx`
- `pages/LoginPage.tsx`
- `pages/RegisterPage.tsx`
- `components/policy/PolicyAcceptanceModal.tsx`
- `components/dashboard/GroupCard.tsx`
- `components/dashboard/CreateGroupModal.tsx`
- `components/admin/TenantImageLibrary.tsx`
- `components/admin/UserEditorModal.tsx`
- `components/admin/TenantEditorModal.tsx`
- `components/layout/Footer.tsx`
- `components/expense-form/PayerSelector.tsx`
- `components/expense-form/SplitAmountInputs.tsx`
- `components/group/GroupActivityFeed.tsx`
- `components/group/GroupHeader.tsx`
- `components/group/settings/GroupCurrencySettings.tsx`
- `components/join-group/GroupPreview.tsx`
- `components/ui/LoadingState.tsx`
- `components/ui/CurrencyAmountInput.tsx`
- `components/ui/LoadingSpinner.tsx`
- `components/ui/ImageUploadField.tsx`
- `components/ui/Switch.tsx`
- `components/ui/Typography.tsx`
- `components/ui/ErrorState.tsx`
- `components/settlements/SettlementHistory.tsx`
- `components/comments/CommentsSection.tsx`

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

| Category | Files to Update | Priority |
|----------|-----------------|----------|
| Modal structure | 7 | High |
| Form errors | 6 | High |
| Help text | 30 | Medium |
| Badges | 5 | Medium |
| **Total** | **48** | |

The migration can be done incrementally. Start with Priority 1 (modals) as they have the highest impact and clearest patterns.
