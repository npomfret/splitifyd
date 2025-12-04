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
    - Removed `data-testid` from toast (has role='status')
- **Page object changes:**
    - `getCloseButton()` → `getByRole('button', { name: closeButtonAriaLabel })`
    - `getCopyLinkButton()` → `getByRole('button', { name: copyLinkAriaLabel })`
    - `getGenerateNewLinkButton()` → `getByRole('button', { name: generateNew })`
    - `getErrorMessage()` → `getByRole('alert')`
    - `getToastNotification()` → `getByRole('status').filter({ hasText: linkCopied })`
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

### `TenantEditorModalPage.ts` (~50 violations) ⏸️ DEFERRED
- **Status:** Deferred - requires major refactoring of admin-only functionality
- **Analysis:** The ColorInput component has proper `<label for={id}>` associations, so most inputs COULD use `getByLabel()`. However:
    - The modal has ~50 form fields across many collapsible sections
    - Some inputs already use semantic selectors in the page object (checkboxes via getByLabel)
    - Section expansion buttons use test-ids with `data-expanded` attribute for state checking
- **Partial semantic selectors already in use:**
    - `getModal()` → `getByRole('dialog')` ✅
    - `getModalHeading()` → `getByRole('heading', { name: /create|edit tenant/i })` ✅
    - `getTenantIdInput()` → `getByLabel(/tenant id/i)` ✅
    - `getAppNameInput()` → `getByLabel(/app name/i)` ✅
    - Most checkbox inputs use `getByLabel()` ✅
- **Test-ids that could be converted (future work):**
    - ColorInput fields: `primary-color-input` → `getByLabel('Primary *')`
    - Section buttons: `section-palette` → `getByRole('button', { name: 'Palette Colors' })`
    - Font inputs: `font-family-sans-input` → `getByLabel(/Sans.*Font/i)`
- **Test-ids to keep (justified):**
    - `logo-upload-field`, `favicon-upload-field` - Complex ImageUploadField components
    - `remove-domain-${index}` - Dynamic per-domain buttons
    - `source-tenant-select` - Dynamic select element
- **Note:** This is admin-only functionality. Recommend incremental refactoring as tests are modified.

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
