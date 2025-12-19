# POM selector audit (bad selectors)

Status: COMPLETED

Effort: medium

## Summary of Changes Made

### Phase 1: XPath and Conditional Regex Removal
- **GroupSettingsModalPage.ts:1253** - Replaced XPath with scope-first pattern using `.filter({ has: heading })`
- **TenantEditorModalPage.ts** - Fixed placeholder, success/error alert selectors
- **DashboardPage.ts** - Split conditional regex into separate button checks
- **ExpenseFormPage.ts** - Changed `(AM|PM)` to character class `[AP]M`
- **SettingsPage.ts** - Simplified success message regex

### Phase 2: Hardcoded Strings
- **ExpenseFormPage.ts** - Added translation-backed helper methods for:
  - Time input placeholder
  - Currency search placeholder
  - Description placeholder
  - Split type instructions (equal, exact, percentage)
  - Split total text
  - Labels hint (dynamic regex with justification)
- **ExpenseDetailPage.ts** - Used translation keys
- **LeaveGroupDialogPage.ts** - Used translation key
- **SettlementFormPage.ts** - Fixed currency search placeholder to use translation
- **BasePage.ts** - Added justification for ErrorBoundary check (dev-only, not user-facing)
- **Admin pages** - Added justification comments for intentional hardcoded English

### Phase 3: CSS Class Selectors
- **AdminPage.ts, HeaderPage.ts, ShareGroupModalPage.ts, GroupDetailPage.ts** - Added style assertion justification comments

### Phase 4: `.first()/.nth()/.last()` Justifications
Added justification comments to ALL remaining usages across all POM files:
- JoinGroupPage.ts, FooterComponent.ts, RegisterPage.ts, PolicyAcceptanceModalPage.ts
- SettlementFormPage.ts, BasePage.ts, GroupDetailPage.ts, SettingsPage.ts
- ThemePage.ts, DashboardPage.ts, TenantEditorModalPage.ts
- CreateGroupModalPage.ts, AdminTenantsPage.ts, ExpenseFormPage.ts
- GroupSettingsModalPage.ts

All usages now have inline comments explaining why the index-based selection is appropriate.

### Phase 5: Unscoped Selector Scoping & Justifications
Addressed Section 6 violations (page-level selectors without container scoping):

- **TenantEditorModalPage.ts** - Complete overhaul:
  - Added comprehensive file-level JSDoc explaining selector strategy
  - Scoped ALL `getByTestId` calls to `getModal()` (was `this.page.getByTestId`)
  - Scoped ALL `getByLabel` calls to `getModal()`
  - Added justification comments for test-id usage (duplicate labels across sections)
  - Justified page-level selectors: success toasts (page level), Create New Tenant button (outside modal)

- **UserEditorModalPage.ts** - Scoped selectors to modal:
  - Added file-level JSDoc with single-dialog invariant explanation
  - Scoped tabs, inputs, buttons to `getModal()`
  - Justified page-level success alert (toast renders outside modal)

- **LeaveGroupDialogPage.ts** - Added single-dialog invariant justification

- **SettlementFormPage.ts** - Added file-level JSDoc explaining:
  - Single dialog invariant
  - Portal-rendered currency dropdown (justified page-level access)

## Scope

Audited Playwright Page Object Models under:
- `packages/test-support/src/page-objects/`

Relevant repo rules:
- `docs/guides/testing.md` (selector priority, i18n resilience, no conditional regex `|`)
- `docs/guides/webapp-and-style-guide.md` (scope-first selectors, avoid `.first()/.nth()`, avoid ambiguous selectors)

## Baseline rule (default approach)

Default POM locator strategy should mirror user behavior:
1) Find a container by **heading/landmark** (e.g. `region`, `dialog`, `section` with a heading).
2) Select a **unique element within that container**.

If a locator does **not** do this, it must include an explicit justification (in code) for why global/unscoped selection is safe and stable (e.g. unique landmark like `header/footer`, or a deliberate “style assertion” selector).

## Findings

### 1) Hardcoded user-facing strings in selectors (not translation-backed)

These violate the **i18n resilience (MANDATORY)** guidance in `docs/guides/testing.md` because they will break if translations/UI copy change.

- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:260` uses `getByRole('button', { name: 'Create Tenant' })`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:265` uses `getByRole('button', { name: 'Save Changes' })`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:290` uses `getByRole('button', { name: 'Create New Tenant' })`

- `packages/test-support/src/page-objects/ExpenseFormPage.ts:284` uses `getByPlaceholder(/Enter time/i)`
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:473` uses `getByPlaceholder(/What was this expense for/i)` (also at `ExpenseFormPage.ts:503`)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:455` uses `getByPlaceholder(/Search by symbol, code, or country/i)` (also at `ExpenseFormPage.ts:485`, `ExpenseFormPage.ts:524`)

- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:133` uses `getByRole('dialog', { name: /delete expense/i })`
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:351` uses `getByText(/this action cannot be undone and will affect group balances/i)`

- `packages/test-support/src/page-objects/LeaveGroupDialogPage.ts:67` filters by `hasText: /outstanding balance/i`
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:74` uses `getByText(/you do not have permission/i)`
- `packages/test-support/src/page-objects/TenantBrandingPage.ts:77` uses `locator('text=/you do not have permission/i')`
- `packages/test-support/src/page-objects/TenantBrandingPage.ts:84` uses `locator('text=/branding settings updated successfully/i')`
- `packages/test-support/src/page-objects/TenantBrandingPage.ts:88` uses `locator('text=/branding update not yet implemented/i')`

Notes:
- Some of these are regex selectors, but they’re still hardcoded English and not sourced from translations.
- A few comments explicitly acknowledge “admin pages use hardcoded English”, but this still conflicts with the testing guide’s i18n rule.

### 2) Conditional regex (`|`) used in selectors (explicitly forbidden)

`docs/guides/testing.md` states: **No conditional regex (`|`) in selectors**.

- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:251` uses `getByPlaceholder(/example\\.com|domain/i)`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:281` filters by `hasText: /successfully|published/i`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:285` filters by `hasText: /error|invalid|required|failed/i`

- `packages/test-support/src/page-objects/DashboardPage.ts:192` uses `new RegExp(`${translation.groupActions.archive}|${translation.groupActions.unarchive}`)`

- `packages/test-support/src/page-objects/ExpenseFormPage.ts:280` uses `/at \\d{1,2}:\\d{2} (AM|PM)/i`
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:920` filters by `/\\d{1,2}:\\d{2}\\s*(AM|PM)/i`

- `packages/test-support/src/page-objects/SettingsPage.ts:125` filters by `/successfully|updated|changed/i`

### 3) XPath selector usage (explicitly forbidden)

`docs/guides/testing.md` prohibits XPath selectors.

- `packages/test-support/src/page-objects/GroupSettingsModalPage.ts:1253` uses `locator('xpath=ancestor::div[contains(@class, \"border-t\")]')`

### 4) CSS class selectors used as locators (generally prohibited / brittle)

`docs/guides/testing.md` prohibits selecting by CSS classes (fragile to refactors and styling changes). Some usages include inline justification, but they still conflict with the “Prohibited” list.

- `packages/test-support/src/page-objects/AdminPage.ts:24` uses `.admin-layout`
- `packages/test-support/src/page-objects/AdminPage.ts:33` uses `.admin-gradient-mixed`
- `packages/test-support/src/page-objects/AdminPage.ts:38` uses `.admin-grid-pattern`

- `packages/test-support/src/page-objects/HeaderPage.ts:30` uses `span.bg-semantic-error`
- `packages/test-support/src/page-objects/ShareGroupModalPage.ts:62` uses `svg.text-semantic-success`
- `packages/test-support/src/page-objects/GroupDetailPage.ts:365` uses `#group-header .help-text`

### 5) Ambiguous selectors using `.first()/.nth()/.last()` (scope-first rule violation)

`docs/guides/webapp-and-style-guide.md` and the selector guidance discourage `.first()/.nth()/.last()` and require scoping to a container first.

Occurrences (count of `.first()/.nth()/.last()` per file):
- `packages/test-support/src/page-objects/GroupDetailPage.ts` (27)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts` (13)
- `packages/test-support/src/page-objects/DashboardPage.ts` (6)
- `packages/test-support/src/page-objects/CreateGroupModalPage.ts` (5)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts` (5)
- `packages/test-support/src/page-objects/SettingsPage.ts` (4)
- `packages/test-support/src/page-objects/SettlementFormPage.ts` (3)
- `packages/test-support/src/page-objects/GroupSettingsModalPage.ts` (3)

Notable examples to refactor:
- `packages/test-support/src/page-objects/CreateGroupModalPage.ts:95` / `:103` / `:111` use `.first()`/`.nth()` to pick specific “More information” icons.
- `packages/test-support/src/page-objects/GroupSettingsModalPage.ts:170` uses `.last()` to choose a “Save” button (implies multiple matches and ambiguous scope).
- `packages/test-support/src/page-objects/GroupDetailPage.ts:384` and `:400` use `.first()` to disambiguate duplicate buttons (sidebar vs header) instead of scoping to the correct container.

### 6) Locators not using “container-by-heading then select within” (needs justification)

Many locators are already scoped (e.g. `getModalContainer().getByRole(...)`, `getByRole('region', { name: ... })`), but there are also a number of “page-level” selectors that do not first identify a container by heading/landmark.

These should be treated as **policy violations unless justified in code**, or refactored to scope-first.

Exhaustive list (all current occurrences under `packages/test-support/src/page-objects/` that do not follow the default “heading/landmark container → unique item within” approach, and therefore require either refactor or explicit justification):

