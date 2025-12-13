# Audit: data-testid Usage in webapp-v2

**Status:** ✅ Complete

## Summary

Audited `data-testid` attributes in webapp-v2 and converted ~50 unnecessary test-ids to semantic selectors. Updated documentation to prevent future misuse.

## What Was Done

### Phase 1: Initial Conversions (14 test-ids)

| Component | Test-ids Removed | Now Uses |
|-----------|------------------|----------|
| `ModeToggle.tsx` | `mode-toggle-basic`, `mode-toggle-advanced` | `getByRole('radio', { name })` |
| `UserMenu.tsx` | 7 test-ids (button, menu, menuitems) | `getByRole('button/menu/menuitem')` |
| `PayerSelector.tsx` | `payer-selector-trigger`, `payer-selector-search`, `payer-option-*` | `getByRole('button')`, `getByPlaceholder()`, `getByRole('option')` |
| `ParticipantSelector.tsx` | `participant-selector-grid`, `validation-error-participants` | Section scoping, `role='alert'` |
| `ExpenseBasicFields.tsx` | `validation-error-description`, `validation-error-date` | `getByRole('alert').filter()` |
| `ExpenseFormModal.tsx` | `validation-error-splits` | `getByRole('alert').filter()` |

### Phase 2: Additional Conversions (21 test-ids)

**Category 1: Buttons with visible text (6 items)**
- `load-more-settlements-button` - SettlementHistory.tsx
- `load-more-comments-button` - CommentsList.tsx
- `close-group-settings-button` - GroupSettingsModal.tsx
- `derive-colors-button` - PaletteColorsSection.tsx
- `admin-logout-button` - AdminHeader.tsx
- `error-retry-button` - ErrorState.tsx

**Category 2: Elements with role='alert' (8 items)**
- `join-group-error-message` - JoinGroupPage.tsx
- `auth-error-heading` - AuthProvider.tsx
- `comments-error-message` - CommentsSection.tsx
- `validation-error-paidBy` - PayerSelector.tsx
- `comment-error-message` - CommentInput.tsx
- `checkbox-error-message` - Checkbox.tsx
- `time-input-error-message` - TimeInput.tsx
- `error-message` - ErrorMessage.tsx

**Category 3: Headings/text with visible content (4 items)**
- `not-found-title`, `not-found-subtitle`, `not-found-description`, `error-container` - NotFoundPage.tsx
- `error-title`, `error-message` - ErrorState.tsx

**Category 4: Form inputs with labels (7 items)**
- `tenant-id-input`, `app-name-input`, `new-domain-input` - TenantEditorModal.tsx
- `join-display-name-input` - JoinGroupPage.tsx
- `app-name-input` - TenantBrandingPage.tsx (page object uses `getByLabel()`)
- `currency-search-input` - CreateGroupModal.tsx, GroupCurrencySettings.tsx (page objects use `getByPlaceholder()`)
- `share-link-input` - ShareGroupModal.tsx (page object uses `getByRole('textbox')`)

### Phase 3: Deep Audit Conversions (15 test-ids)

**Category 1: Checkboxes/switches with labels (6 items)**
- `show-marketing-content-checkbox` - TenantBrandingPage.tsx, MarketingSection.tsx → `getByRole('checkbox', { name })`
- `show-pricing-page-checkbox` - TenantBrandingPage.tsx, MarketingSection.tsx → `getByRole('checkbox', { name })`
- `currency-restrictions-toggle` - CreateGroupModal.tsx, GroupCurrencySettings.tsx → `getByRole('switch', { name })`
- `color-derivation-toggle` - PaletteColorsSection.tsx → visible button text

**Category 2: Buttons with aria-label (2 items)**
- `edit-settlement-button` - SettlementHistory.tsx → has `aria-label` for targeting
- `delete-settlement-button` - SettlementHistory.tsx → has `aria-label` for targeting

**Category 3: Text elements with visible content (5 items)**
- `balance-loading`, `balance-settled-up`, `balance-debts-list` - BalanceSummary.tsx → visible text
- `share-group-name` - ShareGroupModal.tsx → `getByText(groupName)`
- `share-link-expiration-hint` - ShareGroupModal.tsx → `getByText(/Expires at/i)`

**Category 4: Unused containers/forms (3 items)**
- `email-form`, `password-form` - SettingsPage.tsx → unused, removed
- `leave-group-dialog` - LeaveGroupDialog.tsx, MembersListWithManagement.tsx → unused, removed

### Page Objects Updated

- `TenantEditorModalPage.ts`
- `AdminTenantsPage.ts`
- `ExpenseFormPage.ts`
- `HeaderPage.ts`
- `error-proxy.ts`
- `TenantBrandingPage.ts`
- `CreateGroupModalPage.ts`
- `GroupSettingsModalPage.ts`
- `ShareGroupModalPage.ts`

### Documentation Added

- **testing.md**: Expanded "Selector Priority" section with guidance on when `data-testid` is/isn't appropriate
- **webapp-and-style-guide.md**: Added anti-pattern entry as a reminder

### Documentation Cleanup

- **webapp-and-style-guide.md**: Removed stale "Document Correctness and Code-to-Guide Discrepancies" section (review notes that were incorrectly committed)

## Remaining Test-ids

~65 test-ids remain in the codebase. These are legitimate last-resort cases:

- **Container divs** without visible text (wrappers, grids, scroll containers)
- **List items** needing unique identification (`expense-item`, `member-item`, `settlement-item`, `comment-item`)
- **Dynamic IDs** in loops (`remove-currency-${code}`, `admin-tab-${id}`, `share-link-expiration-${id}`)
- **UI component props** - `dataTestId` passed through for optional test targeting
- **Profile data elements** (`profile-display-name`, `profile-email`) - dynamic content without semantic roles
- **Group header elements** (`group-description`, `group-stats`) - dynamic content in layout

These are considered legitimate because they either:
1. Have no semantic alternative (containers, structural elements)
2. Are dynamic/loop-generated requiring unique identifiers
3. Display dynamic data without ARIA labels or semantic meaning

Future conversions can be done incrementally when touching those components.
