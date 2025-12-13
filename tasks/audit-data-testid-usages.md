# Audit: data-testid Usage in webapp-v2

## Summary

An audit of `data-testid` attributes in the webapp-v2 codebase found **140+ usages**. Per our testing guidelines, `data-testid` should be a **last resort** - semantic selectors (roles, labels, visible text) are preferred.

This report categorizes each usage and recommends which should be converted to semantic selectors.

---

## Completed Conversions

The following test-ids have been converted to semantic selectors:

### Mode Toggle Buttons (ModeToggle.tsx)
- ✅ `mode-toggle-basic` → `getByRole('radio', { name: translation.admin.tenantEditor.modeToggle.basic })`
- ✅ `mode-toggle-advanced` → `getByRole('radio', { name: translation.admin.tenantEditor.modeToggle.advanced })`
- **Page object updated:** `TenantEditorModalPage.ts`
- **Component updated:** Removed test-ids and unused `testId` prop from `ModeToggle.tsx`

### Admin Tab Buttons (AdminPage.tsx)
- ✅ `admin-tab-tenants` → `getByRole('button', { name: translation.admin.tabs.tenants })`
- **Page object updated:** `AdminTenantsPage.ts`
- **Component:** Test-id remains (other tabs not yet converted)

### Validation Error Alerts (ExpenseForm)
- ✅ `validation-error-description` → `getByRole('alert').filter({ hasText: text })`
- ✅ `validation-error-date` → `getByRole('alert').filter({ hasText: text })`
- ✅ `validation-error-splits` → `getByRole('alert').filter({ hasText: text })`
- **Page object updated:** `ExpenseFormPage.ts`
- **Components updated:** Removed test-ids from `ExpenseBasicFields.tsx`, `ExpenseFormModal.tsx`

### Payer Selector (PayerSelector.tsx)
- ✅ `payer-selector-trigger` → `getByRole('button', { name: translation.expenseComponents.payerSelector.label })` (scoped to Who Paid section)
- ✅ `payer-selector-search` → `getByPlaceholder(translation.expenseComponents.payerSelector.searchPlaceholder)`
- ✅ `payer-option-${member.uid}` → `getByRole('option', { name: displayName })`
- **Page object updated:** `ExpenseFormPage.ts`
- **Component updated:** Removed test-ids from `PayerSelector.tsx`

### Participant Selector (ParticipantSelector.tsx)
- ✅ `validation-error-participants` → `role='alert'` (already has role, removed redundant test-id)
- ✅ `participant-selector-grid` → `getSplitBetweenSection().locator('label')` (scoped to semantic region)
- **Page object updated:** `ExpenseFormPage.ts`
- **Component updated:** Removed test-ids from `ParticipantSelector.tsx`

### User Menu (UserMenu.tsx)
- ✅ `user-menu-button` → `getByRole('button', { name: translation.navigation.userMenu.openUserMenu })`
- ✅ `user-dropdown-menu` → `getByRole('menu')`
- ✅ `user-menu-display-name` → `.locator('.text-sm.font-medium')` within button
- ✅ `user-menu-dashboard-link` → `getByRole('menuitem', { name: translation.userMenu.dashboard })`
- ✅ `user-menu-settings-link` → `getByRole('menuitem', { name: translation.userMenu.settings })`
- ✅ `user-menu-admin-link` → `getByRole('menuitem', { name: translation.userMenu.admin })`
- ✅ `sign-out-button` → `getByRole('menuitem', { name: translation.userMenu.signOut })`
- **Page objects updated:** `HeaderPage.ts`, `error-proxy.ts`
- **Component updated:** Removed all test-ids from `UserMenu.tsx`

---

## Selector Priority (from testing guide)

1. ARIA roles/labels - `getByRole('button', { name: 'Submit' })`
2. Visible text - `getByRole('heading', { name: 'Settings' })`
3. Form labels - `getByLabel('Email address')`
4. Placeholders - `getByPlaceholder('Enter amount')`
5. **Test IDs (last resort)** - only when semantic options don't exist