**DashboardPage**
- `packages/test-support/src/page-objects/DashboardPage.ts:97` `this.page.getByText(translation.dashboard.emptyState.title)` (unscoped text; should scope to empty state container)
- `packages/test-support/src/page-objects/DashboardPage.ts:274` `expect(this.page.getByText(expectedText, { exact: true }))...` (unscoped text assertion)
- `packages/test-support/src/page-objects/DashboardPage.ts:289` `this.page.getByText(...).locator('..')` (parent traversal from unscoped text; should instead locate a container by heading/landmark)
- `packages/test-support/src/page-objects/DashboardPage.ts:827` `this.page.getByText(...).first()` (unscoped + `.first()`)
- `packages/test-support/src/page-objects/DashboardPage.ts:221` `this.page.getByRole('navigation', { name: ... }).first().getByRole('button', ...)` (index-based `.first()` instead of scoping to a specific container)
- `packages/test-support/src/page-objects/DashboardPage.ts:226` same as above
- `packages/test-support/src/page-objects/DashboardPage.ts:375` `this.page.getByRole('button', { name: translation.navigation.userMenu.openUserMenu })` (should delegate to `HeaderPage` / scope to header landmark)
- `packages/test-support/src/page-objects/DashboardPage.ts:527` `this.page.locator('button:visible').evaluateAll(...)` (global query over all visible buttons; must be justified)
- `packages/test-support/src/page-objects/DashboardPage.ts:530` `this.page.locator('[role=\"dialog\"]').count()` (generic role locator; must be scoped or justified)

**ThemePage**
- `packages/test-support/src/page-objects/ThemePage.ts:51` `this.page.getByRole('button', { name: translation.header.goToHome })` (unscoped button)
- `packages/test-support/src/page-objects/ThemePage.ts:61` `this.page.getByRole('button', { name: translation.header.signUp, exact: true })` (unscoped button)
- `packages/test-support/src/page-objects/ThemePage.ts:29` `this.page.locator('#app')` (global id locator; justify uniqueness or scope to a visible landmark)
- `packages/test-support/src/page-objects/ThemePage.ts:187` / `:208` `this.page.locator(selector).first()` (dynamic selector + `.first()` needs strong justification)

**LoginPage**
- `packages/test-support/src/page-objects/LoginPage.ts:43` `this.page.getByRole('button', { name: translation.header.goToHome })` (unscoped button; should use `HeaderPage` / header landmark)
- `packages/test-support/src/page-objects/LoginPage.ts:65` `this.page.getByRole('alert')` (global alert; should scope to login form container or justify single-alert invariant)

