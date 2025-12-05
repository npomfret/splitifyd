# Playwright `getByTestId` Usage Audit

## 1. Executive Summary

This audit reviewed the usage of `getByTestId` across 26 Page Object Model (POM) files and found **187 occurrences**. The project's testing guide (`docs/guides/testing.md`) explicitly states that `getByTestId` should be a **last resort**.

The audit reveals a widespread over-reliance on `data-testid` attributes for selecting elements that could and should be selected by more semantic, user-facing attributes like ARIA roles, labels, or visible text. This practice couples tests to implementation details rather than user-visible behavior, making them more brittle and less meaningful.

**Finding:** A significant majority of `getByTestId` uses can be refactored to use more semantic and resilient selectors, improving test quality and adherence to project standards.

## 2. Why This Matters: The Value of Semantic Selectors

- **Resilience:** Tests that use roles and text (`getByRole('button', { name: 'Save' })`) are resilient to DOM structure changes. A `div` can become a `button`, or classes can change, and the test will still pass.
- **Readability:** Semantic queries make tests easier to understand. `await loginPage.getSubmitButton().click()` is clearer than `await loginPage.getByTestId('login-submit-btn').click()`.
- **Accessibility:** Writing tests with ARIA roles and labels forces developers to build a more accessible application from the ground up. If an element is hard to select without a `testid`, it's often a sign of poor accessibility.
- **User-Centric Testing:** Good tests should interact with the application in the same way a user does. Users don't see `data-testid`s; they see buttons, labels, and headings.

## 3. High-Priority Refactoring Patterns

The following patterns of `getByTestId` misuse are the most common and should be prioritized for refactoring.

| Anti-Pattern |
| --- | --- |
| **Selecting Buttons** |
| **Selecting Inputs** |
| **Selecting Links** |
| **Selecting Checkboxes** |
| **Selecting Tabs** |
| **Selecting Modals/Dialogs** |
| **Selecting Nav Menus**|

| Example |
| --- | --- |
| `getByTestId('save-profile-button')` |
| `getByTestId('display-name-input')` |
| `getByTestId('footer-terms-link')` |
| `getByTestId('remember-me-checkbox')` |
| `getByTestId('profile-tab')` |
| `getByTestId('user-editor-modal')` |
| `getByTestId('user-menu-button')`|

| Recommended Alternative |
| --- | --- |
| `getByRole('button', { name: 'Save Profile' })` |
| `getByLabelText('Display Name')` |
| `getByRole('link', { name: 'Terms' })` |
| `getByLabelText('Remember me')` |
| `getByRole('tab', { name: 'Profile' })` |
| `getByRole('dialog')`. Use `aria-label` or `aria-labelledby` for multiple dialogs. |
| `getByRole('button', { name: 'Open user menu' })`|

## 4. Detailed File-by-File Analysis

### `UserEditorModalPage.ts` ~~(7 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **TSX changes (UserEditorModal.tsx):**
    - Added `role="tablist"` to nav element
    - Added `role="tab"` and `aria-selected` to tab buttons
    - Added `id` to inputs and `htmlFor` to labels for proper label association
    - Removed `data-testid` from tabs and inputs (no longer needed)
- **Page object changes:**
    - `getModal()` → `getByRole('dialog')`
    - `getProfileTab()` → `getByRole('tab', { name: 'Profile' })`
    - `getRoleTab()` → `getByRole('tab', { name: 'Role' })`
    - `getDisplayNameInput()` → `getByLabel('Display Name')`
    - `getEmailInput()` → `getByLabel('Email Address')`
    - `getSaveProfileButton()` → `getByRole('button', { name: 'Save' })` (scoped to modal)
    - `getCancelButton()` → `getByRole('button', { name: /cancel|close/i })`
    - `verifyProfileTabIsActive()` now uses `aria-selected` instead of CSS class

### `HeaderPage.ts` ~~(3 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **Changes made:**
    - `getDashboardLink()` → `getByRole('menuitem', { name: 'Dashboard' })`
    - `getAdminLink()` → `getByRole('menuitem', { name: 'Admin' })`
    - Added `getSettingsLink()` → `getByRole('menuitem', { name: 'Settings' })`
    - Added `getSignOutButton()` → `getByRole('menuitem', { name: /sign out/i })`
- **Kept as test-id (justified):**
    - `getUserMenuButton()` - button displays dynamic user name/email
    - `getUserDropdownMenu()` - menu container for scoping child queries