---

## Category 1: CONVERT - Buttons/Links with Visible Text

These have visible text and should use `getByRole()` with the button/link name.

| File | Current test-id | Recommended Selector |
|------|-----------------|---------------------|
| `AdminHeader.tsx:78` | `admin-logout-button` | `getByRole('button', { name: t('navigation.userMenu.logout') })` |
| `CommentsList.tsx:76` | `load-more-comments-button` | `getByRole('button', { name: t('comments.loadMore') })` |
| `SettlementHistory.tsx:311` | `load-more-settlements-button` | `getByRole('button', { name: 'Load more' })` |
| `ErrorState.tsx:50` | `error-retry-button` | `getByRole('button', { name: 'Retry' })` |
| `GroupSettingsModal.tsx:232` | `close-group-settings-button` | `getByRole('button', { name: 'Close' })` |
| `PaletteColorsSection.tsx:181` | `derive-colors-button` | `getByRole('button', { name: 'Derive colors' })` |

---

## Category 2: CONVERT - Elements with role='alert'

These already have `role='alert'` - the test-id is redundant.

| File | Current test-id | Recommended Selector |
|------|-----------------|---------------------|
| `AuthProvider.tsx:62` | `auth-error-heading` | `getByRole('alert')` |
| `ErrorMessage.tsx:12` | `error-message` | `getByRole('alert')` |
| `CommentInput.tsx:138` | `comment-error-message` | `getByRole('alert')` |
| `CommentsSection.tsx:57` | `comments-error-message` | `getByRole('alert')` |
| `PayerSelector.tsx:169` | `validation-error-paidBy` | `getByRole('alert')` |
| `JoinGroupPage.tsx:238` | `join-group-error-message` | `getByRole('alert')` |
| `TimeInput.tsx:197` | `time-input-error-message` | `getByRole('alert')` |
| `Checkbox.tsx:110` | `checkbox-error-message` | `getByRole('alert')` |

**Note:** If multiple alerts exist on a page, use `.filter()` or scope to a container.

---

## Category 3: CONVERT - Headings with Visible Text

| File | Current test-id | Recommended Selector |
|------|-----------------|---------------------|
| `NotFoundPage.tsx:22` | `not-found-title` | `getByRole('heading', { name: '404' })` |
| `NotFoundPage.tsx:25` | `not-found-subtitle` | `getByText(t('notFoundPage.pageNotFound'))` |
| `ErrorState.tsx:35` | `error-title` | `getByRole('heading', { name: errorTitle })` |

---

## Category 4: CONVERT - Form Inputs with Labels

| File | Current test-id | Recommended Selector |
|------|-----------------|---------------------|
| `TenantEditorModal.tsx:465` | `tenant-id-input` | `getByLabel('Tenant ID')` |
| `TenantEditorModal.tsx:476` | `app-name-input` | `getByLabel('App Name')` |
| `TenantEditorModal.tsx:508` | `new-domain-input` | `getByLabel('Domain')` or `getByPlaceholder()` |
| `JoinGroupPage.tsx:288` | `join-display-name-input` | `getByLabel('Display Name')` |
| `ShareGroupModal.tsx:231` | `share-link-input` | `getByLabel('Share Link')` |
| `GroupCurrencySettings.tsx:198` | `currency-search-input` | `getByPlaceholder('Search currencies')` |
| `CreateGroupModal.tsx:423` | `currency-search-input` | `getByPlaceholder('Search currencies')` |

---

## Category 5: KEEP - Legitimate Last-Resort Cases

These have no semantic alternative - containers, list items, or structural elements without visible identifying text.

### Container Divs (no visible text)
- `groups-container` - wrapper div
- `error-container` - wrapper div
- `expense-form` - form element (could use `getByRole('form')` if unique)
- `members-scroll-container` - scroll wrapper
- `policy-modal-*` - modal structure elements
- `groups-grid` - grid container
- `balance-debts-list` - list container

