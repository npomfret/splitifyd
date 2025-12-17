# POM Selector / Locator Audit

## Scope

Audited all Page Object Models in `packages/test-support/src/page-objects/` with the project’s Playwright rules in `docs/guides/testing.md`:

- Prefer user-visible cues: roles, labels, headings, link/button names.
- Avoid implementation shortcuts: CSS classes, XPath, structural DOM traversal, and brittle attribute selectors.
- i18n resilience: do not hardcode user-facing strings; prefer `translationEn` imports.
- Page objects should not expose public locator getters.

## High-Level Findings

The overall direction is good: many POMs already use `getByRole(...)` with `translationEn`, plus container scoping. The biggest remaining issues fall into a few repeatable patterns:

- **Hardcoded English strings** in locators (breaks i18n and “user cue” principle).
- **CSS class selectors / XPath / DOM traversal** (e.g., `.locator('..')`, `xpath=ancestor::...`, `.admin-layout`, `.rounded-xl`).
- **Attribute substring matching** (e.g., `aria-label*="Invite"` / `aria-label*="settlement"`), which is fragile and not i18n-safe.
- **Overuse of `data-testid`** in admin tenant editor where visible labels likely exist (or should exist).
- **Positional selectors** (`.first()`, `.nth()`) in places where the element could be found by visible text/label instead.
- **Public locator getter methods** (explicitly prohibited by the testing guide).

## Recommended Global Changes (Patterns)

### 1) Name regions and dialogs so tests can use roles

If a section is visually a “card/section”, give it a reliable accessible name:

- Wrap in `<section aria-labelledby="...">` (or `role="region"` + `aria-label`)
- Then POM can do `page.getByRole('region', { name: translation... })`

For modals:

- Ensure dialogs have `aria-labelledby` pointing at the title element
- Then POM can do `page.getByRole('dialog', { name: translation... })` (no `locator('[role="dialog"]').filter(...)`)

### 2) Replace hardcoded strings with `translationEn`

Any `getByText('...')`, `{ name: '...' }`, or regex that encodes English should be replaced with translation keys, even if only used for verification.

### 3) Avoid class selectors and XPath

If a locator requires `.some-class` or `xpath=...` to “find the container”, that’s a sign the UI is missing a semantic landmark. Prefer adding a named region/role to the container rather than encoding layout.

### 4) Prefer “user identity” over “DOM identity”

For list items (expenses, debts, comments):

- Prefer `getByRole('listitem' | 'article')` scoped to a named list/region + filter by **visible text**.
- Avoid reliance on `data-*` attributes like `[data-event-type]` or `[data-financial-amount]` unless the UI exposes no user-facing way to identify it.

### 5) Admin Tenant Editor: replace `data-testid` with labels (or add labels)

Color inputs, asset upload fields, and token editors should be accessible and testable via labels:

- `getByLabel(translation.admin.tenantEditor...fieldLabel)`
- Only use `getByTestId(...)` if there is no meaningful label/role (and adding one is not reasonable).

## File-by-File Recommendations

### `packages/test-support/src/page-objects/SettlementFormPage.ts`

- `:39` `input[inputmode="decimal"]` → prefer `getByLabel(...)` or `getByRole('spinbutton', { name: translation... })`. If the amount input has no label, add one in the UI.
- `:43` `button[aria-label*="currency"]` → prefer exact accessible name using translation; avoid substring match. If needed, add a proper label (“Currency”) and use `getByLabel(...)`.
- `:52`/`:57` `button[type="submit"]` → prefer `getByRole('button', { name: translation.settlementForm.recordSettlement | updateSettlement })`.
- `:73` `getByText('Quick settle:')` → replace with a translation key and/or prefer a named region/heading.

### `packages/test-support/src/page-objects/SettingsPage.ts`

- `:81`/`:87` `locator('section, div').filter({ has: heading })` → consider adding `aria-labelledby` to the section containers so this becomes `getByRole('region', { name: ... })`.
- `:405`, `:419`, `:437`, `:494`, `:466`, `:480` hardcoded strings/headings → replace with `translationEn` keys (add missing keys if necessary).
- `:412` `getByRole('img').first()` → too generic; prefer a named avatar (`alt`/`aria-label`) or a labeled container in the UI.
- `:618` `select[name="language"]` → prefer `getByLabel(translation.languageSelector.label)` (or add label/association).

### `packages/test-support/src/page-objects/LoginPage.ts`

- `:55` scoping via `locator('form')` is fine, but prefer `getByRole('form', { name: ... })` if the form can be given an accessible name.
- `:90` `getByLabel('Remember me')` → replace with translation key.
- `:123` `locator('../..')` to reach the heading → avoid DOM traversal; prefer locating heading by role/name directly, or name the card/region.

### `packages/test-support/src/page-objects/RegisterPage.ts`

- `:542` `locator('button[type="submit"]').getByRole('status')` → scope spinner to `this.getSubmitButton()` instead of a type selector.

### `packages/test-support/src/page-objects/DashboardPage.ts`

