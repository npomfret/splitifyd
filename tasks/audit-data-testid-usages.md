# Audit: data-testid Usage in webapp-v2

**Status:** ✅ Complete

## Summary

Audited `data-testid` attributes in webapp-v2 and converted ~96 unnecessary test-ids to semantic selectors across 6 phases. Updated documentation to prevent future misuse.

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

### Phase 4: Final Cleanup (10 test-ids)

**Category 1: Radio buttons with labels (2 items)**
- `creation-mode-empty`, `creation-mode-copy` - TenantEditorModal.tsx → `getByRole('radio', { name })`

**Category 2: Select with aria-label (1 item)**
- `source-tenant-select` - TenantEditorModal.tsx → added `aria-label`, use `getByRole('combobox')`

**Category 3: Slider with aria-label (1 item)**
- `intensity-slider` - PaletteColorsSection.tsx → added `aria-label`, use `getByRole('slider')`

**Category 4: Buttons with visible text (dynamic loop - 2 items)**
- `theme-mode-${mode}` - PaletteColorsSection.tsx → buttons have visible text + `role="radio"`
- `style-${value}` - PaletteColorsSection.tsx → buttons have visible text

**Category 5: Elements with visible text (3 items)**
- `loading-message` - LoadingState.tsx → use `getByText()`
- `deleted-badge` - ExpenseItem.tsx → use `getByText()`
- `group-activity-feed-empty` - GroupActivityFeed.tsx → use `getByText()`

**Category 6: Warning with role=alert (1 item)**
- `expense-lock-warning` - ExpenseDetailModal.tsx → added `role="alert"`, use `getByRole('alert')`

### Phase 5: Policy Modal & Misc Cleanup (18 test-ids)

**Category 1: Modal with dialog role (2 items)**
- `expense-form` - ExpenseFormModal.tsx → already has `role='form'`
- `confirmation-dialog` - ConfirmDialog.tsx → inside Modal with `role='dialog'`

**Category 2: Elements with visible text (4 items)**
- `profile-display-name`, `profile-email` - SettingsPage.tsx → visible text
- `group-description`, `group-stats` - GroupHeader.tsx → visible text

**Category 3: Sections with aria-labelledby (1 item)**
- `group-display-name-settings` (x2) - GroupIdentityTabContent.tsx → added `aria-labelledby` + heading `id`

**Category 4: Empty state with visible title (1 item)**
- `empty-groups-state` - EmptyGroupsState.tsx → use EmptyState title via `getByRole('heading')`

**Category 5: Policy modal structure (12 items)**
- `policy-modal-overlay`, `policy-modal-card`, `policy-modal-header` - use `getByRole('dialog')`
- `policy-progress`, `policy-progress-summary`, `policy-progress-indicator` - use `getByRole('progressbar')`
- `policy-content-loading` - use `getByRole('status', { name: translation.loading })`
- `policy-content` - use class-based locator `.bg-surface-muted.rounded-lg`
- `policy-acceptance-section` - use class-based locator `.bg-semantic-info-subtle`
- `policy-modal-footer`, `policy-acceptance-count`, `policy-acceptance-loading` - parent scoping

**PolicyAcceptanceModalPage.ts major refactor:**
- Uses `getByRole('dialog')` for modal container
- Uses `getByRole('status', { name })` with translations for loading/badge states
- Uses class selectors for structural elements without semantic alternatives

### Phase 6: Semantic Elements & Aria Labels (18 test-ids)

**Category 1: Elements that should be semantic HTML (6 items)**
- `expense-item` - ExpenseItem.tsx → `<article aria-label={expense.description}>`
- `settlement-item` - SettlementHistory.tsx → `<article>` (scoped by `#settlement-history`)
- `member-item` - MembersListWithManagement.tsx → `<li>` with `data-member-name` for targeting
- `debt-item` - BalanceSummary.tsx → `<article>`
- `comment-item` - CommentItem.tsx → `<article aria-label="author: preview">`
- `activity-feed-item` - GroupActivityFeed.tsx → `<li>` within `<nav aria-label>`

**Category 2: Display values replaced with heading scoping (3 items)**
- `expense-amount` - ExpenseItem.tsx, ExpenseDetailModal.tsx → `<h2>` in dialog
- `error-container` - GroupDetailPage.tsx → `role='alert'`
- `split-amount` - SplitBreakdown.tsx → visible text in span