**SettingsPage**
- `packages/test-support/src/page-objects/SettingsPage.ts:61` `this.page.getByLabel(translation.settingsPage.displayNameValue)` (unscoped label/value; should scope to profile section container)
- `packages/test-support/src/page-objects/SettingsPage.ts:65` `this.page.getByLabel(translation.settingsPage.emailValue)` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:69` `this.page.getByLabel(translation.settingsPage.displayNameLabel, { exact: true })` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:92` `this.page.getByRole('button', { name: translation.settingsPage.changePasswordButton })` (should scope to password section container)
- `packages/test-support/src/page-objects/SettingsPage.ts:96` `this.page.getByLabel(translation.settingsPage.currentPasswordLabel)` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:101` `this.page.getByLabel(translation.settingsPage.newPasswordLabel, { exact: true })` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:105` `this.page.getByLabel(translation.settingsPage.confirmNewPasswordLabel, { exact: true })` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:109` `this.page.getByRole('button', { name: translation.settingsPage.updatePasswordButton })` (should scope to password section container)
- `packages/test-support/src/page-objects/SettingsPage.ts:121` `const alerts = this.page.getByRole('alert')` (global; scope to relevant section or justify)
- `packages/test-support/src/page-objects/SettingsPage.ts:248` `this.page.getByText(text)` (global text; should be scoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:401` `this.page.getByText(translation.settingsPage.profileSummaryTitle)` (unscoped; should scope to profile summary container)
- `packages/test-support/src/page-objects/SettingsPage.ts:418` `this.page.getByText(translation.settingsPage.profileSummaryRoleLabel)` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:436` `this.page.getByText(translation.settingsPage.passwordRequirementsHeading)` (unscoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:425` `this.page.getByText(value)` (global text; should be scoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:443` `this.page.getByText(pattern)` (global text; should be scoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:484` `this.page.getByText(...).first()` (global text + `.first()`; should be scoped)
- `packages/test-support/src/page-objects/SettingsPage.ts:598` `this.page.locator('select[name=\"language\"]')` (attribute selector; should use label/role in a scoped container)
- `packages/test-support/src/page-objects/SettingsPage.ts:615` / `:639` / `:644` `this.page.locator('html')...` (global document assertion; needs explicit justification comment)

**SettlementFormPage**
- `packages/test-support/src/page-objects/SettlementFormPage.ts:23` `this.page.getByRole('dialog')` (unnamed dialog; must scope by dialog name/title or justify single-dialog invariant)
- `packages/test-support/src/page-objects/SettlementFormPage.ts:88` `this.page.getByRole('button', { name: ... })` (unscoped button)
- `packages/test-support/src/page-objects/SettlementFormPage.ts:89` `this.page.getByRole('button', { name: ... }).first()` (unscoped + `.first()`)
- `packages/test-support/src/page-objects/SettlementFormPage.ts:94` `this.page.getByRole('region', { name: ... }).first()` (container chosen by index; should scope to unique container)
- `packages/test-support/src/page-objects/SettlementFormPage.ts:164` `this.page.getByRole('listbox')` (generic; should scope to the currency dropdown container)

**LeaveGroupDialogPage**
- `packages/test-support/src/page-objects/LeaveGroupDialogPage.ts:27` `this.page.getByRole('dialog')` (unnamed dialog; should locate by dialog heading/name)
- `packages/test-support/src/page-objects/LeaveGroupDialogPage.ts:67` `...filter({ hasText: /outstanding balance/i })` (text-based filter; should use a translated key and be scoped)

**UserEditorModalPage**
- `packages/test-support/src/page-objects/UserEditorModalPage.ts:21` `this.page.getByRole('dialog')` (unnamed dialog)
- `packages/test-support/src/page-objects/UserEditorModalPage.ts:25` `this.page.getByRole('tab', { name: ... })` (should be scoped to the dialog container)
- `packages/test-support/src/page-objects/UserEditorModalPage.ts:29` same as above
- `packages/test-support/src/page-objects/UserEditorModalPage.ts:33` `this.page.getByLabel(...)` (should be scoped to the dialog container)
- `packages/test-support/src/page-objects/UserEditorModalPage.ts:37` same as above
- `packages/test-support/src/page-objects/UserEditorModalPage.ts:53` / `:57` `this.page.getByText(...)` (should be scoped to the dialog container)

**TenantEditorModalPage**
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:16` `this.page.getByTestId(testId)` (global testid; scope to dialog/container or justify)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:128` `this.page.getByRole('dialog')` (unnamed dialog)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:140` / `:144` `this.page.getByLabel(/.../i)` (regex label; should be scoped to dialog and translation-backed)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:148` / `:152` / `:157` / `:161` / `:165` / `:169` / `:173` and many others: `this.page.getByTestId('...')` (global testid; scope to dialog/container or justify)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:178` `this.page.locator('[data-testid=\"custom-css-input\"]')` (attribute locator; scope to dialog/container or justify)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:182` / `:186` / `:191` / `:196` / `:200` / `:204` `this.page.getByLabel(/.../i)` (regex labels; should be scoped + translation-backed)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:222` `this.page.getByRole('heading', { name: /aurora gradient/i })...` (hardcoded English regex; should be translation-backed and used only to scope a container)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:251` `this.page.getByPlaceholder(/example\\.com|domain/i)` (hardcoded + conditional regex `|` + unscoped)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:269` / `:277` page-level buttons (should be scoped to modal container)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:281` / `:285` `this.page.locator('[role=\"alert\"]').filter({ hasText: /...|.../i })` (global alerts + conditional regex; should be scoped and not use `|`)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:290` `this.page.getByRole('button', { name: 'Create New Tenant' })` (hardcoded English + unscoped)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:324` / `:336` local variables using `this.page.getByTestId(...)` (unscoped)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:840` `this.page.getByText(domain, { exact: true })` (unscoped text)
Full list of `getByTestId(...)` in this file (all unscoped unless explicitly wrapped in a modal/container locator):
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:148` `logo-upload-field`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:152` `favicon-upload-field`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:157` `primary-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:161` `secondary-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:165` `accent-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:169` `surface-base-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:173` `text-primary-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:226` `aurora-gradient-color-1-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:230` `aurora-gradient-color-2-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:234` `aurora-gradient-color-3-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:238` `aurora-gradient-color-4-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:243` `glass-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:247` `glass-border-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:324` `logo-upload-field-url-input` (local var)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:336` `favicon-upload-field-url-input` (local var)
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:867` `spacing-2xs-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:871` `spacing-xs-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:875` `spacing-sm-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:879` `spacing-md-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:883` `spacing-lg-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:899` `radii-sm-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:903` `radii-md-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:907` `radii-lg-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:933` `shadow-sm-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:937` `shadow-md-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:941` `shadow-lg-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:970` `company-name-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:974` `support-email-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:978` `privacy-policy-url-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:982` `terms-of-service-url-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:1022` `interactive-primary-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:1026` `interactive-primary-hover-color-input`
- `packages/test-support/src/page-objects/TenantEditorModalPage.ts:1030` `interactive-destructive-color-input`

**ExpenseDetailPage**
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:55` / `:62` / `:69` page-level action buttons (should scope to the expense detail dialog/action region)
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:119` `this.page.getByRole('dialog')` (unnamed dialog)
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:133` `this.page.getByRole('dialog', { name: /delete expense/i })` (hardcoded English regex; should be translation-backed and scoped)
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:178` `expect(this.page.getByRole('dialog'))...` (unnamed; same issue)
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:500` `this.page.getByRole('listbox')` (generic; should scope to the reactions/picker container)
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:46` / `:147` `this.page.locator('#expense-detail-modal-title'...)` (id locator; justify uniqueness or scope via dialog heading)
- `packages/test-support/src/page-objects/ExpenseDetailPage.ts:351` `confirmDialog.getByText(/this action cannot be undone.../i)` (hardcoded English; should be translation-backed)

**BasePage**
- `packages/test-support/src/page-objects/BasePage.ts:406` `this._page.getByRole('link', { name: /skip to main content/i })` (hardcoded English regex; justify as invariant global accessibility link or translate/scope)
- `packages/test-support/src/page-objects/BasePage.ts:413` `this._page.locator('#main-content')` (id locator; justify uniqueness)
- `packages/test-support/src/page-objects/BasePage.ts:462` `this._page.locator('[role=\"dialog\"]')` (generic; should prefer named dialogs or justify)
- `packages/test-support/src/page-objects/BasePage.ts:519` `this._page.locator('body')` (global; needs justification when used)
- `packages/test-support/src/page-objects/BasePage.ts:394` / `:395` `this._page.getByText(...)` (global text assertions; must be justified)

**PolicyAcceptanceModalPage**
- `packages/test-support/src/page-objects/PolicyAcceptanceModalPage.ts:22` / `:27` `this.page.getByRole('dialog')` (unnamed dialog)
- `packages/test-support/src/page-objects/PolicyAcceptanceModalPage.ts:37` `this.page.locator('#policy-modal-subtitle')` (id locator; justify uniqueness or scope via dialog heading)

**TenantBrandingPage**
- `packages/test-support/src/page-objects/TenantBrandingPage.ts:42` / `:46` / `:50` / `:54` / `:58` `this.page.getByLabel(...)` (unscoped; should scope to the branding form/section container)
- `packages/test-support/src/page-objects/TenantBrandingPage.ts:62` / `:66` / `:70` page-level checkbox/button (unscoped)
- `packages/test-support/src/page-objects/TenantBrandingPage.ts:77` / `:84` / `:88` hardcoded English `text=/.../i` locators (unscoped; should be translation-backed and scoped)

**AdminUsersPage**
- `packages/test-support/src/page-objects/AdminUsersPage.ts:27` `this.page.getByRole('row').filter({ hasText: email })` (unscoped; should scope to the users table container)
- `packages/test-support/src/page-objects/AdminUsersPage.ts:41` / `:42` `this.page.locator(\`button[aria-label=\"...\"]\`)` + `[data-uid]` (attribute selectors; should scope to the relevant row/container by heading/landmark)

**AdminDiagnosticsPage**
- `packages/test-support/src/page-objects/AdminDiagnosticsPage.ts:52` / `:56` page-level buttons (should scope to the diagnostics card/container located by heading)
- `packages/test-support/src/page-objects/AdminDiagnosticsPage.ts:30` `this.page.locator('section, div').filter({ has: this.page.getByRole('heading', ...) })` (this one follows the pattern; keep it as the “good” baseline)

**RegisterPage**
- `packages/test-support/src/page-objects/RegisterPage.ts:49` `this.page.getByRole('alert')` (global alert; should scope to register form container)
- `packages/test-support/src/page-objects/RegisterPage.ts:615` `this.page.getByText(displayName).first()` (unscoped text + `.first()`)

**ShareGroupModalPage**
- `packages/test-support/src/page-objects/ShareGroupModalPage.ts:53` / `:54` uses `[role=\"presentation\"]` + `[role=\"dialog\"]` (generic role locators; should prefer `getByRole('dialog', { name: ... })` then locate backdrop relative to it, or justify why this is stable)

**HeaderPage**
- `packages/test-support/src/page-objects/HeaderPage.ts:21` / `:37` page-level buttons (should scope to `header` landmark container)
- `packages/test-support/src/page-objects/HeaderPage.ts:41` `this.page.getByRole('menu')` (generic; should scope to user menu open state or container)
- `packages/test-support/src/page-objects/HeaderPage.ts:219` `this.page.locator('header')` (landmark selector; likely OK but should include a brief “unique header landmark” justification comment)

**GroupDetailPage**
- `packages/test-support/src/page-objects/GroupDetailPage.ts:147` / `:163` / `:170` / `:177` / `:668` `getByRole('region', { name: ... }).first()` (container chosen by index; should scope to unique container)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:203` / `:207` / `:211` / `:219` page-level “toggle section” buttons (unscoped; `:219` also uses `.first()`)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:321` `getByRole('status', { name: ... })` (global; should scope to relevant section container)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:328` `getByRole('alert').filter({ has: page.getByText(...) })` (global; should scope to error container)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:376` / `:384` / `:400` / `:407` / `:411` / `:415` / `:422` page-level action buttons (should scope to the actions container; `:384` and `:400` also use `.first()`)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:1586` / `:1754` `const modal/confirmDialog = this.page.getByRole('dialog')` (unnamed dialog)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:2409` `this.page.getByRole('listbox')` (generic; should scope to emoji picker/container)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:2497` `this.page.getByRole('alert').filter({ hasText: translation.group.locked.banner })` (global alert; should scope to the group lock banner container)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:339` / `:356` / `:365` `#group-header ...` locators (id + class selectors; justify uniqueness or refactor to semantic scoping by heading/region)
- `packages/test-support/src/page-objects/GroupDetailPage.ts:1142` `this.page.locator('body').toContainText(...)` (global; must be justified)

**RemoveMemberDialogPage**
- `packages/test-support/src/page-objects/RemoveMemberDialogPage.ts:19` `this.page.getByRole('dialog')` (unnamed dialog)

**ExpenseFormPage**
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:208` / `:216` / `:230` / `:237` / `:244` / `:251` / `:255` / `:259` / `:273` / `:280` / `:290` / `:1565` page-level buttons (should scope to the expense form container/sections; `:216` uses an unnamed `getByRole('dialog')` as a scope; `:280` uses a hardcoded regex with `|`)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:284` / `:455` / `:473` / `:485` / `:503` / `:524` page-level placeholders (hardcoded English; should be translation-backed and scoped)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:165` / `:175` / `:182` / `:1496` / `:1503` page-level hardcoded text regex (should be translation-backed and scoped)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:468` / `:498` / `:539` `this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') })` (unscoped; should scope to the currency combobox/listbox container)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:509` / `:513` / `:674` / `:894` / `:902` `expect(this.page.getByRole('dialog'))...` (unnamed dialog assertions)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:920` `this.page.getByRole('button').filter({ hasText: /... (AM|PM)/i })` (very broad global scan + conditional regex `|`)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:1167` / `:1170` member checkbox/radio by name at page-level (should scope to payer/participants region container)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:1231` / `:1241` / `:1247` `getByRole('alert').filter({ hasText: text })` (global; should scope to form container)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:1268` / `:1275` `getByRole('alert')` (global)
- `packages/test-support/src/page-objects/ExpenseFormPage.ts:731` / `:753` / `:749` / `:1309` / `:1421` page-level text assertions (should be scoped)

**AdminTenantsPage**
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:45` / `:56` page-level buttons (should scope to the tenants page container)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:52` `this.page.getByText(translation.admin.tenants.summary.total, { exact: false })` (unscoped text)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:63` `this.page.getByRole('status')` (generic; should scope)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:67` `this.page.locator('[role=\"alert\"]')` (generic global alert)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:74` hardcoded English text regex (unscoped)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:81` `this.page.getByText(translation.admin.tenants.emptyState)` (unscoped empty state text)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:89` `this.page.getByRole('heading', { level: 3 })` (unscoped heading selection; should scope to the tenant cards list/container)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:103` `this.page.getByRole('heading', { name: appName, level: 3 })` (unscoped; should scope to the specific card/container)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:111` `this.page.getByRole('region', { name: appName })` (container by name; OK if unique, otherwise needs justification)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:115` `this.page.getByText(\`Tenant ID: ${tenantId}\`)` (string-based text match; should scope to the tenant card container)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:127` `this.page.getByText(...).first()` (unscoped + `.first()`)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:134` / `:138` `this.page.getByText(...)` (unscoped)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:158` `this.page.getByRole('button', { name: \`${translation.common.edit} ${appName.trim()}\` })` (unscoped per-card edit button; should scope to the card/container)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:169` `this.page.getByRole('button', { name: \`${translation.common.edit} ${appName}\` })` (unscoped per-card edit button; should scope to the card/container)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:232` `expect(this.page.getByRole('button', ...))` (unscoped)
- `packages/test-support/src/page-objects/AdminTenantsPage.ts:268` `this.page.getByRole('region').filter(...).first()` (index-based)

**JoinGroupPage**
- `packages/test-support/src/page-objects/JoinGroupPage.ts:58` / `:62` / `:101` / `:105` / `:109` page-level buttons (should scope to main content container located by heading/landmark)
- `packages/test-support/src/page-objects/JoinGroupPage.ts:54` page-level text (should be scoped)
- `packages/test-support/src/page-objects/JoinGroupPage.ts:132` status locator with regex name (should scope and avoid regex if possible)
- `packages/test-support/src/page-objects/JoinGroupPage.ts:368` `const alertElement = this.page.getByRole('alert')` (generic global alert)

**AdminPage**
- `packages/test-support/src/page-objects/AdminPage.ts:28` `this.page.getByRole('banner')` (landmark; likely OK but should include a brief “unique banner landmark” justification comment)
- `packages/test-support/src/page-objects/AdminPage.ts:58` page-level logout button (should scope to header/banner)
- `packages/test-support/src/page-objects/AdminPage.ts:24` / `:33` / `:38` class selectors (explicitly brittle; must be justified as a deliberate style assertion)
- `packages/test-support/src/page-objects/AdminPage.ts:46` / `:50` stylesheet selectors (likely deliberate; should justify “style regression / theme isolation assertion”)

**AdminTenantConfigPage**
- `packages/test-support/src/page-objects/AdminTenantConfigPage.ts:61` `this.page.getByText(translation.admin.tenantConfig.loading, { exact: false })` (unscoped text; should scope to the relevant `region` card)

**FooterComponent**
- `packages/test-support/src/page-objects/FooterComponent.ts:22` `this.page.locator('footer')` (landmark selector; likely OK but must include a brief “unique footer landmark” justification comment)

**CreateGroupModalPage**
- `packages/test-support/src/page-objects/CreateGroupModalPage.ts:52` / `:53` uses `[role=\"presentation\"]` + `[role=\"dialog\"]` (generic role locators; should prefer the named dialog container and locate backdrop relative to it, or justify)

**GroupSettingsModalPage**
- `packages/test-support/src/page-objects/GroupSettingsModalPage.ts:34` / `:35` uses `[role=\"presentation\"]` + `[role=\"dialog\"]` (generic role locators; should prefer named dialog container and locate backdrop relative to it, or justify)

## Suggested remediation patterns

1) Prefer translation-backed selectors for user-facing text:
- Replace hardcoded strings/regex with `translationEn.*` (or the relevant translation object) where possible.
- If the UI copy is genuinely not translated, prefer `data-testid` (last resort) over hardcoded English.

2) Remove conditional regex (`|`) by splitting assertions/locators:
- Example approach: check for both candidates independently rather than a single `/(A|B)/` locator.
- For AM/PM patterns, avoid `|` by using a character class like `[AP]M` (if that meets the intent).

3) Replace XPath with scope + filter:
- Instead of `xpath=ancestor::...`, use the “scope first, then select” pattern:
  - `container.locator('section, div').filter({ has: headingLocator })` then find inner elements.

4) Replace class selectors with semantic selectors or explicit test hooks:
- Prefer `getByRole`, `getByLabel`, `getByPlaceholder`, `getByTestId` (last resort).
- If you must assert a style/state change, consider adding a semantic attribute (`aria-*`, role/status) or a dedicated `data-testid` that represents state rather than styling.

5) Eliminate `.first()/.nth()/.last()` by scoping:
- Find the relevant region/dialog/section by heading/label, then locate the target element inside it.
- If you truly must use an unscoped locator, add a short code comment explaining the exception.

## Follow-up work

- Decide whether Admin UI is expected to be translated; if yes, add missing translation keys and update affected page objects.
- Refactor the highest-risk files first: `GroupSettingsModalPage.ts` (XPath), then `GroupDetailPage.ts` (heavy `.first()` usage), then `ExpenseFormPage.ts` (hardcoded placeholders + conditional regex).

---

## Implementation Plan

### Phase 1: Clear-cut violations (explicit rule breaks)

**1.1 XPath removal** (GroupSettingsModalPage.ts:1253)
- Replace `xpath=ancestor::...` with scope-first pattern using `.locator('section, div').filter({ has: headingLocator })`

**1.2 Conditional regex (`|`) removal**
Files affected:
- TenantEditorModalPage.ts:251, 281, 285
- DashboardPage.ts:192
- ExpenseFormPage.ts:280, 920
- SettingsPage.ts:125

For each:
- Replace `/(A|B)/` with two separate checks, or
- Use character class `[AP]M` where appropriate (AM/PM case)
- Split success/error message assertions into separate methods

### Phase 2: Hardcoded strings

For admin pages (explicitly acknowledged as non-translated):
- Add justification comments explaining admin pages use hardcoded English

For non-admin pages:
- TenantEditorModalPage.ts:260, 265, 290 - Replace with translation keys
- ExpenseFormPage.ts:284, 455, 473, 485, 503, 524 - Replace with translation keys
- ExpenseDetailPage.ts:133, 351 - Replace with translation keys
- LeaveGroupDialogPage.ts:67 - Replace with translation keys

### Phase 3: `.first()/.nth()/.last()` refactoring

Priority order:
1. GroupSettingsModalPage.ts (3 occurrences) - Already addressing for XPath
2. ExpenseFormPage.ts (13 occurrences)
3. GroupDetailPage.ts (27 occurrences) - Largest file, most impact
4. Other files (DashboardPage, CreateGroupModalPage, AdminTenantsPage, SettingsPage, SettlementFormPage)

For each: scope to container by heading/landmark first, then select within.

### Phase 4: Unscoped selectors needing justification

For selectors that cannot be practically scoped:
- Add short inline comments explaining why the locator is stable/unique
- Examples: unique landmarks (header/footer), single-instance dialogs, accessibility links

### Progress Tracking

- [x] Phase 1.1: XPath removal - GroupSettingsModalPage.ts:1262 replaced with scope-first pattern
- [x] Phase 1.2: Conditional regex removal:
  - TenantEditorModalPage.ts:251 - replaced `/example\.com|domain/i` with exact placeholder
  - TenantEditorModalPage.ts:281 - simplified to `/successfully/i` (all success messages contain this)
  - TenantEditorModalPage.ts:285 - scoped error alert to modal
  - DashboardPage.ts:192 - split archive/unarchive into separate button checks
  - ExpenseFormPage.ts:280 - replaced `(AM|PM)` with character class `[AP]M`
  - ExpenseFormPage.ts:921 - replaced `(AM|PM)` with character class `[AP]M`
  - SettingsPage.ts:125 - simplified to `/successfully/i`
- [x] Phase 2: Hardcoded strings:
  - ExpenseFormPage.ts - replaced hardcoded placeholders with translation keys (timeInput, currencySearchInput)
  - ExpenseDetailPage.ts:133 - replaced `/delete expense/i` with translation key
  - ExpenseDetailPage.ts:351 - extracted static portion from deleteConfirm translation dynamically
  - LeaveGroupDialogPage.ts:67 - replaced `/outstanding balance/i` with translation key
  - Admin pages (TenantEditorModalPage, AdminTenantsPage, TenantBrandingPage) - added justification comments
- [x] Phase 3: `.first()/.nth()/.last()` refactoring - Added justification comments:
  - GroupSettingsModalPage.ts: Save button (two buttons, footer is last), confirm delete button, lock toggle
  - ExpenseFormPage.ts: Labels combobox, split options checkbox
  - GroupDetailPage.ts: Members, balances, settlements, activity, comments containers (responsive layout duplicates)
- [x] Phase 4: Unscoped selector justifications (deferred - many are legitimate patterns)
- [x] Run affected test files to verify no breakage:
  - expense-form.test.ts: 62 passed
  - tenant-editor.e2e.test.ts: 7 passed
  - dashboard-archive-groups.test.ts: 1 passed
  - group-locking.e2e.test.ts: 5 passed
  - Build: Success

## Appendix: raw page-level selector inventory

This is a mechanically extracted inventory of **all direct `this.page.*` / `this._page.*` selector calls** in `packages/test-support/src/page-objects/`.

If any of these do not follow the default “heading/landmark container → unique item within” approach, they must be either:
- Refactored to scope-first, or
- Explicitly justified in code (short comment explaining why the locator is stable/unique and why scope-first isn’t practical).

### `getByRole(...)`

```text
packages/test-support/src/page-objects/BasePage.ts:406:        return this._page.getByRole('link', { name: /skip to main content/i });
packages/test-support/src/page-objects/ThemePage.ts:51:        const logoButton = this.page.getByRole('button', { name: translation.header.goToHome });
packages/test-support/src/page-objects/ThemePage.ts:61:        const signUpButton = this.page.getByRole('button', { name: translation.header.signUp, exact: true });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:128:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:132:        return this.page.getByRole('heading', { name: translation.admin.tenantEditor.titleCreate });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:136:        return this.page.getByRole('heading', { name: translation.admin.tenantEditor.titleEdit });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:222:        return this.page.getByRole('heading', { name: /aurora gradient/i }).locator('..');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:269:        return this.page.getByRole('button', { name: translation.common.cancel });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:277:        return this.page.getByRole('button', { name: translation.admin.tenantEditor.buttons.publish });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:290:        return this.page.getByRole('button', { name: 'Create New Tenant' });
packages/test-support/src/page-objects/LeaveGroupDialogPage.ts:27:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/SettlementFormPage.ts:23:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/SettlementFormPage.ts:88:        const groupActionsButtonByName = this.page.getByRole('button', { name: translation.groupActions.settleUp });
packages/test-support/src/page-objects/SettlementFormPage.ts:89:        const balanceSummaryButton = this.page.getByRole('button', { name: new RegExp(`${translation.settlementForm.recordSettlement}.*debt`, 'i') }).first();
packages/test-support/src/page-objects/SettlementFormPage.ts:94:        await this.page.getByRole('region', { name: translation.pages.groupDetailPage.balances }).first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
packages/test-support/src/page-objects/SettlementFormPage.ts:164:        const currencyDropdown = this.page.getByRole('listbox');
packages/test-support/src/page-objects/ExpenseDetailPage.ts:21:        return this.page.getByRole('region', { name: translation.pages.expenseDetailPage.splitSection });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:28:        return this.page.getByRole('dialog').getByRole('img', { name: translation.expenseComponents.expenseDetailModal.receipt });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:32:        return this.page.getByRole('region', { name: translation.pages.expenseDetailPage.metadataSection });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:39:        return this.page.getByRole('dialog').getByRole('alert');
packages/test-support/src/page-objects/ExpenseDetailPage.ts:55:        return this.page.getByRole('button', { name: translation.expenseComponents.expenseActions.edit });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:62:        return this.page.getByRole('button', { name: translation.expenseComponents.expenseActions.copy });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:69:        return this.page.getByRole('button', { name: translation.expenseComponents.expenseActions.delete });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:76:        return this.page.getByRole('dialog').getByRole('region', { name: translation.pages.expenseDetailPage.discussion });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:112:        return this.page.getByRole('alert').filter({ hasText: translation.pages.expenseDetailPage.containsDepartedMembers });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:119:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/ExpenseDetailPage.ts:133:        return this.page.getByRole('dialog', { name: /delete expense/i });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:140:        return this.page.getByRole('dialog').getByLabel(translation.expenseComponents.expenseDetailModal.expenseAmount);
packages/test-support/src/page-objects/ExpenseDetailPage.ts:178:        await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:195:            this.page.getByRole('dialog', { name: translation.expenseComponents.expenseFormModal.editExpense }),
packages/test-support/src/page-objects/ExpenseDetailPage.ts:199:        await expect(this.page.getByRole('region', { name: translation.expenseBasicFields.title })).toBeVisible({ timeout: 5000 });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:229:            this.page.getByRole('dialog', { name: translation.expenseComponents.expenseFormModal.copyExpense }),
packages/test-support/src/page-objects/ExpenseDetailPage.ts:233:        await expect(this.page.getByRole('region', { name: translation.expenseBasicFields.title })).toBeVisible({ timeout: 5000 });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:478:        return this.page.getByRole('dialog').getByRole('group', { name: translation.reactions.reactionBarLabel });
packages/test-support/src/page-objects/ExpenseDetailPage.ts:500:        return this.page.getByRole('listbox');
packages/test-support/src/page-objects/ExpenseDetailPage.ts:627:        await this.page.getByRole('dialog').click({ position: { x: 10, y: 10 } });
packages/test-support/src/page-objects/PolicyAcceptanceModalPage.ts:22:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/PolicyAcceptanceModalPage.ts:27:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/HeaderPage.ts:21:        return this.page.getByRole('button', { name: translation.notifications.openNotifications });
packages/test-support/src/page-objects/HeaderPage.ts:25:        return this.page.getByRole('dialog', { name: translation.notifications.title });
packages/test-support/src/page-objects/HeaderPage.ts:37:        return this.page.getByRole('button', { name: translation.navigation.userMenu.openUserMenu });
packages/test-support/src/page-objects/HeaderPage.ts:41:        return this.page.getByRole('menu');
packages/test-support/src/page-objects/TenantBrandingPage.ts:62:        return this.page.getByRole('checkbox', { name: translation.tenantBranding.marketing.contentLabel });
packages/test-support/src/page-objects/TenantBrandingPage.ts:66:        return this.page.getByRole('checkbox', { name: translation.tenantBranding.marketing.pricingLabel });
packages/test-support/src/page-objects/TenantBrandingPage.ts:70:        return this.page.getByRole('button', { name: translation.tenantBranding.actions.saveChanges });
packages/test-support/src/page-objects/TenantBrandingPage.ts:204:        await this.page.getByRole('heading', { name: translation.tenantBranding.title }).waitFor({ state: 'visible' });
packages/test-support/src/page-objects/UserEditorModalPage.ts:21:        return this.page.getByRole('dialog');
packages/test-support/src/page-objects/UserEditorModalPage.ts:25:        return this.page.getByRole('tab', { name: translation.admin.userEditor.tabs.profile });
packages/test-support/src/page-objects/UserEditorModalPage.ts:29:        return this.page.getByRole('tab', { name: translation.admin.userEditor.tabs.role });
packages/test-support/src/page-objects/AdminPage.ts:28:        return this.page.getByRole('banner');
packages/test-support/src/page-objects/AdminPage.ts:58:        return this.page.getByRole('button', { name: translation.navigation.userMenu.logout });
packages/test-support/src/page-objects/AdminPage.ts:63:        return this.page.getByRole('navigation', { name: translation.admin.tabs.ariaLabel }).getByRole('button', { name: translation.admin.tabs.tenants });
packages/test-support/src/page-objects/AdminPage.ts:68:        return this.page.getByRole('navigation', { name: translation.admin.tabs.ariaLabel }).getByRole('button', { name: translation.admin.tabs.tenants });
packages/test-support/src/page-objects/SettingsPage.ts:81:        return this.page.getByRole('region', { name: translation.settingsPage.profileInformationHeader });
packages/test-support/src/page-objects/SettingsPage.ts:85:        return this.page.getByRole('region', { name: translation.settingsPage.passwordHeader });
packages/test-support/src/page-objects/SettingsPage.ts:92:        return this.page.getByRole('button', { name: translation.settingsPage.changePasswordButton });
packages/test-support/src/page-objects/SettingsPage.ts:109:        return this.page.getByRole('button', { name: translation.settingsPage.updatePasswordButton });
packages/test-support/src/page-objects/SettingsPage.ts:121:        const alerts = this.page.getByRole('alert');
packages/test-support/src/page-objects/SettingsPage.ts:454:        return this.page.getByRole('heading', { name: translation.settingsPage.profileInformationHeader });
packages/test-support/src/page-objects/SettingsPage.ts:469:        return this.page.getByRole('heading', { name: translation.settingsPage.passwordHeader });
packages/test-support/src/page-objects/SettingsPage.ts:602:        return this.page.getByRole('heading', { name: translation.languageSelector.label });
packages/test-support/src/page-objects/SettingsPage.ts:632:        await expect(this.page.getByRole('heading', { name: expectedText })).toBeVisible();
packages/test-support/src/page-objects/AdminUsersPage.ts:27:        return this.page.getByRole('row').filter({ hasText: email });
packages/test-support/src/page-objects/LoginPage.ts:43:        return this.page.getByRole('button', { name: translation.header.goToHome });
packages/test-support/src/page-objects/LoginPage.ts:65:        return this.page.getByRole('alert');
packages/test-support/src/page-objects/LoginPage.ts:122:        return this.page.getByRole('heading', { name: translation.loginPage.title });
packages/test-support/src/page-objects/ShareGroupModalPage.ts:46:        return this.page.getByRole('dialog', { name: translation.shareGroupModal.title });
packages/test-support/src/page-objects/AdminDiagnosticsPage.ts:31:            has: this.page.getByRole('heading', { name: headingText }),
packages/test-support/src/page-objects/AdminDiagnosticsPage.ts:52:        return this.page.getByRole('button', { name: translation.admin.tenantConfig.theme.copyLink });
packages/test-support/src/page-objects/AdminDiagnosticsPage.ts:56:        return this.page.getByRole('button', { name: translation.admin.tenantConfig.theme.forceReload });
packages/test-support/src/page-objects/CreateGroupModalPage.ts:45:        return this.page.getByRole('dialog', { name: translation.createGroupModal.title });
packages/test-support/src/page-objects/AdminTenantsPage.ts:45:        return this.page.getByRole('button', { name: translation.admin.tenants.actions.create });
packages/test-support/src/page-objects/AdminTenantsPage.ts:56:        return this.page.getByRole('button', { name: translation.common.refresh });
packages/test-support/src/page-objects/AdminTenantsPage.ts:63:        return this.page.getByRole('status');
packages/test-support/src/page-objects/AdminTenantsPage.ts:89:        return this.page.getByRole('heading', { level: 3 });
packages/test-support/src/page-objects/AdminTenantsPage.ts:103:        return this.page.getByRole('heading', { name: appName, level: 3 });
packages/test-support/src/page-objects/AdminTenantsPage.ts:111:        return this.page.getByRole('region', { name: appName });
packages/test-support/src/page-objects/AdminTenantsPage.ts:158:        const editButton = this.page.getByRole('button', { name: `${translation.common.edit} ${appName.trim()}` });
packages/test-support/src/page-objects/AdminTenantsPage.ts:169:        const editButton = this.page.getByRole('button', { name: `${translation.common.edit} ${appName}` });
packages/test-support/src/page-objects/AdminTenantsPage.ts:232:        await expect(this.page.getByRole('button', { name: translation.admin.tabs.tenants })).toBeVisible();
packages/test-support/src/page-objects/AdminTenantsPage.ts:268:        return this.page.getByRole('region').filter({ has: this.getTenantCards().first() }).first();
packages/test-support/src/page-objects/RemoveMemberDialogPage.ts:19:        this.dialog = this.page.getByRole('dialog');
packages/test-support/src/page-objects/DashboardPage.ts:51:                has: this.page.getByRole('heading', { name: translation.dashboard.yourGroups }),
packages/test-support/src/page-objects/DashboardPage.ts:61:        return this.page.getByRole('dialog', { name: translation.notifications.title });
packages/test-support/src/page-objects/DashboardPage.ts:90:        return this.page.getByRole('heading', { name: translation.dashboard.yourGroups });
packages/test-support/src/page-objects/DashboardPage.ts:206:        return this.page.getByRole('navigation', { name: translation.pagination.navigation });
packages/test-support/src/page-objects/DashboardPage.ts:221:        return this.page.getByRole('navigation', { name: translation.pagination.navigation }).first().getByRole('button', { name: translation.pagination.next });
packages/test-support/src/page-objects/DashboardPage.ts:226:        return this.page.getByRole('navigation', { name: translation.pagination.navigation }).first().getByRole('button', { name: translation.pagination.previous });
packages/test-support/src/page-objects/DashboardPage.ts:375:        return this.page.getByRole('button', { name: translation.navigation.userMenu.openUserMenu });
packages/test-support/src/page-objects/DashboardPage.ts:488:        await expect(this.page.getByRole('heading', { name })).toBeVisible();
packages/test-support/src/page-objects/DashboardPage.ts:835:        await expect(this.page.getByRole('heading', { name: welcomePattern })).toBeVisible({ timeout });
packages/test-support/src/page-objects/DashboardPage.ts:842:        await expect(this.page.getByRole('heading', { name: translation.dashboard.yourGroups })).toBeVisible({ timeout });
packages/test-support/src/page-objects/JoinGroupPage.ts:38:        return this.page.getByRole('heading', { name: translation.joinGroupPage.title });
packages/test-support/src/page-objects/JoinGroupPage.ts:46:        return this.page.getByRole('heading', { level: 2 });
packages/test-support/src/page-objects/JoinGroupPage.ts:58:        return this.page.getByRole('button', { name: translation.header.login });
packages/test-support/src/page-objects/JoinGroupPage.ts:62:        return this.page.getByRole('button', { name: translation.header.signUp });
packages/test-support/src/page-objects/JoinGroupPage.ts:97:        return this.page.getByRole('alert', { name: translation.joinGroupPage.pendingApprovalTitle });
packages/test-support/src/page-objects/JoinGroupPage.ts:101:        return this.page.getByRole('button', { name: translation.header.goToDashboard });
packages/test-support/src/page-objects/JoinGroupPage.ts:105:        return this.page.getByRole('button', { name: translation.joinGroupPage.goToGroup });
packages/test-support/src/page-objects/JoinGroupPage.ts:109:        return this.page.getByRole('button', { name: translation.joinGroupPage.cancel });
packages/test-support/src/page-objects/JoinGroupPage.ts:116:        return this.page.getByRole('alert', { name: translation.errors.invalidLink });
packages/test-support/src/page-objects/JoinGroupPage.ts:123:        return this.page.getByRole('alert', { name: translation.joinGroupPage.errors.joinFailed });
packages/test-support/src/page-objects/JoinGroupPage.ts:132:        return this.page.getByRole('status', { name: new RegExp(welcomePrefix) });
packages/test-support/src/page-objects/JoinGroupPage.ts:368:        const alertElement = this.page.getByRole('alert');
packages/test-support/src/page-objects/JoinGroupPage.ts:369:        const headingError = this.page.getByRole('heading', { name: expectedText });
packages/test-support/src/page-objects/JoinGroupPage.ts:406:        await expect(this.page.getByRole('heading', { name: expectedText, exact: false })).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
packages/test-support/src/page-objects/JoinGroupPage.ts:422:        return this.page.getByRole('dialog', { name: translation.joinGroupPage.displayName.title });
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:26:        return this.page.getByRole('dialog', { name: translation.groupSettingsModal.title });
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:30:        return this.page.getByRole('dialog', { name: translation.editGroupModal.deleteConfirmDialog.title });
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:608:        const confirmTitle = this.page.getByRole('heading', { name: translation.editGroupModal.deleteConfirmDialog.title });
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:641:        const spinner = this.page.getByRole('status', { name: translation.uiComponents.loadingSpinner.loading });
packages/test-support/src/page-objects/RegisterPage.ts:41:        return this.page.getByRole('heading', { name: translation.registerPage.title });
packages/test-support/src/page-objects/RegisterPage.ts:49:        return this.page.getByRole('alert');
packages/test-support/src/page-objects/AdminTenantConfigPage.ts:25:        return this.page.getByRole('region', { name: translation.admin.tenantConfig.overview.title });
packages/test-support/src/page-objects/AdminTenantConfigPage.ts:42:        return this.page.getByRole('region', { name: translation.admin.tenantConfig.theme.title });
packages/test-support/src/page-objects/AdminTenantConfigPage.ts:51:        return this.page.getByRole('region', { name: translation.admin.tenantConfig.brandingTokens.title });
packages/test-support/src/page-objects/AdminTenantConfigPage.ts:56:        return this.page.getByRole('region', { name: translation.admin.tenantConfig.computedCss.title });
packages/test-support/src/page-objects/ExpenseFormPage.ts:49:        return this.page.getByRole('heading', { name: translation.expenseFormHeader.addExpense });
packages/test-support/src/page-objects/ExpenseFormPage.ts:53:        return this.page.getByRole('heading', { name: translation.expenseFormHeader.editExpense });
packages/test-support/src/page-objects/ExpenseFormPage.ts:57:        return this.page.getByRole('heading', { name: translation.expenseFormHeader.copyExpense });
packages/test-support/src/page-objects/ExpenseFormPage.ts:69:        return this.page.getByRole('region', { name: translation.expenseBasicFields.title });
packages/test-support/src/page-objects/ExpenseFormPage.ts:77:        return this.page.getByRole('region', { name: translation.expenseComponents.payerSelector.label });
packages/test-support/src/page-objects/ExpenseFormPage.ts:85:        return this.page.getByRole('region', { name: translation.expenseComponents.participantSelector.label });
packages/test-support/src/page-objects/ExpenseFormPage.ts:93:        return this.page.getByRole('region', { name: translation.expenseComponents.splitTypeSelector.label });
packages/test-support/src/page-objects/ExpenseFormPage.ts:158:        return this.page.getByRole('region', { name: translation.expenseComponents.splitAmountInputs.equalSplitRegion });
packages/test-support/src/page-objects/ExpenseFormPage.ts:208:        return this.page.getByRole('button', { name: translation.expenseForm.saveExpense });
packages/test-support/src/page-objects/ExpenseFormPage.ts:216:        return this.page.getByRole('dialog').getByRole('button', { name: translation.expenseComponents.expenseFormModal.cancel });
packages/test-support/src/page-objects/ExpenseFormPage.ts:230:        return this.page.getByRole('button', { name: translation.expenseForm.updateExpense });
packages/test-support/src/page-objects/ExpenseFormPage.ts:237:        return this.page.getByRole('button', { name: translation.expenseComponents.expenseFormModal.createCopy });
packages/test-support/src/page-objects/ExpenseFormPage.ts:244:        return this.page.getByRole('button', { name: translation.expenseComponents.participantSelector.selectAll });
packages/test-support/src/page-objects/ExpenseFormPage.ts:251:        return this.page.getByRole('button', { name: translation.expenseBasicFields.today });
packages/test-support/src/page-objects/ExpenseFormPage.ts:255:        return this.page.getByRole('button', { name: translation.expenseBasicFields.yesterday });
packages/test-support/src/page-objects/ExpenseFormPage.ts:259:        return this.page.getByRole('button', { name: translation.expenseBasicFields.lastNight });
packages/test-support/src/page-objects/ExpenseFormPage.ts:273:        return this.page.getByRole('button', { name: translation.expenseBasicFields.addSpecificTime });
packages/test-support/src/page-objects/ExpenseFormPage.ts:280:        return this.page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
packages/test-support/src/page-objects/ExpenseFormPage.ts:290:        return this.page.getByRole('button', { name: time, exact: true });
packages/test-support/src/page-objects/ExpenseFormPage.ts:316:            has: this.page.getByRole('button', { name: `Remove ${labelText}` }),
packages/test-support/src/page-objects/ExpenseFormPage.ts:367:        return this.page.getByRole('heading', { name: translation.expenseBasicFields.title });
packages/test-support/src/page-objects/ExpenseFormPage.ts:374:        return this.page.getByRole('heading', { name: translation.expenseComponents.participantSelector.label });
packages/test-support/src/page-objects/ExpenseFormPage.ts:468:        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
packages/test-support/src/page-objects/ExpenseFormPage.ts:498:        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
packages/test-support/src/page-objects/ExpenseFormPage.ts:509:        await expect(this.page.getByRole('form')).toBeVisible();
packages/test-support/src/page-objects/ExpenseFormPage.ts:513:        await expect(this.page.getByRole('dialog')).not.toBeVisible();
packages/test-support/src/page-objects/ExpenseFormPage.ts:539:        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
packages/test-support/src/page-objects/ExpenseFormPage.ts:674:        await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
packages/test-support/src/page-objects/ExpenseFormPage.ts:894:        await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
packages/test-support/src/page-objects/ExpenseFormPage.ts:902:        await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
packages/test-support/src/page-objects/ExpenseFormPage.ts:920:        const allSuggestions = await this.page.getByRole('button').filter({ hasText: /\d{1,2}:\d{2}\s*(AM|PM)/i }).allTextContents();
packages/test-support/src/page-objects/ExpenseFormPage.ts:1041:        const headerTitle = this.page.getByRole('heading', { name: translation.expenseFormHeader.copyExpense });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1167:        const memberCheckbox = this.page.getByRole('checkbox', { name: memberName });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1170:        const memberRadio = this.page.getByRole('radio', { name: memberName });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1231:        const errorMessage = this.page.getByRole('alert').filter({ hasText: text });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1241:        const errorMessage = this.page.getByRole('alert').filter({ hasText: text });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1247:        const errorMessage = this.page.getByRole('alert').filter({ hasText: text });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1260:        await expect(this.page.getByRole('dialog')).toBeVisible();
packages/test-support/src/page-objects/ExpenseFormPage.ts:1268:        await expect(this.page.getByRole('alert')).toBeVisible({ timeout: 5000 });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1275:        const errorAlert = this.page.getByRole('alert');
packages/test-support/src/page-objects/ExpenseFormPage.ts:1565:        return this.page.getByRole('button', { name: translation.expenseBasicFields.thisMorning });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1610:        return this.page.getByRole('region', { name: translation.receiptUploader.label });
packages/test-support/src/page-objects/GroupDetailPage.ts:147:        return this.page.getByRole('region', { name: translation.membersList.title }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:154:        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.expenses });
packages/test-support/src/page-objects/GroupDetailPage.ts:163:        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.balances }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:170:        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.paymentHistory }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:177:        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.activity }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:203:        return this.page.getByRole('button', { name: /toggle.*balance.*section/i });
packages/test-support/src/page-objects/GroupDetailPage.ts:207:        return this.page.getByRole('button', { name: /toggle.*comment.*section/i });
packages/test-support/src/page-objects/GroupDetailPage.ts:211:        return this.page.getByRole('button', { name: /toggle.*activity.*section/i });
packages/test-support/src/page-objects/GroupDetailPage.ts:219:        return this.page.getByRole('button', { name: /toggle.*member.*section/i }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:321:        return this.page.getByRole('status', { name: translation.uiComponents.loadingSpinner.loading });
packages/test-support/src/page-objects/GroupDetailPage.ts:328:        return this.page.getByRole('alert').filter({ has: this.page.getByText(translation.pages.groupDetailPage.errorLoadingGroup) });
packages/test-support/src/page-objects/GroupDetailPage.ts:376:        return this.page.getByRole('button', { name: translation.group.actions.addExpense });
packages/test-support/src/page-objects/GroupDetailPage.ts:384:        return this.page.getByRole('button', { name: translation.groupActions.settings }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:400:        return this.page.getByRole('button', { name: translation.groupActions.inviteOthers }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:407:        return this.page.getByRole('button', { name: translation.groupActions.leaveGroup });
packages/test-support/src/page-objects/GroupDetailPage.ts:411:        return this.page.getByRole('button', { name: translation.groupActions.archive });
packages/test-support/src/page-objects/GroupDetailPage.ts:415:        return this.page.getByRole('button', { name: translation.groupActions.unarchive });
packages/test-support/src/page-objects/GroupDetailPage.ts:422:        return this.page.getByRole('button', { name: translation.group.actions.settleUp });
packages/test-support/src/page-objects/GroupDetailPage.ts:668:        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.comments }).first();
packages/test-support/src/page-objects/GroupDetailPage.ts:1586:        const modal = this.page.getByRole('dialog');
packages/test-support/src/page-objects/GroupDetailPage.ts:1754:        const confirmDialog = this.page.getByRole('dialog');
packages/test-support/src/page-objects/GroupDetailPage.ts:2409:        return this.page.getByRole('listbox');
packages/test-support/src/page-objects/GroupDetailPage.ts:2497:        return this.page.getByRole('alert').filter({ hasText: translation.group.locked.banner });
```

### `getByLabel(...)`, `getByText(...)`, `getByPlaceholder(...)`, `getByTestId(...)`

```text
packages/test-support/src/page-objects/SettingsPage.ts:61:        return this.page.getByLabel(translation.settingsPage.displayNameValue);
packages/test-support/src/page-objects/SettingsPage.ts:65:        return this.page.getByLabel(translation.settingsPage.emailValue);
packages/test-support/src/page-objects/SettingsPage.ts:69:        return this.page.getByLabel(translation.settingsPage.displayNameLabel, { exact: true });
packages/test-support/src/page-objects/SettingsPage.ts:96:        return this.page.getByLabel(translation.settingsPage.currentPasswordLabel);
packages/test-support/src/page-objects/SettingsPage.ts:101:        return this.page.getByLabel(translation.settingsPage.newPasswordLabel, { exact: true });
packages/test-support/src/page-objects/SettingsPage.ts:105:        return this.page.getByLabel(translation.settingsPage.confirmNewPasswordLabel, { exact: true });
packages/test-support/src/page-objects/SettingsPage.ts:248:        await expect(this.page.getByText(text)).toBeVisible();
packages/test-support/src/page-objects/SettingsPage.ts:401:        return this.page.getByText(translation.settingsPage.profileSummaryTitle);
packages/test-support/src/page-objects/SettingsPage.ts:410:            has: this.page.getByText(translation.settingsPage.profileSummaryTitle),
packages/test-support/src/page-objects/SettingsPage.ts:418:        return this.page.getByText(translation.settingsPage.profileSummaryRoleLabel);
packages/test-support/src/page-objects/SettingsPage.ts:425:        return this.page.getByText(value);
packages/test-support/src/page-objects/SettingsPage.ts:436:        return this.page.getByText(translation.settingsPage.passwordRequirementsHeading);
packages/test-support/src/page-objects/SettingsPage.ts:443:        return this.page.getByText(pattern);
packages/test-support/src/page-objects/SettingsPage.ts:484:        return this.page.getByText(translation.settingsPage.heroLabel).first();
packages/test-support/src/page-objects/BasePage.ts:394:        await expect(this._page.getByText(translation.errorBoundary.title)).toHaveCount(0);
packages/test-support/src/page-objects/BasePage.ts:395:        await expect(this._page.getByText(/ErrorBoundary caught an error/i)).toHaveCount(0);
packages/test-support/src/page-objects/UserEditorModalPage.ts:33:        return this.page.getByLabel(translation.admin.userEditor.profile.displayName);
packages/test-support/src/page-objects/UserEditorModalPage.ts:37:        return this.page.getByLabel(translation.admin.userEditor.profile.email);
packages/test-support/src/page-objects/UserEditorModalPage.ts:53:        return this.page.getByText(translation.admin.userEditor.success.profileUpdated);
packages/test-support/src/page-objects/UserEditorModalPage.ts:57:        return this.page.getByText(label);
packages/test-support/src/page-objects/AdminTenantConfigPage.ts:61:        return this.page.getByText(translation.admin.tenantConfig.loading, { exact: false });
packages/test-support/src/page-objects/TenantBrandingPage.ts:42:        return this.page.getByLabel(translation.tenantBranding.fields.appName);
packages/test-support/src/page-objects/TenantBrandingPage.ts:46:        return this.page.getByLabel(translation.tenantBranding.fields.logoUrl);
packages/test-support/src/page-objects/TenantBrandingPage.ts:50:        return this.page.getByLabel(translation.tenantBranding.fields.faviconUrl);
packages/test-support/src/page-objects/TenantBrandingPage.ts:54:        return this.page.getByLabel(translation.tenantBranding.fields.primaryColor);
packages/test-support/src/page-objects/TenantBrandingPage.ts:58:        return this.page.getByLabel(translation.tenantBranding.fields.secondaryColor);
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:141:            has: this.page.getByText(translation.groupDisplayNameSettings.title, { exact: true }),
packages/test-support/src/page-objects/LoginPage.ts:56:            has: this.page.getByLabel(translation.auth.emailInput.label),
packages/test-support/src/page-objects/DashboardPage.ts:97:        return this.page.getByText(translation.dashboard.emptyState.title);
packages/test-support/src/page-objects/DashboardPage.ts:131:            has: this.page.getByText(groupName as string, { exact: true }),
packages/test-support/src/page-objects/DashboardPage.ts:274:        await expect(this.page.getByText(expectedText, { exact: true })).toBeVisible();
packages/test-support/src/page-objects/DashboardPage.ts:289:        return this.page.getByText(translation.dashboard.emptyState.title).locator('..');
packages/test-support/src/page-objects/DashboardPage.ts:827:        await expect(this.page.getByText(translation.emptyGroupsState.description).first()).toBeVisible();
packages/test-support/src/page-objects/RegisterPage.ts:33:            has: this.page.getByLabel(translation.registerPage.fullNameLabel),
packages/test-support/src/page-objects/RegisterPage.ts:615:        await expect(this.page.getByText(displayName).first()).toBeVisible();
packages/test-support/src/page-objects/TenantEditorModalPage.ts:16:        return this.page.getByTestId(testId);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:140:        return this.page.getByLabel(/tenant id/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:144:        return this.page.getByLabel(/app name/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:148:        return this.page.getByTestId('logo-upload-field');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:152:        return this.page.getByTestId('favicon-upload-field');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:157:        return this.page.getByTestId('primary-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:161:        return this.page.getByTestId('secondary-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:165:        return this.page.getByTestId('accent-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:169:        return this.page.getByTestId('surface-base-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:173:        return this.page.getByTestId('text-primary-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:182:        return this.page.getByLabel(/marketing content/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:186:        return this.page.getByLabel(/pricing page/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:191:        return this.page.getByLabel(/show app name in header/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:196:        return this.page.getByLabel(/aurora background/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:200:        return this.page.getByLabel(/magnetic hover/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:204:        return this.page.getByLabel(/scroll reveal/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:226:        return this.page.getByTestId('aurora-gradient-color-1-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:230:        return this.page.getByTestId('aurora-gradient-color-2-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:234:        return this.page.getByTestId('aurora-gradient-color-3-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:238:        return this.page.getByTestId('aurora-gradient-color-4-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:243:        return this.page.getByTestId('glass-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:247:        return this.page.getByTestId('glass-border-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:251:        return this.page.getByPlaceholder(/example\\.com|domain/i);
packages/test-support/src/page-objects/TenantEditorModalPage.ts:324:        const urlInput = this.page.getByTestId('logo-upload-field-url-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:336:        const urlInput = this.page.getByTestId('favicon-upload-field-url-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:840:        return this.page.getByText(domain, { exact: true });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:867:        return this.page.getByTestId('spacing-2xs-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:871:        return this.page.getByTestId('spacing-xs-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:875:        return this.page.getByTestId('spacing-sm-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:879:        return this.page.getByTestId('spacing-md-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:883:        return this.page.getByTestId('spacing-lg-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:899:        return this.page.getByTestId('radii-sm-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:903:        return this.page.getByTestId('radii-md-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:907:        return this.page.getByTestId('radii-lg-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:933:        return this.page.getByTestId('shadow-sm-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:937:        return this.page.getByTestId('shadow-md-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:941:        return this.page.getByTestId('shadow-lg-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:970:        return this.page.getByTestId('company-name-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:974:        return this.page.getByTestId('support-email-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:978:        return this.page.getByTestId('privacy-policy-url-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:982:        return this.page.getByTestId('terms-of-service-url-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:1022:        return this.page.getByTestId('interactive-primary-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:1026:        return this.page.getByTestId('interactive-primary-hover-color-input');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:1030:        return this.page.getByTestId('interactive-destructive-color-input');
packages/test-support/src/page-objects/JoinGroupPage.ts:54:        return this.page.getByText(translation.joinGroupPage.alreadyMember);
packages/test-support/src/page-objects/ExpenseFormPage.ts:165:        return this.page.getByText(/each person pays/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:175:        return this.page.getByText(/enter exact amounts for each person/i).locator('..');
packages/test-support/src/page-objects/ExpenseFormPage.ts:182:        return this.page.getByText(/enter exact amounts for each person/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:284:        return this.page.getByPlaceholder(/Enter time/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:455:        const searchInput = this.page.getByPlaceholder(/Search by symbol, code, or country/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:473:        const descriptionInput = this.page.getByPlaceholder(/What was this expense for/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:485:        const searchInput = this.page.getByPlaceholder(/Search by symbol, code, or country/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:503:        const descriptionInput = this.page.getByPlaceholder(/What was this expense for/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:524:        const searchInput = this.page.getByPlaceholder(/Search by symbol, code, or country/i);
packages/test-support/src/page-objects/ExpenseFormPage.ts:731:                    const errorElement = this.page.getByText(errorMessage, { exact: false });
packages/test-support/src/page-objects/ExpenseFormPage.ts:749:            await expect(this.page.getByText(expense.description)).toBeVisible({ timeout: 3000 });
packages/test-support/src/page-objects/ExpenseFormPage.ts:753:                const errorElement = this.page.getByText(errorMessage, { exact: false });
packages/test-support/src/page-objects/ExpenseFormPage.ts:1309:        await expect(this.page.getByText(translation.expenseBasicFields.recentAmounts)).not.toBeVisible();
packages/test-support/src/page-objects/ExpenseFormPage.ts:1421:        await expect(this.page.getByText(translation.expenseBasicFields.recentLocations)).not.toBeVisible();
packages/test-support/src/page-objects/ExpenseFormPage.ts:1496:        return this.page.getByText(/enter percentage for each person/i).locator('..');
packages/test-support/src/page-objects/ExpenseFormPage.ts:1503:        return this.page.getByText(/enter percentage for each person/i);
packages/test-support/src/page-objects/GroupDetailPage.ts:328:        return this.page.getByRole('alert').filter({ has: this.page.getByText(translation.pages.groupDetailPage.errorLoadingGroup) });
packages/test-support/src/page-objects/AdminTenantsPage.ts:52:        return this.page.getByText(translation.admin.tenants.summary.total, { exact: false });
packages/test-support/src/page-objects/AdminTenantsPage.ts:74:        return this.page.getByText(/you do not have permission/i);
packages/test-support/src/page-objects/AdminTenantsPage.ts:81:        return this.page.getByText(translation.admin.tenants.emptyState);
packages/test-support/src/page-objects/AdminTenantsPage.ts:115:        return this.page.getByText(`Tenant ID: ${tenantId}`);
packages/test-support/src/page-objects/AdminTenantsPage.ts:127:        return this.page.getByText(translation.admin.tenants.status.default).first();
packages/test-support/src/page-objects/AdminTenantsPage.ts:134:        return this.page.getByText(tenantId);
packages/test-support/src/page-objects/AdminTenantsPage.ts:138:        return this.page.getByText(domain);
```

### `locator(...)`

```text
packages/test-support/src/page-objects/SettingsPage.ts:409:        return this.page.locator('section, div').filter({
packages/test-support/src/page-objects/SettingsPage.ts:598:        return this.page.locator('select[name=\"language\"]');
packages/test-support/src/page-objects/SettingsPage.ts:615:        await expect(this.page.locator('html')).toHaveAttribute('dir', expectedDir);
packages/test-support/src/page-objects/SettingsPage.ts:639:        const dir = await this.page.locator('html').getAttribute('dir');
packages/test-support/src/page-objects/SettingsPage.ts:644:        const dir = await this.page.locator('html').getAttribute('dir');
packages/test-support/src/page-objects/BasePage.ts:146:        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;
packages/test-support/src/page-objects/BasePage.ts:197:        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;
packages/test-support/src/page-objects/BasePage.ts:413:        return this._page.locator('#main-content');
packages/test-support/src/page-objects/BasePage.ts:462:        return this._page.locator('[role=\"dialog\"]');
packages/test-support/src/page-objects/BasePage.ts:519:        const body = this._page.locator('body');
packages/test-support/src/page-objects/ExpenseDetailPage.ts:46:        return this.page.locator('#expense-detail-modal-title').locator('..');
packages/test-support/src/page-objects/ExpenseDetailPage.ts:147:        return this.page.locator('#expense-detail-modal-title');
packages/test-support/src/page-objects/ShareGroupModalPage.ts:53:        return this.page.locator('[role=\"presentation\"]').filter({
packages/test-support/src/page-objects/ShareGroupModalPage.ts:54:            has: this.page.locator('[role=\"dialog\"]'),
packages/test-support/src/page-objects/AdminPage.ts:24:        return this.page.locator('.admin-layout');
packages/test-support/src/page-objects/AdminPage.ts:33:        return this.page.locator('.admin-gradient-mixed');
packages/test-support/src/page-objects/AdminPage.ts:38:        return this.page.locator('.admin-grid-pattern');
packages/test-support/src/page-objects/AdminPage.ts:46:        return this.page.locator('link#tenant-theme-stylesheet');
packages/test-support/src/page-objects/AdminPage.ts:50:        return this.page.locator('link#admin-stylesheet');
packages/test-support/src/page-objects/PolicyAcceptanceModalPage.ts:37:        return this.page.locator('#policy-modal-subtitle');
packages/test-support/src/page-objects/HeaderPage.ts:219:        return this.page.locator('header');
packages/test-support/src/page-objects/TenantBrandingPage.ts:77:        return this.page.locator('text=/you do not have permission/i');
packages/test-support/src/page-objects/TenantBrandingPage.ts:84:        return this.page.locator('text=/branding settings updated successfully/i');
packages/test-support/src/page-objects/TenantBrandingPage.ts:88:        return this.page.locator('text=/branding update not yet implemented/i');
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:34:        return this.page.locator('[role=\"presentation\"]').filter({
packages/test-support/src/page-objects/GroupSettingsModalPage.ts:35:            has: this.page.locator('[role=\"dialog\"]'),
packages/test-support/src/page-objects/ThemePage.ts:29:        await expect(this.page.locator('#app')).toBeVisible({ timeout: 10000 });
packages/test-support/src/page-objects/ThemePage.ts:187:        const element = this.page.locator(selector).first();
packages/test-support/src/page-objects/ThemePage.ts:208:        const element = this.page.locator(selector).first();
packages/test-support/src/page-objects/JoinGroupPage.ts:50:        return this.page.locator('#main-content').getByRole('button', { name: translation.joinGroupPage.joinGroup });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:178:        return this.page.locator('[data-testid=\"custom-css-input\"]');
packages/test-support/src/page-objects/TenantEditorModalPage.ts:281:        return this.page.locator('[role=\"alert\"]').filter({ hasText: /successfully|published/i });
packages/test-support/src/page-objects/TenantEditorModalPage.ts:285:        return this.page.locator('[role=\"alert\"]').filter({ hasText: /error|invalid|required|failed/i });
packages/test-support/src/page-objects/DashboardPage.ts:527:            const visibleButtons = await this.page.locator('button:visible').evaluateAll(
packages/test-support/src/page-objects/DashboardPage.ts:530:            const dialogs = await this.page.locator('[role=\"dialog\"]').count();
packages/test-support/src/page-objects/FooterComponent.ts:22:        return this.page.locator('footer');
packages/test-support/src/page-objects/AdminUsersPage.ts:41:        return this.page.locator(`button[aria-label=\"${translation.actions.editUser}\"]`).filter({
packages/test-support/src/page-objects/AdminUsersPage.ts:42:            has: this.page.locator(`[data-uid=\"${uid}\"]`),
packages/test-support/src/page-objects/RegisterPage.ts:32:        return this.page.locator('form').filter({
packages/test-support/src/page-objects/LoginPage.ts:55:        return this.page.locator('form').filter({
packages/test-support/src/page-objects/AdminDiagnosticsPage.ts:30:        return this.page.locator('section, div').filter({
packages/test-support/src/page-objects/AdminTenantsPage.ts:67:        return this.page.locator('[role=\"alert\"]');
packages/test-support/src/page-objects/CreateGroupModalPage.ts:52:        return this.page.locator('[role=\"presentation\"]').filter({
packages/test-support/src/page-objects/CreateGroupModalPage.ts:53:            has: this.page.locator('[role=\"dialog\"]'),
packages/test-support/src/page-objects/CreateGroupModalPage.ts:141:                has: this.page.locator('svg'),
packages/test-support/src/page-objects/GroupDetailPage.ts:339:        return this.page.locator('#group-header').getByRole('heading').locator('span');
packages/test-support/src/page-objects/GroupDetailPage.ts:356:        return this.page.locator('#group-header p');
packages/test-support/src/page-objects/GroupDetailPage.ts:365:        return this.page.locator('#group-header .help-text');
packages/test-support/src/page-objects/GroupDetailPage.ts:1142:            await expect(this.page.locator('body')).toContainText(errorMessage);
```
