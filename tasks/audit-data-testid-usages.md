# Audit: data-testid Usage in webapp-v2

**Status:** ✅ Complete

## Summary

Audited `data-testid` attributes in webapp-v2 and converted ~163 unnecessary test-ids to semantic selectors across 11 phases. Reduced production code test-ids from ~56 to ~12. Updated documentation to prevent future misuse.

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

### Phase 7: Dynamic Loop IDs Conversion (8 test-ids)

Converted dynamic loop IDs to semantic selectors using aria-labels and visible text.

**Category 1: Buttons with aria-labels (6 items)**
- `edit-user-${uid}` - AdminUsersTab.tsx → `aria-label={t('admin.users.actions.editUser')}`, target by row content + button name
- `pending-approve-${member.uid}` - PendingMembersSection.tsx → `aria-label` includes member display name
- `pending-reject-${member.uid}` - PendingMembersSection.tsx → `aria-label` includes member display name
- `remove-domain-${index}` - TenantEditorModal.tsx → `aria-label={`Remove ${domain}`}`, target by domain name
- `remove-currency-${code}` - CreateGroupModal.tsx, GroupCurrencySettings.tsx → already had `aria-label`
- `add-currency-option-${currency.acronym}` - CreateGroupModal.tsx, GroupCurrencySettings.tsx → visible text (currency code)

**Category 2: Selects with aria-labels (2 items)**
- `member-role-select-${member.uid}` - MemberRolesSection.tsx → `aria-label` includes member display name
- `permission-select-${key}` - CustomPermissionsSection.tsx → select inside label with translated text

**Category 3: Buttons with visible text (2 items)**
- `preset-button-${preset}` - PermissionPresetsSection.tsx → button has visible label text
- `admin-tab-${tab.id}` - AdminPage.tsx → button has visible tab name

**Documentation Added:**
- `webapp-and-style-guide.md`: New "Test Selectors" section with patterns for icon-only buttons, list items, and selects inside labels

### Phase 8: Container & Indicator Cleanup (5 test-ids)

Converted remaining form containers and unused indicator test-ids.

**Category 1: Form containers to semantic regions/scoping (4 items)**
- `exact-split-container` - SplitAmountInputs.tsx → visible text scoping ("Enter exact amounts")
- `percentage-split-container` - SplitAmountInputs.tsx → visible text scoping ("Enter percentages")
- `equal-split-container` - SplitAmountInputs.tsx → visible text scoping ("each person pays")
- `members-container` - MembersListWithManagement.tsx → `role="region"` with `aria-label="Members"`

**Category 2: Unused test-ids removed (1 item)**
- `character-count` / `character-limit-exceeded` - CommentInput.tsx → removed (visible text is sufficient)

**Page Objects Updated:**
- `ExpenseFormPage.ts` - Updated split container selectors to use visible text scoping
- `GroupDetailPage.ts` - Updated members container to use `getByRole('region', { name: 'Members' })`

### Page Objects Updated

- `TenantEditorModalPage.ts` (Phase 7: removeDomain now uses aria-label)
- `AdminTenantsPage.ts`
- `AdminUsersPage.ts` (Phase 7: row-based targeting by email)
- `ExpenseFormPage.ts`
- `HeaderPage.ts`
- `error-proxy.ts`
- `TenantBrandingPage.ts`
- `CreateGroupModalPage.ts`
- `GroupSettingsModalPage.ts` (Phase 7: permission selects, pending member buttons, role selects, preset buttons)
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

**Updated:** December 2024 (Phase 11)

**Current count:** ~12 `dataTestId` occurrences in production code. Most are UI component pass-through props that are optionally used by consumers.

---

### Category 1: Production Code Test-ids (12 occurrences)

| File | Test-ids | Purpose | Notes |
|------|----------|---------|-------|
| `TenantBrandingPage.tsx` | 3 | Color inputs + checkbox | Used by vitest unit tests |
| `TenantEditorModal.tsx` | 2 | `logo-upload-field`, `favicon-upload-field` | Used by TenantEditorModalPage.ts |
| `ActivityFeedCard.tsx` | 1 | Activity feed section | Used by vitest unit test |
| `Input.tsx` | 1 | FieldError test-id | Standard pattern |
| `Select.tsx` | 1 | FieldError test-id | Standard pattern |
| `FloatingInput.tsx` | 1 | FieldError test-id | Standard pattern |
| `ConfirmDialog.tsx` | 1 | Pass-through prop | Consumer-optional |
| Unit test files | 2 | Testing dataTestId prop | Test infrastructure |

### Category 2: UI Component Pass-through Props (not counted above)

These components accept an optional `dataTestId` prop but are not actively using it in production. The prop exists for consumers who need test targeting:

| Component | Notes |
|-----------|-------|
| `Button.tsx` | Optional prop for button element |
| `Card.tsx` | Optional prop for container div |
| `Switch.tsx` | Optional prop for switch input |
| `Checkbox.tsx` | Optional prop for checkbox input |
| `Modal.tsx` | Optional prop for modal container |
| `Alert.tsx` | Optional prop for alert container |
| `Typography.tsx` | Optional prop for text element |
| `Clickable.tsx` | Optional prop for clickable element |
| `LoadingSpinner.tsx` | Optional prop for spinner span |
| `ColorInput.tsx` | Optional prop for color inputs |
| `ImageUploadField.tsx` | Optional prop for upload fields |
| `AdminFormInput.tsx` | Optional prop for input wrapper |
| `AdminFormSection.tsx` | Optional prop for section wrapper |
| `AdminFormToggle.tsx` | Optional prop for toggle wrapper |

---

### Assessment

**Remaining test-ids are intentional:**
1. **Vitest unit tests** - TenantBrandingPage, ActivityFeedCard tests use test-ids
2. **Page object targeting** - TenantEditorModalPage needs upload field test-ids
3. **FieldError pattern** - Standard pattern for form validation error targeting
4. **Pass-through props** - UI components optionally support test-ids for consumers

**To fully eliminate remaining test-ids**, the corresponding vitest unit tests would need to be updated to use semantic selectors like `getByRole('alert')` instead of `getByTestId()`.

---

### Phase 9: Page Object Selector Conversions (21 selectors)

Converted all remaining page object selectors to semantic alternatives.

**SettingsPage.ts (10 selectors)**
- `display-name-input` → `getByLabel(translation.settingsPage.displayNameLabel)`
- `save-changes-button` → `getByRole('button', { name: translation.settingsPage.saveChangesButton })` scoped to profile section
- `change-password-button` → `getByRole('button', { name: translation.settingsPage.changePasswordButton })`
- `current-password-input` → `getByLabel(translation.settingsPage.currentPasswordLabel)`
- `new-password-input` → `getByLabel(translation.settingsPage.newPasswordLabel)`
- `confirm-password-input` → `getByLabel(translation.settingsPage.confirmNewPasswordLabel)`
- `update-password-button` → `getByRole('button', { name: translation.settingsPage.updatePasswordButton })`
- `cancel-password-button` → `getByRole('button', { name: translation.settingsPage.cancelButton })` scoped to password section
- `profile-information-section` → Section scoping by heading: `locator('section, div').filter({ has: getByRole('heading', { name: profileInformationHeader }) })`
- `password-section` → Section scoping by heading: `locator('section, div').filter({ has: getByRole('heading', { name: passwordHeader }) })`

**TenantBrandingPage.ts (5 selectors)**
- `logo-url-input` → `getByLabel(translation.tenantBranding.fields.logoUrl)`
- `favicon-url-input` → `getByLabel(translation.tenantBranding.fields.faviconUrl)`
- `primary-color-input` → `getByLabel(translation.tenantBranding.fields.primaryColor)`
- `secondary-color-input` → `getByLabel(translation.tenantBranding.fields.secondaryColor)`
- `save-branding-button` → `getByRole('button', { name: translation.tenantBranding.actions.saveChanges })`

**AdminTenantsPage.ts (3 selectors)**
- `edit-tenant-*` → Added `aria-label` to Edit button in AdminTenantsTab.tsx: `aria-label={Edit ${appName}}`
- `clickEditButtonForFirstTenant` → `getByRole('button', { name: /^Edit\s/ }).first()`
- `clickEditButtonForTenant(appName)` → `getByRole('button', { name: Edit ${appName} })`
- Removed unused `clickEditButtonForTenantById` method

**GroupDetailPage.ts (2 selectors)**
- `include-deleted-settlements-checkbox` → `getByRole('checkbox', { name: translation.common.includeDeleted })`
- `remove-member-button` → Added interpolation to translation `removeMemberAriaLabel`: "Remove {{name}}", then `getByRole('button', { name: /Remove.*${memberName}/i })`

**DashboardPage.ts (1 selector)**
- `group-card` → Added `role='listitem'` to wrapper in GroupsList.tsx, then `getByRole('listitem')`

**Other (3 selectors)**
- `AdminPage.ts` `button[data-testid*="admin"]` → `getByRole('navigation', { name: ... }).getByRole('button').first()`
- `RegisterPage.ts` `loading-spinner` → `locator('button[type="submit"]').getByRole('status')`
- `TenantEditorModalPage.ts` `custom-css-input` → Deprecated (feature removed), left as-is

**Component/Translation Updates:**
- `AdminTenantsTab.tsx` - Added aria-label to Edit button
- `GroupsList.tsx` - Added `role='listitem'` to group card wrapper
- `SettingsPage.tsx` - Removed `dataTestId='profile-information-section'` and `dataTestId='password-section'` (scoping now by heading)
- `translation.json` (en, ar) - Updated `removeMemberAriaLabel` to include `{{name}}` interpolation