### `LoginPage.ts` / `RegisterPage.ts` ~~(6 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **LoginPage.ts changes:**
    - `getRememberMeCheckbox()` → `getByLabel('Remember me')`
    - `getSignUpButton()` → `getByRole('button', { name: 'Sign up' })`
    - `getHeaderLogoLink()` kept as test-id (non-semantic span element)
- **RegisterPage.ts changes:**
    - `getTermsCheckbox()` → `getByLabel(/Terms of Service/i)`
    - `getCookiesCheckbox()` → `getByLabel(/Cookie Policy/i)`
    - `getPrivacyCheckbox()` → `getByLabel(/Privacy Policy/i)`
- **TSX changes:**
    - Removed `data-testid` from checkboxes and sign-up button (labels already exist)

### `FooterComponent.ts` ~~(4 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **Page object changes:**
    - `getTermsLink()` → `getByRole('button', { name: /terms of service/i })`
    - `getPrivacyLink()` → `getByRole('button', { name: /privacy policy/i })`
    - `getCookiesLink()` → `getByRole('button', { name: /cookie policy/i })`
    - `getPricingLink()` → `getByRole('button', { name: /pricing/i })`
- **TSX changes:**
    - Removed `data-testid` from all footer Clickable elements (aria-labels exist)

### `GroupSettingsModalPage.ts` ~~(24 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **TSX changes (GroupSettingsModal.tsx):**
    - Added `role="tablist"` to tab nav element
    - Added `role="tab"` and `aria-selected` to tab buttons
    - Added `id`/`htmlFor` for label associations on inputs
    - Added `aria-label` to status banners for differentiation
    - Removed `data-testid` from tabs, inputs, and status elements
- **Page object changes:**
    - `getTabButton()` → `getByRole('tab', { name: translation.groupSettingsModal.tabs[tab] })`
    - `getGroupNameInput()` → `getByLabel(translation.editGroupModal.groupNameLabel)`
    - `getGroupDescriptionInput()` → `getByLabel(translation.editGroupModal.descriptionLabel)`
    - `getDisplayNameInput()` → `getByLabel(translation.groupDisplayNameSettings.inputLabel)`
    - `getDisplayNameSaveButton()` → `getDisplayNameSection().getByRole('button', { name: 'Save' })`
    - `getDisplayNameError()` → `getDisplayNameSection().getByRole('alert')`
    - `getDisplayNameSuccess()` → `getDisplayNameSection().getByRole('status')`
    - `getSaveButton()` → `getByRole('button', { name: 'Save' }).last()`
    - `getCancelButton()` → `getByRole('button', { name: 'Cancel' })`
    - `getDeleteButton()` → `getByRole('button', { name: 'Delete Group' })`
    - `getCloseButton()` → Uses aria-label from header
    - `getFooterCloseButton()` → `getByRole('button', { name: 'Close' })`
    - `getSecuritySuccessAlert()` → `getByRole('status', { name: 'success' })`
    - `getSecurityUnsavedBanner()` → `getByRole('status', { name: 'unsaved changes' })`
    - `getGeneralSuccessAlert()` → `locator('form').getByRole('status')`
    - `getValidationError()` → `locator('form').getByRole('alert')`
- **Kept as test-id (justified):**
    - `getPresetButton(preset)` - Dynamic button name based on preset type
    - `getPermissionSelect(key)` - Dynamic select based on permission key
    - `getPendingApproveButton(memberId)` - Dynamic button per member
    - `getPendingRejectButton(memberId)` - Dynamic button per member
    - `getModalContainer()` - Uses title test-id for scoping
    - `getDeleteDialog()` - Uses test-id for scoping the delete confirmation dialog

### `ShareGroupModalPage.ts` ~~(8 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **TSX changes (ShareGroupModal.tsx):**
    - Removed `data-testid` from close button (has aria-label)
    - Removed `data-testid` from copy button (has aria-label)
    - Removed `data-testid` from generate button (has aria-label)
    - Removed `data-testid` from error message (has role='alert')
    - ~~Removed `data-testid` from toast (has role='status')~~ Toast removed entirely; copy feedback now uses inline checkmark icon
- **Page object changes:**
    - `getCloseButton()` → `getByRole('button', { name: closeButtonAriaLabel })`
    - `getCopyLinkButton()` → `getByRole('button', { name: copyLinkAriaLabel })`
    - `getGenerateNewLinkButton()` → `getByRole('button', { name: generateNew })`
    - `getErrorMessage()` → `getByRole('alert')`
    - ~~`getToastNotification()` → `getByRole('status')...`~~ Replaced with `getCopySuccessIcon()` → `getCopyLinkButton().locator('svg.text-semantic-success')`