- `:49-53` `locator('section, div').filter({ has: heading })` → prefer named region/section for “Your Groups”.
- `:60` `section[aria-labelledby="activity-feed-heading"]:visible` → prefer `getByRole('region', { name: translation... })` (use `aria-label`/`aria-labelledby` in UI, but avoid hardcoding IDs in tests).
- `:276` `getByText(...).locator('..')` and `:283-285` public `getEmptyGroupsState()` locator → avoid DOM traversal and public locator exposure. Prefer a named region for empty state.
- `:291` `/create.*group/i` → use translation.
- `:369` `button[title*="Invite"], button[aria-label*="Invite"]` → replace with `getByRole('button', { name: translation.groupActions.inviteOthers })` scoped to the group card; avoid substring matching.
- Many `buttonName: '...'` strings passed only for error context → prefer passing translation strings for consistency/i18n.

### `packages/test-support/src/page-objects/CreateGroupModalPage.ts`

- `:45-48` `locator('[role="dialog"]').filter({ has: heading })` → prefer `getByRole('dialog', { name: translation.createGroupModal.title })` once the dialog is properly named via `aria-labelledby`.
- `:78` `input[name="name"]` → prefer `getByLabel(...)`. If the field is intentionally unlabeled, add a label so tests follow user cues.
- `:83-92` label regexes like `/display name in this group/i` and `/description/i` → replace with translation keys.

### `packages/test-support/src/page-objects/ExpenseFormPage.ts`

Main theme: several selectors rely on English instruction text, placeholders, DOM traversal, and “generic decimal inputs”.

- `:100` placeholder regex for description → prefer label-based selector with translation (or add label).
- `:114` `/currency/i` label regex → prefer translation key.
- `:161`, `:178`, `:171-172`, `:1484` English instruction text selectors + `.locator('..')` → replace with translation keys and ideally a semantic container (`role="region"` with name).
- `:186`, `:1498` `input[inputmode="decimal"]` / `input[type="text"][inputmode="decimal"]` → prefer inputs labeled per member (user selects “Alice” field, not “nth input”).
- `:617` `label.locator('input[type="checkbox"]')` → prefer `getByRole('checkbox', { name: memberName })` when feasible.
- `:1647` `[aria-label="Loading"]` → prefer `getByRole('status', { name: translation.uiComponents.loadingSpinner.loading })`.

### `packages/test-support/src/page-objects/ExpenseDetailPage.ts`

- `:46` `#expense-detail-modal-title` then `..` → prefer `getByRole('dialog', { name: ... })` or `getByRole('heading', { name: ... })` with clear scoping; avoid DOM traversal.
- `:479` reaction bar selected by `.flex.justify-center.border-b` → replace with a semantic hook (e.g., add `aria-label="Reactions"` region) and locate by role/name.
- `:644` comment reaction bar by `[class*="inline-flex"][class*="gap-1"]` → same fix: add semantic label/region or locate relative to the “Add reaction” button without class selectors.

### `packages/test-support/src/page-objects/GroupDetailPage.ts`

Several places are very close to ideal (named regions for sections), but a few locators still encode DOM/CSS or internal data.

- `:335` `#group-header ... locator('span')` and `:361` `#group-header .help-text` → add semantic labels (e.g., a named region for group header, and labeled elements for “Group stats” and “Group description”).
- `:630` hardcoded `Load More` → replace with translation key.
- `:884` comment reaction bar uses `[class*="inline-flex"]...` → same fix as expense detail: semantic label/region.
- `:1017-1022` settlement button selected by `button[aria-label*="settlement"]` → prefer `getByRole('button', { name: translation.settlementForm.recordSettlement })` (or equivalent); ensure the button’s accessible name is translation-based.
- `:1421`, `:1480` `[data-financial-amount="debt"]` → prefer verifying visible formatted amount text; if ambiguous, add an accessible label for the amount element.
- `:2324` activity feed item by `[data-event-type="..."]` → prefer asserting on the user-visible feed text (or add an accessible label that corresponds to what the user reads, not internal event type).

### `packages/test-support/src/page-objects/GroupSettingsModalPage.ts`

- `:853` hardcoded “No pending requests right now.” → use translation key.
- `:478` delete confirm input by `input[type="text"]` → prefer `getByLabel(...)` with translation (or add a label like “Type group name to confirm”).
- `:1235` `label[for="group-lock-toggle"]` and `:1245` XPath ancestor/class search → strongly recommend making the visible switch track the actual accessible `role="switch"` element (clickable + named), then use `getByRole('switch', { name: ... })`.
- `:723`/`:733` `getByTestId('input-error-message')` → prefer role/aria (`role="alert"`, `aria-describedby`) over test IDs if the UI already exposes it.
- `:820-846` public locator methods (e.g., `getDisplayNameSaveButtonLocator()`) → prohibited; should be removed/kept private and replaced with verification/action methods.

### `packages/test-support/src/page-objects/ShareGroupModalPage.ts`

- `:46-48` modal container via `[role="dialog"]` + `#share-modal-title` filter → prefer named dialog `getByRole('dialog', { name: translation... })`.
- `:64` copy success icon selected by `svg.text-semantic-success` → avoid class selector; prefer verifying a user-visible success cue (toast text, status message) or add a `role="status"` message for “Copied”.
- `:104` QR code selected via `canvas` → consider adding an accessible label or wrapping in a named region.