### List Items Needing Identification
- `expense-item` - individual expense in list
- `member-item` - individual member in list
- `settlement-item` - individual settlement in list
- `comment-item` - individual comment
- `activity-feed-item` - individual activity item
- `group-activity-feed-item` - individual activity item
- `debt-item` - individual debt in balance summary

### Dynamic IDs (need unique identification)
- `edit-user-${uid}` - per-user edit button
- `remove-currency-${code}` - per-currency remove button
- `add-currency-option-${currency.acronym}` - per-currency add option
- `remove-domain-${index}` - per-domain remove button
- `member-role-select-${member.uid}` - per-member role selector
- `permission-select-${key}` - per-permission selector
- `admin-tab-${tab.id}` - per-tab buttons
- `theme-mode-${themeMode}` - theme mode radio buttons
- `style-${value}` - style option buttons
- `password-strength-${strength}` - strength indicator

### Structural/State Indicators
- `balance-loading` - loading state text
- `balance-settled-up` - settled state text
- `deleted-badge` - deletion indicator
- `expense-amount` - amount display (could use aria-label)
- `split-amount` - split amount display
- `group-description` - description text
- `group-stats` - stats container
- `character-count` / `character-limit-exceeded` - input state
- `required-indicator` - asterisk for required fields
- `loading-message` - loading text

### Admin/Editor Components
- `creation-mode-empty` / `creation-mode-copy` - radio options
- `source-tenant-select` - dropdown
- `color-derivation-toggle` - toggle
- `intensity-slider` - slider input
- Various `AdminForm*` component testIds

---

## Category 6: REVIEW - Potentially Convertible

These might be convertible depending on context:

| File | Current test-id | Notes |
|------|-----------------|-------|
| `ConfirmDialog.tsx:77` | `confirmation-dialog` | Could use `getByRole('dialog')` |
| `LeaveGroupDialog.tsx:52` | `leave-group-dialog` | Could use `getByRole('alertdialog')` |
| `Modal.tsx:240` | Modal's dataTestId | Could use `getByRole('dialog', { name: title })` |
| `EmptyState.tsx:80` | `empty-state` | Has visible title, could use heading |
| `ActivityFeedCard.tsx:63` | `activity-feed-card` | Container, but could use heading inside |
| `EmptyGroupsState.tsx:24` | `empty-groups-state` | Has visible text |

---

## Recommendations

### High Priority (Clear Wins)
1. **Remove redundant test-ids on `role='alert'` elements** - 8 instances remaining
2. **Convert button test-ids to `getByRole('button', { name })`** - 6 instances remaining
3. **Convert link test-ids to `getByRole('link', { name })`** - already complete

### Medium Priority
4. **Convert labeled inputs to `getByLabel()`** - 7 instances remaining
5. **Convert headings to `getByRole('heading', { name })`** - 3 instances
6. **Add ARIA roles to menus/dialogs and use those** - 3 instances remaining

### Low Priority / Keep
7. **Keep container/list item test-ids** - these are legitimate last-resort cases
8. **Keep dynamic test-ids** - needed for unique identification in loops

---

## Implementation Notes

- Page objects will need updating when test-ids are removed
- Use translation imports (`translationEn.*.key`) for button/link names
- Some elements may need multiple alerts scoped - use `.within()` or parent locator
- Consider adding `aria-label` to some elements rather than test-ids

---

## Effort Estimate

| Category | Count | Effort |
|----------|-------|--------|
| High priority conversions | ~14 remaining | Low |
| Medium priority conversions | ~14 remaining | Medium |
| Page object updates | ~25 methods | Medium |
| **Total** | ~28 test-ids remaining to convert | Medium effort |

**Progress:** ~14 test-ids converted to semantic selectors. Approximately 20% of remaining test-ids could still be replaced.