- **Kept as test-id (justified):**
    - `getShareLinkInput()` - Input has no label (value is the share URL)
    - `getLoadingSpinner()` - Generic spinner element
    - `getExpirationOption(optionValue)` - Dynamic buttons per expiration option

### `DashboardPage.ts` ~~(13 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **TSX changes (Pagination.tsx, ActivityFeedCard.tsx, GroupsList.tsx):**
    - Removed `data-testid` from pagination buttons (have aria-labels and text content)
    - Removed `data-testid` from error elements (have `role='alert'`)
- **Page object changes:**
    - `getPaginationNextButton()` → `getByRole('button', { name: translation.pagination.next })`
    - `getPaginationPreviousButton()` → `getByRole('button', { name: translation.pagination.previous })`
    - `getPaginationNextButtonMobile()` → Mobile container scoped `.sm\\:hidden` + `getByRole('button')`
    - `getPaginationPreviousButtonMobile()` → Mobile container scoped `.sm\\:hidden` + `getByRole('button')`
    - `getErrorContainer()` → `getByRole('alert').last()` (error message)
    - `getErrorHeading()` → `getByRole('alert').first()` (error title)
    - `getActivityFeedError()` → `getByRole('alert')`
    - `getActivityFeedEmptyState()` → `locator('div').filter({ hasText: translation.activityFeed.emptyState.title })`
    - `getActivityFeedItems()` → `getByRole('listitem')`
- **Kept as test-id (justified):**
    - `activity-feed-card` - Container for scoping
    - `groups-grid` - Container for scoping
    - `group-card` - Individual card containers for filtering
    - `archived-badge` - Badge element (no semantic alternative)
    - `archived-groups-empty-state` - Container for scoping

### `TenantEditorModalPage.ts` ~~(~50 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors where possible
- **TSX changes (TenantEditorModal.tsx):**
    - Section component: replaced `data-expanded` with `aria-expanded` for proper accessibility
    - Close button: added `aria-label='Close'` for semantic selection
    - Font family inputs: added `id` and `htmlFor` for label association
    - Removed `data-testid` from font family inputs (no longer needed)
- **Page object changes:**
    - `getSectionButtonByName(title)` → `getByRole('button', { name: title })`
    - Section expand methods now use button names: `'Palette Colors'`, `'Surface Colors'`, etc.
    - `getCloseModalButton()` → `getByRole('button', { name: /close/i })`
    - `getAddDomainButton()` → `getByRole('button', { name: 'Add' })`
    - `getFontFamilySansInput()` → `getByLabel(/^Sans/)`
    - `getFontFamilySerifInput()` → `getByLabel(/^Serif/)`
    - `getFontFamilyMonoInput()` → `getByLabel(/^Mono/)`
    - `countExpandedSections()` → uses `aria-expanded` instead of `data-expanded`
    - `collapseAllSections()` → uses `aria-expanded` instead of `data-expanded`
- **Already semantic (unchanged):**
    - `getModal()` → `getByRole('dialog')`
    - `getModalHeading()` → `getByRole('heading', { name: /create|edit tenant/i })`
    - `getTenantIdInput()` → `getByLabel(/tenant id/i)`
    - `getAppNameInput()` → `getByLabel(/app name/i)`
    - All checkbox inputs → `getByLabel()`
    - `getSaveTenantButton()` → `getByRole('button', { name: /(create tenant|update tenant|save changes)/i })`
    - `getCancelButton()` → `getByRole('button', { name: /cancel/i })`
    - `getPublishButton()` → `getByRole('button', { name: /publish theme/i })`
- **Kept as test-id (justified):**
    - Color inputs (40+) - Duplicate labels across sections (e.g., "Primary *" in Palette, Text, Interactive)
    - Aurora gradient colors - Dynamic color inputs
    - Glassmorphism colors - Specialized color inputs
    - Spacing/radii/shadow inputs - Duplicate labels like "SM *", "MD *", "LG *" across sections
    - Legal inputs - Could convert but low value for admin-only
    - `logo-upload-field`, `favicon-upload-field` - Complex ImageUploadField components
    - `remove-domain-${index}` - Dynamic per-domain buttons
    - `source-tenant-select` - Dynamic select element
    - `section-creation-mode`, `section-basic-info` - i18n translated section titles

