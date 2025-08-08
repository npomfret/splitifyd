# E2E Test Violations Report

This report details violations of the testing best practices outlined in `e2e-tests/README.md` found across the E2E test suite.

## Primary Violation: Bespoke Selectors

The most common violation is the use of bespoke selectors directly within test files, rather than abstracting them into the Page Object Model (POM). This practice makes the tests brittle and harder to maintain. All instances of `page.getByRole`, `page.getByText`, `page.locator`, etc., should be replaced with methods on the appropriate page object.

---

### File: `e2e-tests/src/tests/normal-flow/terms-acceptance.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the `RegisterPage` page object.

- `page.locator('label:has-text("I accept the Terms of Service") input[type="checkbox"]')`
- `page.locator('label:has-text("I accept the Cookie Policy") input[type="checkbox"]')`
- `page.locator('text=I accept the Terms of Service')`
- `page.locator('text=I accept the Cookie Policy')`
- `page.locator('a[href="/terms"]')`
- `page.locator('a[href="/cookies"]')`
- `page.locator('button:has-text("Create Account")')`

---

### File: `e2e-tests/src/tests/screenshots/simple-walkthrough.test.ts`

**Violations:** Bespoke selectors should be moved to the `LoginPage` page object.

- `page.fill('input[type="email"]', 'john.doe@example.com')`
- `page.fill('input[type="password"]', 'SecurePass123!')`

---

### File: `e2e-tests/src/tests/normal-flow/settlement-management.e2e.test.ts`

**Violations:** Bespoke selectors and custom logic should be moved to the `GroupDetailPage` page object.

- `page.evaluate((payerValue: string) => { ... })`
- `page.getByRole('combobox', { name: /who paid/i })`
- `page.getByRole('combobox', { name: /who received the payment/i })`
- `page.getByRole('spinbutton', { name: /amount/i })`
- `page.getByRole('combobox', { name: /currency/i })`
- `page.getByRole('textbox', { name: /note/i })`
- `page.getByRole('button', { name: 'Show History' })`

---

### File: `e2e-tests/src/tests/normal-flow/static-pages-navigation.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the appropriate page objects.

- `page.getByRole('link', { name: 'Terms' })`
- `page.getByRole('link', { name: 'Privacy' })`
- `page.getByAltText('Splitifyd')`
- `page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.' })`
- `page.getByRole('link', { name: 'Login' })`
- `page.getByRole('link', { name: 'Sign Up', exact: true })`

---

### File: `e2e-tests/src/tests/normal-flow/balance-visualization.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the `GroupDetailPage` page object.

- `page.getByText('All settled up!')`
- `page.getByRole('main').getByText(user.displayName).first()`
- `page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Balances" }) })`
- `balancesSection.getByText(/\$61\.7[23]/)`
- `page.locator('.bg-white').filter({ has: page.getByRole('heading', { name: 'Balances' }) }).first()`

---

### File: `e2e-tests/src/tests/normal-flow/negative-value-validation.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the `GroupDetailPage` page object.

- `page.getByPlaceholder('0.00')`
- `page.getByRole('button', { name: /save expense/i })`
- `page.getByPlaceholder('What was this expense for?')`
- `page.getByRole('button', { name: 'Select all' })`
- `page.getByRole('button', { name: /settle up/i })`
- `page.getByRole('dialog')`
- `page.getByRole('spinbutton', { name: /amount/i })`
- `page.getByRole('combobox', { name: /who paid/i })`
- `page.getByRole('combobox', { name: /who received the payment/i })`
- `page.getByRole('button', { name: 'Show History' })`
- `page.locator('input[type="number"][step="0.01"][min="0.01"]')`

---

### File: `e2e-tests/src/tests/normal-flow/freeform-categories.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the `GroupDetailPage` page object.

- `page.waitForSelector('[role="listbox"]', { timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY })`
- `page.locator('[role="option"]').all()`
- `page.getByRole('button', { name: /edit/i })`
- `page.getByRole('button', { name: /update expense/i })`

---

### File: `e2e-tests/src/tests/normal-flow/group-display.e2e.test.ts`

**Violations:** Bespoke selector should be moved to the `GroupDetailPage` page object.

- `page.getByRole('button', { name: /settings/i })`

---

### File: `e2e-tests/src/tests/normal-flow/homepage-navigation.e2e.test.ts`

**Violations:** Bespoke selector should be moved to the `HomepagePage` page object.

- `page.getByRole('link', { name: /splitifyd|home/i }).first()`

---

### File: `e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the `GroupDetailPage` page object.

- `page.getByRole(ARIA_ROLES.MAIN).getByText(user.displayName)`
- `page.getByText(/1 member/i)`
- `page.getByRole(ARIA_ROLES.BUTTON, { name: /add expense/i })`
- `page.getByPlaceholder(PLACEHOLDERS.EXPENSE_DESCRIPTION)`
- `page.getByRole(ARIA_ROLES.HEADING, { name: /split between/i })`
- `splitHeading.locator('..').locator('..')`
- `splitCard.locator(SELECTORS.CHECKBOX).first()`
- `splitCard.getByText(user.displayName)`
- `page.getByText(/admin/i).first()`
- `page.getByRole(ARIA_ROLES.BUTTON, { name: /share/i })`
- `page.getByRole(ARIA_ROLES.DIALOG, { name: /share group/i })`
- `shareModal.getByRole(ARIA_ROLES.TEXTBOX)`

---

### File: `e2e-tests/src/tests/error-testing/form-validation.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the appropriate page objects.

- `page.locator('form').getByRole('button', { name: 'Create Group' })`
- `page.getByRole('button', { name: /add expense/i })`
- `page.getByRole('button', { name: /save expense/i })`
- `page.getByPlaceholder('What was this expense for?')`
- `page.getByText('Exact amounts')`
- `page.getByText('Percentage', { exact: true })`

---

### File: `e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts`

**Violations:** Bespoke selector should be moved to the `CreateGroupModalPage` page object.

- `page.locator(SELECTORS.FORM).getByRole('button', { name: 'Create Group' })`

---

### File: `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`

**Violations:** Bespoke selectors should be moved to the `GroupDetailPage` page object.

- `alicePage.getByRole('button', { name: /share/i })`
- `alicePage.getByRole('dialog').getByRole('textbox')`
- `bobPage.getByRole('heading', { name: 'Join Group' })`
- `bobPage.getByRole('button', { name: 'Join Group' })`
- `alicePage.getByRole('heading', { name: /balance/i })`
- `balanceSection.getByText(/\$/)`
- `alicePage.getByText(/2 members/i)`