### `packages/test-support/src/page-objects/LeaveGroupDialogPage.ts`

- `:53` `locator('h3')` → prefer `getByRole('heading', { name: translation... })`.
- `:67` `/outstanding balance/i` and `:101-104` string includes checks → replace with translation-driven checks.
- `:91` warning icon via `locator('svg').first()` → prefer a labeled icon (`aria-label`) or verify the visible warning text.

### `packages/test-support/src/page-objects/PolicyAcceptanceModalPage.ts`

This file has several direct class selectors that conflict with the “no CSS selectors/classes” rule:

- `:48` `.rounded-xl`, `:65` `.bg-surface-muted.rounded-lg`, `:75` `.bg-semantic-info-subtle`

Recommendation: add semantic landmarks:

- A named region for the policy card (`role="region"`, name = current policy title)
- A named region for the acceptance section (`role="group"`/`region"`, name = translation.acceptanceRequiredHeading)
- Then locate via `getByRole(...)` rather than classes.

### `packages/test-support/src/page-objects/HeaderPage.ts`

- `:123` reading display name via `.locator('p').first()` → avoid relying on tag order. Prefer a labeled element for display name (e.g., `aria-label="Display name"`) or a dedicated wrapper with a semantic label.

### `packages/test-support/src/page-objects/FooterComponent.ts`

- `:22` `locator('footer')` is OK (semantic element).
- `:34` `.locator('p').last()` for copyright is positional/structural; prefer locating by visible text pattern (e.g., contains “©”) or add an accessible label/test id if needed.

### `packages/test-support/src/page-objects/AdminPage.ts`

Multiple class-based selectors should be replaced:

- `:23`, `:27`, `:31`, `:35` `.admin-*` selectors → prefer `getByRole('main')`, `getByRole('banner')`, or a named navigation region.
- `:215` `img[alt*="BillSplit"]` → avoid hardcoded brand; prefer checking by translation/app name, or check for absence of any tenant-branded logo container by semantic marker.

### `packages/test-support/src/page-objects/AdminTenantsPage.ts`

- `:270` XPath + class `rounded-xl` ancestor selection → avoid; the file already has `getTenantCardContainerByName(appName)` using `role="region"`. For “first card container”, prefer:
  - read first card’s app name (h3), then call `getTenantCardContainerByName(appName)`.

### `packages/test-support/src/page-objects/AdminDiagnosticsPage.ts`

- `:29-33` `locator('section, div').filter({ has: heading })` → prefer `getByRole('region', { name: headingText })` by adding `aria-labelledby` in UI.

### `packages/test-support/src/page-objects/TenantBrandingPage.ts`

- `:204` `locator('text=Branding Configuration')` → use `getByRole('heading', { name: translation... })` (and ensure translation exists).
- Deprecated public locator getters `:210-219` → remove in favor of verification/action methods.

### `packages/test-support/src/page-objects/TenantEditorModalPage.ts`

Key issues:

- Heavy reliance on `getByTestId(...)` for fields that appear to have user-visible labels (colors, spacing, radii, etc.). Prefer `getByLabel(translation.admin.tenantEditor.fields....)` and add missing label associations in UI.
- `:29` and `:38` `page.waitForTimeout(100)` is prohibited by the testing guide; replace with condition-based waits (e.g., wait for expanded content to be visible / `aria-expanded="true"` plus content render).
- Hardcoded section names `:83`, `:97`, `:102` (“Header Display”, “Aurora Gradient”, “Glassmorphism”) → move into translations and select by role/name.
- `:247` placeholder regex `/example\.com|domain/i` → prefer label-based selector.
- `:255` save button name regex `(create tenant|update tenant|save changes)` → use translation keys; do not hardcode English.
- `:271`/`:275` success/error detection via generic regex → make assertions specific using translation keys (avoid false positives).

### `packages/test-support/src/page-objects/JoinGroupPage.ts`

- `:46` `getByRole('heading', { level: 2 })` is too generic; scope to a named preview region (e.g., “Group preview”) or locate the heading by name once the UI labels it.
- `:50` `locator('#main-content')` scoping is unnecessary; prefer `getByRole('button', { name: translation.joinGroupPage.joinGroup })`.
- `:130` `getByRole('status', { name: /Welcome to/ })` → replace with translation key (and ensure the status element uses that accessible name).
- `:135` success icon via `locator('svg')` → prefer verifying the visible success text rather than icon DOM.

## Files That Look Mostly Aligned (No Major Selector/Locator Issues Spotted)

These still may have small opportunities (e.g., fewer `.first()` calls), but they appear mostly compliant with translation-based, role-based selection:

- `packages/test-support/src/page-objects/AdminTenantConfigPage.ts`
- `packages/test-support/src/page-objects/AdminUsersPage.ts`
- `packages/test-support/src/page-objects/RemoveMemberDialogPage.ts`
- `packages/test-support/src/page-objects/UserEditorModalPage.ts`