### `PolicyAcceptanceModalPage.ts` ~~(13 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **TSX changes (PolicyAcceptanceModal.tsx):**
    - Removed `data-testid` from modal title heading (use `getByRole('heading')`)
    - Removed `data-testid` from subtitle paragraph (use `locator('#policy-modal-subtitle')`)
    - Removed `data-testid` from progress bar (has `role='progressbar'`)
    - Removed `data-testid` from policy title heading (use `getByRole('heading')`)
    - Removed `data-testid` from accepted badge (added `role='status'` and `aria-label`)
    - Removed `data-testid` from checkbox and label (has proper `htmlFor`/`id` association)
- **Page object changes:**
    - `getModalOverlay()` → `getByRole('dialog')`
    - `getTitle()` → `getByRole('heading', { name: translation.title })`
    - `getSubtitle()` → `locator('#policy-modal-subtitle')`
    - `getProgressBar()` → `getByRole('progressbar')`
    - `getPolicyTitle()` → `getPolicyCard().getByRole('heading')`
    - `getAcceptedBadge()` → `getPolicyCard().getByRole('status')`
    - `getAcceptanceCheckbox()` → `getAcceptanceSection().getByRole('checkbox')`
    - `getAcceptanceLabel()` → `getAcceptanceSection().locator('label')`
- **Kept as test-id (justified):**
    - `policy-modal-card` - Container for scoping
    - `policy-card` - Card container for scoping
    - `policy-content` - Content container
    - `policy-content-loading` - Loading indicator container
    - `policy-acceptance-section` - Section container for scoping

### `RemoveMemberDialogPage.ts` ~~(2 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **Page object changes:**
    - `this.dialog` → `getByRole('dialog')` (Modal has role="dialog")
    - `this.confirmButton` → `getByRole('button', { name: /confirm/i })`

### `LeaveGroupDialogPage.ts` ~~(6 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **Page object changes:**
    - `getDialogContainer()` → `getByRole('dialog')` (Modal has role="dialog")
    - `getConfirmationDialog()` → Uses `getDialogContainer()` as scope
    - `getDialogMessage()` → `locator('#confirm-dialog-description')` (uses aria-describedby element)
    - `getConfirmButton()` → `getByRole('button', { name: /confirm|understood/i })`
    - `getCancelButton()` → `getByRole('button', { name: /cancel/i })`
- **Kept as test-id (justified):**
    - `balance-error-message` - Specific dynamic content type

### `CreateGroupModalPage.ts` ~~(3 violations)~~ ✅ COMPLETED
- **Status:** Refactored to use semantic selectors
- **TSX changes (CreateGroupModal.tsx):**
    - Added `id='group-description'` and `for='group-description'` to description textarea
    - Removed `data-testid` from display name input and error message
- **Page object changes:**
    - `getGroupDisplayNameInputInternal()` → `getByLabel(/display name in this group/i)`
    - `getGroupDescriptionInputInternal()` → `getByLabel(/description/i)`
    - `getErrorContainer()` → `getByRole('alert')`
    - `getErrorMessage()` → `getByRole('alert')` scoped to modal

### `JoinGroupPage.ts` (3 violations) - PENDING
- **Analysis:** Mixed - some convertible, some justified
- **Test-ids to convert:**
    - `join-display-name-input` → `getByLabel()` or semantic selector
- **Test-ids to keep (justified):**
    - `invalid-link-warning`, `unable-join-warning` - Warning grouping logic
    - `join-group-error-message` - Evaluate for `role="alert"`

### `ExpenseDetailPage.ts` ~~(11 violations)~~ ✅ PARTIALLY COMPLETED
- **Status:** Key interactions refactored to semantic selectors
- **Page object changes:**
    - `getConfirmationDialog()` → `getByRole('dialog')` (Modal has role="dialog")
    - `confirmButton` in `deleteExpense()` → `getByRole('button', { name: /confirm/i })`
- **Kept as test-id (justified):**
    - Section cards (`expense-summary-card`, `expense-split-card`, etc.) - Structural containers
    - `expense-header`, `expense-lock-warning` - Custom layout elements
    - `expense-amount-section` - Container for complex content
    - `comments-section`, `comment-item` - List item targeting

### `ExpenseFormPage.ts` (11 violations) - PENDING
- **Analysis:** Limited convertibility due to duplicate elements
- **Test-ids to keep (justified):**
    - `expense-form-cancel` - Two Cancel buttons on page (header + form), test-id disambiguates
    - Section containers (`expense-details-section`, `who-paid-section`, etc.) - Structural scoping
    - `payer-selector-trigger`, `payer-selector-search` - Dropdown components
    - Validation errors - Field-specific error targeting

### `SettlementFormPage.ts` (7 violations) - PENDING
- **Analysis:** 29% convertible - mostly validation errors
- **Test-ids to convert:**
    - `settle-up-button` → `getByRole('button', { name: /settle up/i })`
    - `settlement-date-input` → `getByPlaceholder()` or `getByLabel()`
