# Page Object Locator Review

Goal: audit Playwright page objects for locator quality and list improvements that better mirror user-visible cues.

## Plan
- Understand shared POM patterns and locator helpers (BasePage and utilities).
- Review page objects for brittle or non-user-centric selectors.
- Capture recommended locator improvements without changing code.

## Progress
- [x] Patterns reviewed
- [x] Page objects audited
- [ ] Recommendations recorded

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