---

### Historical Conversions (Phases 1-8)

Converted ~111 test-ids to semantic selectors. Key patterns converted:

- **Buttons with visible text** → `getByRole('button', { name })`
- **Elements with role='alert'** → `getByRole('alert')`
- **Form inputs with labels** → `getByLabel()` or `getByPlaceholder()`
- **Checkboxes/switches** → `getByRole('checkbox/switch', { name })`
- **Dynamic loop IDs** → `aria-label` with entity name
- **Form containers** → visible text scoping or `role="region"`
- **List items** → `<article>`, `<li>` with `data-member-name` etc.
- **Sections** → `aria-labelledby` with heading id

---

### Phase 10: Final Page Object & Component Cleanup (13 conversions)

Converted remaining page object selectors and removed corresponding test-ids from components.

**Page Object Conversions:**

| Page Object | Selectors Converted | Now Uses |
|-------------|---------------------|----------|
| `ExpenseDetailPage.ts` | `expense-error-card`, `expense-header` | `getByRole('dialog').locator('.text-semantic-error')`, `locator('#expense-detail-modal-title').locator('..')` |
| `ExpenseFormPage.ts` | `label-input-error-message`, `currency-input-error-message` | `getByRole('alert').filter({ hasText })` |
| `ShareGroupModalPage.ts` | `share-link-expiration-${value}` | `getByRole('button', { name: translatedLabel })` |
| `AdminDiagnosticsPage.ts` | `tenant-overview-card`, `theme-artifact-card`, `branding-tokens-card`, `computed-vars-card`, `copy-theme-link-button`, `force-reload-theme-button` | Heading-based scoping + `getByRole('button', { name })` |
| `AdminTenantsPage.ts` | `tenant-card` | Heading-based scoping by h3 |

**Component Test-ids Removed:**

| Component | Test-ids Removed |
|-----------|------------------|
| `ShareGroupModal.tsx` | `share-link-expiration-${option.id}` |
| `AdminTenantsTab.tsx` | `tenant-card`, `create-tenant-button` |
| `CurrencyAmountInput.tsx` | `currency-input-error-message` |
| `MultiLabelInput.tsx` | `label-input-error-message` |
| `AdminDiagnosticsTab.tsx` | `env-status-card`, `env-build-card`, `env-memory-card`, `env-heap-spaces-card`, `env-variables-card`, `env-filesystem-card` (unused) |

**Test File Updated:**

- `admin-tenant-config.test.ts` - Updated to use heading-based scoping instead of non-existent test-ids

---

### Phase 11: Component dataTestId Prop Cleanup (~29 test-ids)

Removed dataTestId props and usages from components where semantic selectors are sufficient.

**Components Updated:**

| Component | Test-ids Removed | Now Uses |
|-----------|------------------|----------|
| `MembersListWithManagement.tsx` | `remove-member-button`, `invite-members-button`, `toggle-members-section`, `remove-member-dialog` | `aria-label` on buttons, `ConfirmDialog` with title |
| `SidebarCard.tsx` | `collapseToggleTestId` prop removed | `aria-label={collapseToggleLabel}` |
| `SettlementHistory.tsx` | `settlements-empty-state`, `show-all-settlements-checkbox`, `include-deleted-settlements-checkbox` | `EmptyState` title, `getByRole('checkbox', { name })` |
| `CommentsList.tsx` | `comments-error`, `comments-empty-state` | `role='alert'`, `EmptyState` title |
| `GroupCurrencySettings.tsx` | `default-currency-select`, `currency-settings-error` | `getByLabel()`, `getByRole('alert')` |
| `ExpenseFormModal.tsx` | `expense-form-cancel`, `save-expense-button` | `getByRole('button', { name })` with translated text |
| `ExpenseFormHeader.tsx` | `expense-form-cancel` | `getByRole('button', { name })` with translated text |
| `UserEditorModal.tsx` | `user-editor-modal`, `cancel-button`, `save-profile-button`, `save-role-button` | `labelledBy='user-editor-modal-title'` + `id` on h2, button names |
| `TenantEditorModal.tsx` | 6 button test-ids | `getByRole('button', { name })` (kept 2 for page objects: `logo-upload-field`, `favicon-upload-field`) |
| `GroupCard.tsx` | `group-card` | Already has `role='listitem'` wrapper |
| `EmptyState.tsx` | `empty-state-action-button`, `empty-state-secondary-action-button` | `getByRole('button', { name: action.label })` |

**Test File Fixed:**

- `ShareGroupModal.test.tsx` - Updated to use `getByRole('button', { name })` instead of removed `share-link-expiration-${id}` test-ids
