# E2E Test Guideline Violations Report

This report details all the violations of the E2E testing guidelines found in the `e2e-tests/` directory.

## 1. Prohibited use of `page.waitForTimeout()`

The `e2e-testing.md` guide strictly forbids the use of `page.waitForTimeout()`. This is to prevent flaky tests and encourage the use of web-first assertions and explicit waits.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/parallel-group-joining.e2e.test.ts`:
    -   `await new Promise(resolve => setTimeout(resolve, 2000));`
-   `e2e-tests/src/tests/security/security-user-isolation.e2e.test.ts`:
    -   `await page1.waitForTimeout(500);`

## 2. Prohibited use of `test.skip()`

The `e2e-testing.md` guide strictly forbids skipping tests. All checked-in tests must run.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/share-link-network-resilience.e2e.test.ts`:
    -   `multiUserTest.skip('should recover from network interruptions during join', ...)`
-   `e2e-tests/src/tests/normal-flow/share-link-comprehensive.e2e.test.ts`:
    -   `test.skip('should allow unregistered user to register and join group via share link', ...)`
    -   `multiUserTest.skip('should allow user to join group after logging in from share link', ...)`

## 3. Use of Bespoke Selectors

The `e2e-testing.md` guide requires all UI interactions to be abstracted through Page Objects. Direct use of `page.locator()` or `page.getByRole()` with generic selectors within a test file is a violation of this pattern.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/accessibility-navigation.e2e.test.ts`:
    -   `page.locator(SELECTORS.FORM)`
    -   `page.locator("label[for=\"${emailId}\"]")`
    -   `page.locator("label[for=\"${passwordId}\"]")`
-   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`:
    -   `alicePage.getByRole('button', { name: /share/i })
    -   `alicePage.getByRole('dialog').getByRole('textbox')`
    -   `alicePage.getByRole('heading', { name: /balance/i })
    -   `alicePage.getByText(/2 members/i)`
-   `e2e-tests/src/tests/error-testing/form-validation-comprehensive.e2e.test.ts`:
    -   `page.getByText('Exact amounts')`
    -   `page.locator('input[type="number"][step]').filter({ hasText: '' })`
    -   `page.getByText('Percentage', { exact: true })`
-   `e2e-tests/src/tests/error-testing/negative-value-validation.e2e.test.ts`:
    -   `page.getByText('Test expense for settlement')`
    -   `page.getByText('$50.00')`
-   `e2e-tests/src/tests/normal-flow/advanced-splitting-happy-path.e2e.test.ts`:
    -   `groupDetailPage.getPercentageText().click()`
    -   `groupDetailPage.getEqualText().click()`
-   `e2e-tests/src/tests/normal-flow/auth-navigation.e2e.test.ts`:
    -   `page.getByAltText('Splitifyd')`
-   `e2e-tests/src/tests/normal-flow/expense-datetime.e2e.test.ts`:
    -   `page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i })
    -   `page.getByPlaceholder('Enter time (e.g., 2:30pm)')`
    -   `page.getByRole('button', { name: '3:00 AM' })`
    -   `page.getByRole('button', { name: '3:00 PM' })
    -   `page.getByRole('heading', { name: 'Expense Details' })`
-   `e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`:
    -   `page.getByRole(ARIA_ROLES.BUTTON, { name: /add expense/i })
    -   `page.getByText(/admin/i).first()`
-   `e2e-tests/src/tests/normal-flow/multi-user-happy-path.e2e.test.ts`:
    -   `page.getByText("${user2.displayName} → ${user1.displayName}")`
-   `e2e-tests/src/tests/normal-flow/navigation-comprehensive.e2e.test.ts`:
    -   `page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.' })
    -   `page.getByRole('link', { name: 'Pricing' })`
    -   `page.getByRole('link', { name: 'Login' })`
    -   `page.getByRole('link', { name: 'Sign Up', exact: true })`
-   `e2e-tests/src/tests/normal-flow/policy-pages.e2e.test.ts`:
    -   `page.getByRole('heading', { level: 1 }).filter({ hasText: /Terms of Service|Terms and Conditions/ }).first().waitFor()`
-   `e2e-tests/src/tests/normal-flow/three-user-settlement.e2e.test.ts`:
    -   `page.keyboard.press('Escape')`
-   `e2e-tests/src/tests/security/security-abuse.e2e.test.ts`:
    -   `page.locator('[data-testid="error-message"]')`
-   `e2e-tests/src/tests/security/security-auth.e2e.test.ts`:
    -   `page.locator('[data-testid="login-form"]')`
-   `e2e-tests/src/tests/security/security-authorization.e2e.test.ts`:
    -   `page2.locator('h1')`
-   `e2e-tests/src/tests/security/security-input-validation.e2e.test.ts`:
    -   `page.locator('[data-testid="error-message"], [data-testid="description-error"]')`
-   `e2e-tests/src/tests/security/security-rules.e2e.test.ts`:
    -   `page2.locator("text=${groupName}")`
-   `e2e-tests/src/tests/security/security-user-isolation.e2e.test.ts`:
    -   `page.getByRole('button', { name: user.displayName })

## 4. Prohibited use of `page.reload()`

The `e2e-testing.md` guide prohibits the use of `page.reload()` for state synchronization.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`:
    -   `await alicePage.reload();`
-   `e2e-tests/src/tests/edge-cases/form-behavior.e2e.test.ts`:
    -   `await page.reload();`
-   `e2e-tests/src/tests/edge-cases/removed-user-access.spec.ts`:
    -   `await user1Page.reload();`
-   `e2e-tests/src/tests/security/security-auth.e2e.test.ts`:
    -   `await page.reload();`

## 5. Redundant Tests

Some tests are redundant and could be merged to improve maintainability and reduce execution time.

**Examples:**

-   The tests in `e2e-tests/src/tests/error-testing/form-validation.e2e.test.ts` and `e2e-tests/src/tests/error-testing/form-validation-comprehensive.e2e.test.ts` are very similar and could be merged.
-   The tests in `e2e-tests/src/tests/error-testing/negative-value-validation.e2e.test.ts` are partially covered in `e2e-tests/src/tests/error-testing/form-validation-comprehensive.e2e.test.ts`.
-   The tests in `e2e-tests/src/tests/error-testing/server-errors.e2e.test.ts` and `e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts` are very similar and could be merged.

## 6. TODO Comments

Some tests have TODO comments indicating they should be converted to unit tests. This should be addressed to improve the efficiency of the test suite.

**Examples:**

-   `e2e-tests/src/tests/edge-cases/accessibility-navigation.e2e.test.ts`
-   `e2e-tests/src/tests/edge-cases/performance-monitoring.e2e.test.ts`
-   `e2e-tests/src/tests/edge-cases/seo-monitoring.e2e.test.ts`
