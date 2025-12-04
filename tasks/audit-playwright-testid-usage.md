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

### `UserEditorModalPage.ts` (7 violations)
- **Problem:** Uses `getByTestId` for tabs, inputs, and buttons.
- **Recommendation:**
    - `profile-tab`: `getByRole('tab', { name: 'Profile' })`
    - `role-tab`: `getByRole('tab', { name: 'Role' })`
    - `display-name-input`: `getByLabelText('Display Name')`
    - `email-input`: `getByLabelText('Email')`
    - `save-profile-button`, `save-role-button`, `cancel-button`: Use `getByRole('button', { name: '...' })`

### `HeaderPage.ts` (3 violations)
- **Problem:** Dropdown menu items are selected with `testid`.
- **Recommendation:** Use `getByRole('menuitem', { name: '...' })`.
    - `user-menu-dashboard-link`: `getByRole('menuitem', { name: 'Dashboard' })`
    - `user-menu-settings-link`: `getByRole('menuitem', { name: 'Settings' })`
    - `sign-out-button`: `getByRole('menuitem', { name: 'Sign Out' })`

### `LoginPage.ts` / `RegisterPage.ts` (6 violations)
- **Problem:** Checkboxes and links are selected with `testid`.
- **Recommendation:**
    - `remember-me-checkbox`, `terms-checkbox`, etc.: `getByLabelText('Remember me')`
    - `loginpage-signup-button`, `header-logo-link`: `getByRole('link', { name: '...' })`

### `FooterComponent.ts` (4 violations)
- **Problem:** All footer links use `testid`.
- **Recommendation:** Replace all with `getByRole('link', { name: '...' })`. For example, `getByRole('link', { name: 'Terms' })`.

### `GroupSettingsModalPage.ts` (24 violations)
- **Problem:** This file is a major offender, using `testid` for tabs, inputs, buttons, and dynamic elements.
- **Recommendation:**
    - `group-settings-tab-*`: `getByRole('tab', { name: '...' })`
    - `group-name-input`, `group-description-input`: `getByLabelText(...)`
    - `save-changes-button`, `delete-group-button`, etc.: `getByRole('button', { name: '...' })`
    - `permission-select-*`: These are likely `select` elements and should be selected with `getByLabelText(...)`.
    - `pending-approve-*`, `pending-reject-*`: These are buttons and should have accessible names. `getByRole('button', { name: 'Approve <Member Name>' })`.

### `ShareGroupModalPage.ts` (8 violations)
- **Problem:** Inputs and buttons are selected with `testid`.
- **Recommendation:**
    - `share-link-input`: `getByLabelText('Share Link')`
    - `copy-link-button`: `getByRole('button', { name: 'Copy Link' })`
    - `generate-new-link-button`: `getByRole('button', { name: 'Generate New Link' })`
    - `loading-spinner`: `getByRole('status', { name: 'Loading' })` (assuming it has an ARIA label).
    - `share-link-expiration-*`: Should be `getByLabelText` if it's a radio group or select.

### `DashboardPage.ts` (13 violations)
- **Problem:** A mix of legitimate and unnecessary `testid` usage.
- **Recommendation:**
    - `pagination-next`, `pagination-previous`: `getByRole('link', { name: /Next/i })` or `getByRole('button', { name: /Next/i })`.
    - `user-menu-button`: `getByRole('button', { name: 'User menu' })` or similar accessible name.
    - `activity-feed-item`: This could be a legitimate use if items are generic. A better approach is to select the list (`getByRole('list', { name: 'Activity feed' })`) and then find items within it (`getByRole('listitem')`).

### `TenantEditorModalPage.ts` (~50 violations)
- **Problem:** Extreme overuse of `testid` for every single form field. The modal is likely one large `form`.
- **Recommendation:** A full refactor is required. Every input should be selected with `getByLabelText`.
    - `logo-upload-field`: `getByLabelText('Logo')`
    - `primary-color-input`: `getByLabelText('Primary Color')`
    - `font-family-sans-input`: `getByLabelText('Sans-serif Font Family')`
    - `add-domain-button`: `getByRole('button', { name: 'Add domain' })`

### `PolicyAcceptanceModalPage.ts` (13 violations)
- **Problem:** All elements in the modal, including titles, badges, and checkboxes, use `testid`.
- **Recommendation:**
    - `policy-modal-title`: `getByRole('heading', { name: '...' })`
    - `policy-accept-checkbox`: `getByLabelText('I accept the terms...')`
    - `policy-accepted-badge`: Can be found via text: `getByText('Accepted')`.

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