- **Test-ids to keep (justified):**
    - `settlement-warning-message` - Dynamic validation warnings
    - `balance-summary-sidebar` - Layout container
    - `settlement-validation-error`, `settlement-amount-error` - Field-specific errors

### `GroupDetailPage.ts` ~~(18 violations)~~ ✅ PARTIALLY COMPLETED
- **Status:** Delete settlement dialog refactored to semantic selectors
- **Page object changes:**
    - `deleteSettlement()` dialog → `getByRole('dialog')` (Modal has role="dialog")
    - `deleteSettlement()` heading → `getByRole('heading', { name: 'Delete Payment' })`
    - `deleteSettlement()` confirm button → `getByRole('button', { name: /delete/i })`
    - `deleteSettlement()` cancel button → `getByRole('button', { name: /cancel/i })`
- **Kept as test-id (justified):**
    - `member-item` + `data-member-name` - Member targeting by name
    - `expense-item` - Frequently filtered with multiple conditions
    - `debt-item` - Complex financial relationships
    - `participant-selector-grid` - Custom form structure
    - Toggle buttons, checkboxes - Further refactoring possible but lower priority

### `AdminDiagnosticsPage.ts` (6 violations) - PENDING (Admin)
- **Analysis:** 33% convertible
- **Test-ids to convert:**
    - `copy-theme-link-button` → `getByRole('button', { name: /copy link/i })`
    - `force-reload-theme-button` → `getByRole('button', { name: /force reload/i })`
- **Test-ids to keep (justified):**
    - Card containers (`tenant-overview-card`, `theme-artifact-card`, etc.) - Generic wrappers

### `AdminTenantConfigPage.ts` (4 violations) - PENDING (Admin)
- **Analysis:** Keep all - generic card containers
- **Test-ids to keep (justified):**
    - All card containers - No semantic role available

### `AdminUsersPage.ts` (1 violation) - PENDING (Admin)
- **Analysis:** Keep - dynamic pattern
- **Test-ids to keep (justified):**
    - `edit-user-${uid}` - Dynamic per-user buttons

### `AdminTenantsPage.ts` (1 violation) - PENDING (Admin)
- **Analysis:** Mostly keep
- **Test-ids to convert:**
    - `tenants-loading-spinner` → `getByRole('status')`
- **Test-ids to keep (justified):**
    - `tenant-card`, `edit-tenant-${tenantId}` - Dynamic per-tenant elements

### `ThemePage.ts` (1 violation) - PENDING
- **Analysis:** 100% convertible
- **Test-ids to convert:**
    - `header-logo-link` → Semantic header navigation
    - `header-signup-link` → `getByRole('button', { name: /sign up/i })`

### Acceptable Use Cases (or cases requiring more investigation)
Some `testid` usage might be acceptable, but should be reviewed:

- **Containers for Scoping:** `getByTestId('expense-summary-card')`. This is sometimes acceptable to scope subsequent queries. However, a better approach is often to use `getByRole('region', { name: 'Expense Summary' })`. This improves accessibility.
- **Dynamically Generated Content:** `getByTestId("edit-user-" + uid)`. This is a common pattern. The accessible alternative is to find the element by its content. For example, find a table row containing a user's email, then find the "Edit" button within that row. `const row = page.getByRole('row', { name: /user@example.com/ }); await row.getByRole('button', { name: 'Edit' }).click();`
- **Non-Semantic Elements:** `getByTestId('expense-amount')`. If this is just a `<span>` with a number, it can be hard to select. However, it's often inside a more semantic container (like a list item or table cell) which can be used for scoping.

## 5. Next Steps

1.  **Prioritize Refactoring:** Start with the files with the most egregious and easily fixable violations (`UserEditorModalPage`, `HeaderPage`, `LoginPage`, `FooterComponent`).
2.  **Tackle Large Forms:** The `TenantEditorModalPage` needs a dedicated effort to refactor all form inputs to use `getByLabelText`. This will likely require adding `<label>` elements in the application code, which is a significant accessibility improvement.
3.  **Update Team Standards:** Reinforce the "semantic selectors first" rule in code reviews. Link to this audit document as a reference.
4.  **Adopt a "No New `getByTestId`" Policy:** For a period of time, disallow any *new* `getByTestId` additions during code review unless the author can prove that no semantic selector is possible. This will help build the right habits.

By transitioning to semantic, user-centric selectors, the project's test suite will become more robust, more readable, and a driver for better accessibility.