**Category 3: Containers with aria-labelledby (5 items)**
- `groups-container` - DashboardPage.tsx → `<section aria-labelledby="groups-section-heading">`
- `groups-grid` - GroupsList.tsx → `role='list' aria-label={t('groupsListAriaLabel')}`
- `activity-feed-card` - ActivityFeedCard.tsx → `<section aria-labelledby="activity-feed-heading">`
- `group-activity-feed` - GroupActivityFeed.tsx → `<nav aria-label={t('activityFeed.title')}>`
- `group-activity-feed-item` - GroupActivityFeed.tsx → `<li>` within nav

**Translation added:**
- `dashboardComponents.groupsList.groupsListAriaLabel`: "Your groups"

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
- `ExpenseDetailPage.ts`
- `PolicyAcceptanceModalPage.ts` (major refactor - all selectors now semantic)
- `GroupDetailPage.ts` - Updated selectors for article/li/nav elements
- `DashboardPage.ts` - Updated selectors for section/list elements

### Documentation Added

- **testing.md**: Expanded "Selector Priority" section with guidance on when `data-testid` is/isn't appropriate
- **webapp-and-style-guide.md**: Added anti-pattern entry as a reminder

### Documentation Cleanup

- **webapp-and-style-guide.md**: Removed stale "Document Correctness and Code-to-Guide Discrepancies" section (review notes that were incorrectly committed)

## Remaining Test-ids

50 `data-testid=` occurrences remain across 38 files. Breakdown:

### UI Component Pass-through Props (~17 components)

These accept an optional `dataTestId`/`testId` prop and render it:
- `Input.tsx`, `FloatingInput.tsx`, `Button.tsx`, `Card.tsx`, `Select.tsx`, `Switch.tsx`
- `Checkbox.tsx`, `Modal.tsx`, `Alert.tsx`, `Typography.tsx`, `FieldError.tsx`, `Clickable.tsx`
- `EmptyState.tsx`, `LoadingSpinner.tsx`, `ColorInput.tsx`, `ImageUploadField.tsx`, `SidebarCard.tsx`
- Admin forms: `AdminFormInput.tsx`, `AdminFormSection.tsx`, `AdminFormToggle.tsx`

### Dynamic Loop IDs (~9 patterns)

IDs generated in loops requiring unique identifiers:
- `admin-tab-${tab.id}` - AdminPage.tsx
- `remove-currency-${code}` - CreateGroupModal.tsx, GroupCurrencySettings.tsx
- `add-currency-option-${currency.acronym}` - CreateGroupModal.tsx, GroupCurrencySettings.tsx
- `edit-user-${uid}` - AdminUsersTab.tsx
- `remove-domain-${index}` - TenantEditorModal.tsx
- `permission-select-${key}` - CustomPermissionsSection.tsx
- `member-role-select-${member.uid}` - MemberRolesSection.tsx
- `password-strength-${strength}` - FloatingPasswordInput.tsx

### Static Test-ids (~16 occurrences)

| Test-id | Files | Notes |
|---------|-------|-------|
| `required-indicator` | Input, FloatingInput, Select, CurrencyAmountInput, TimeInput, FloatingPasswordInput, PayerSelector, ExpenseBasicFields, ParticipantSelector | Asterisk for required fields (~10 occurrences) |
| `members-container` | MembersListWithManagement.tsx | Container div |
| `exact-split-container` | SplitAmountInputs.tsx | Split mode container |
| `percentage-split-container` | SplitAmountInputs.tsx | Split mode container |
| `equal-split-container` | SplitAmountInputs.tsx | Split mode container |
| `character-count` / `character-limit-exceeded` | CommentInput.tsx | Dynamic based on state |

### Test File Mocks (~3 occurrences)

- `base-layout` - TenantBrandingPage.test.tsx (mock)
- Modal presentation div - ShareGroupModal.test.tsx (mock)
- `qr-code` - ShareGroupModal.test.tsx (mock)

### Assessment

These are legitimate because they either:
1. **UI component props** - Allow optional test targeting without mandating it
2. **Dynamic IDs** - Loop-generated requiring unique identifiers
3. **Test mocks** - Only exist in test files
4. **Low-value conversions** - `required-indicator` and split containers provide minimal benefit to convert

Future conversions can be done incrementally when touching those components.
