# Page Object Locator Review

Goal: audit Playwright page objects for locator quality and list improvements that better mirror user-visible cues.

## Plan
- Understand shared POM patterns and locator helpers (BasePage and utilities).
- Review page objects for brittle or non-user-centric selectors.
- Capture recommended locator improvements without changing code.

## Progress
- [x] Patterns reviewed
- [x] Page objects audited
- [x] Recommendations recorded

## Findings
- Admin page (packages/test-support/src/page-objects/AdminPage.ts:22-65) relies on layout classes and the first button rather than headings/roles; should scope to visible admin nav labels instead of `.admin-*` and `.first()`.
- Admin tenant config (packages/test-support/src/page-objects/AdminTenantConfigPage.ts:24-72) climbs to cards via XPath + `rounded-xl` classes and then `p.font-*`; could scope to sections/definition lists by heading text instead of styling hooks.
- Admin tenants (packages/test-support/src/page-objects/AdminTenantsPage.ts:110-160) finds cards via heading then `rounded-xl` ancestor and uses `.first()` edit buttons; should scope actions within the named card or row rather than positional/class-based selection.
- Settings page (packages/test-support/src/page-objects/SettingsPage.ts:60-82,418-430) reads profile values via `.rounded-lg`/`.font-medium` and grabs avatar with `[class*="rounded-full"]`; better to locate by visible labels/headings inside the profile summary.
- Expense form (packages/test-support/src/page-objects/ExpenseFormPage.ts:150-160) scopes equal-split container with `bg-surface-muted` ancestor; prefer scoping by the split instruction heading/region instead of theme classes.
- Expense detail modal (packages/test-support/src/page-objects/ExpenseDetailPage.ts:38-40,136-142) uses `.text-semantic-error` and `.text-4xl` to find alert/amount; should use roles/headings (e.g., alert region, amount aria-label) rather than font classes.
- Group settings modal (packages/test-support/src/page-objects/GroupSettingsModalPage.ts:211-215,983-1009) uses `.border-t` to reach footer and `shadow-sm` to assert preset selection; need aria/label-based targeting or state attributes on preset buttons and footers.
- Header menu (packages/test-support/src/page-objects/HeaderPage.ts:120-123) extracts user name via `.text-sm.font-medium`; should read the accessible name/label on the user menu button.
- Group detail members (packages/test-support/src/page-objects/GroupDetailPage.ts:461-472) target `li[data-member-name=...]`; should scope to the members list region and match visible member names instead of data attributes.
- Tenant editor modal (packages/test-support/src/page-objects/TenantEditorModalPage.ts:15-39,143-244) leans on test IDs for section toggles and color inputs; prefer using section headings + visible field labels/aria-labels so selectors mirror what a user sees.

## Recommendations

### 1. AdminPage.ts (lines 22-65)
**POM changes:**
- Replace `getFirstButton()` `.first()` with specific named selector: `getByRole('button', { name: translation.admin.tabs.tenants })`
- Replace `getAdminButton()` `.first()` by selecting tabs by their visible name

**No component changes needed** - admin nav already has aria-label.

### 2. AdminTenantConfigPage.ts (lines 24-72)
**POM changes:**
- Keep heading-based card scoping (good pattern)
- Replace XPath `xpath=ancestor::div[contains(@class, "rounded-xl")]` with semantic container roles or test IDs on card components
- Replace `p.font-mono` class selectors with `getByText()` or aria-label selection

**Component changes:**
- Add `aria-label` to value containers: `<span aria-label="Tenant ID value">{tenantId}</span>`

### 3. AdminTenantsPage.ts (lines 110-160)
**POM changes:**
- Replace `clickEditButtonForFirstTenant()` `.first()` with scoped selection: find first tenant heading, then edit button within that card
- Use existing pattern from line 170: `getByRole('button', { name: \`Edit ${appName}\` })`

**Component changes:**
- Ensure all edit buttons have `aria-label={`Edit ${tenantName}`}`

### 4. SettingsPage.ts (lines 60-82, 418-430)
**POM changes:**
- Use heading-based scoping via existing `getProfileSection()` method
- Replace `.rounded-lg` and `.font-medium.text-text-primary` class selectors with visible label text matching
- Replace `[class*="rounded-full"]` avatar selector with `role="img"` + `aria-label`

**Component changes:**
- Add `role="img" aria-label="User avatar"` to Avatar component

### 5. ExpenseFormPage.ts (lines 150-160)
**POM changes:**
- Keep the good `getByText(/each person pays/i)` starting point
- Replace XPath `xpath=ancestor::div[contains(@class, "bg-surface-muted")]` by scoping "How to Split" section by its heading, then finding instruction text within

**Component changes:**
- Wrap split instruction container in `<div role="region" aria-label="Split instructions">`

### 6. ExpenseDetailPage.ts (lines 38-40, 136-142)
**POM changes:**
- Replace `.text-semantic-error` with `getByRole('alert')` or `getByRole('status')`
- Replace `.text-4xl` amount selector with aria-label based selection

**Component changes:**
- Add `role="alert"` to error container in ExpenseDetailModal
- Add `aria-label="Expense amount"` to amount display element

### 7. GroupSettingsModalPage.ts (lines 211-215, 983-1009)
**POM changes:**
- Replace `.border-t` footer selector with semantic role or aria-label targeting
- Replace `/shadow-sm/` CSS class state detection with `aria-pressed` attribute check

**Component changes:**
- Add `role="region" aria-label="Security settings footer"` to footer
- Add `aria-pressed={isSelected}` to preset buttons

### 8. HeaderPage.ts (lines 120-123)
**POM changes:**
- Replace `.text-sm.font-medium` with aria-label selection
- Alternative: Include user name in button's overall aria-label

**Component changes:**
- Add `aria-label="Your display name"` or `data-testid="user-display-name"` to name element in UserMenuButton

### 9. GroupDetailPage.ts (lines 461-472)
**POM changes:**
- Replace `li[data-member-name="${memberName}"]` with `getByRole('listitem', { name: memberName })`
- Alternative: Use visible text filter `.locator('li').filter({ hasText: memberName })`

**Component changes:**
- Add `aria-label={memberName}` to member list `<li>` elements

### 10. TenantEditorModalPage.ts (lines 15-39, 143-244)
**Assessment:** Test IDs are justified here due to duplicate labels across sections (multiple "Primary Color" inputs). This is an acceptable use case per the testing guide.

**Optional improvements:**
- Add contextual `aria-label` to color inputs: `aria-label="Primary color - Brand Colors section"`
- This would allow semantic selection: `getByLabel(/primary color.*brand colors/i)`

## Priority

| Priority | File | Effort |
|----------|------|--------|
| High | ExpenseDetailPage | Low |
| High | GroupSettingsModalPage | Medium |
| High | HeaderPage | Low |
| Medium | AdminTenantConfigPage | Medium |
| Medium | SettingsPage | Low |
| Medium | ExpenseFormPage | Low |
| Medium | AdminTenantsPage | Low |
| Medium | GroupDetailPage | Low |
| Low | AdminPage | Low |
| Low | TenantEditorModalPage | Optional |
