# E2E Test Guideline Adherence Report

**Last Updated:** 2025-08-16

This report outlines findings from a sweep of the `e2e-tests/` source code, checking for adherence to the guidelines in `docs/guides/end-to-end_testing.md`.

## 1. Prohibited use of `page.waitForTimeout()` or `setTimeout`

The `e2e-testing.md` guide strictly forbids the use of `page.waitForTimeout()` or other fixed waits to prevent flaky tests.

**New Violations Found:**

*   `e2e-tests/src/tests/security/security-user-isolation.e2e.test.ts`:
    *   `await page1.waitForTimeout(500);`
*   `e2e-tests/src/tests/edge-cases/parallel-group-joining.e2e.test.ts`:
    *   `await new Promise(resolve => setTimeout(resolve, 2000));`

## 2. Prohibited use of `test.skip()`

The `e2e-testing.md` guide strictly forbids skipping tests. All checked-in tests must run.

**New Violations Found:**

*   `e2e-tests/src/tests/edge-cases/share-link-network-resilience.e2e.test.ts`:
    *   The entire file's contents are commented out, effectively skipping the tests.
*   `e2e-tests/src/tests/normal-flow/share-link-comprehensive.e2e.test.ts`:
    *   `test.skip('should allow unregistered user to register and join group via share link', ...)`
    *   `multiUserTest.skip('should allow user to join group after logging in from share link', ...)`

## 3. Use of Bespoke Selectors

The `e2e-testing.md` guide requires all UI interactions to be abstracted through Page Objects. Direct use of `page.locator()` or `page.getByRole()` with generic selectors within a test file is a violation.

**New Violations Found:**

*   `e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`:
    *   `page.getByText(/admin/i).first()`
*   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`:
    *   `alicePage.getByRole('heading', { name: /balance/i })`
    *   `alicePage.getByText(/2 members/i)`
*   `e2e-tests/src/tests/error-testing/duplicate-registration.e2e.test.ts`:
    *   `page.locator(SELECTORS.ERROR_MESSAGE)`
    *   `page.getByRole('button', { name: displayName })`
*   `e2e-tests/src/tests/error-testing/expense-editing-errors.e2e.test.ts`:
    *   `page.getByRole('button', { name: /edit/i })`
    *   `page.locator('input[type="number"]').first()`
*   `e2e-tests/src/tests/normal-flow/multi-currency-basic.e2e.test.ts`:
    *   `page.getByText('$25.00')`
    *   `page.locator('[data-testid="group-card"]').first()`
*   `e2e-tests/src/tests/error-testing/share-link-errors.e2e.test.ts`:
    *   `page.getByText('Unable to Join Group')`

## 4. Prohibited use of `page.reload()`

The `e2e-testing.md` guide prohibits the use of `page.reload()` for state synchronization.

**New Violations Found:**

*   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`:
    *   `await alicePage.reload();`
*   `e2e-tests/src/tests/edge-cases/form-behavior.e2e.test.ts`:
    *   `await page.reload();` - This test is specifically for form persistence, which is a legitimate use case for `reload`.

## 5. Prohibited use of `page.keyboard.press()`

Using `page.keyboard.press()` is an anti-pattern for form submissions.

**New Violations Found:**

*   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`:
    *   `press('Escape')`
*   `e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts`:
    *   `press('Escape')`
*   `e2e-tests/src/tests/error-testing/timeout-errors.e2e.test.ts`:
    *   `press('Escape')`
*   `e2e-tests/src/tests/normal-flow/settlement-management.e2e.test.ts`:
    *   `press('Escape')`
*   `e2e-tests/src/tests/security/security-abuse.e2e.test.ts`:
    *   `press('Enter')`
*   `e2e-tests/src/tests/security/security-input-validation.e2e.test.ts`:
    *   `press('Enter')`
*   `e2e-tests/src/tests/edge-cases/accessibility-navigation.e2e.test.ts`:
    *   `press('Tab')`, `press('Enter')` - This is a legitimate use case for testing keyboard navigation.

## 6. Direct `page.goto()` Calls in Tests

The `e2e-testing.md` guide requires navigation to be handled by Page Objects.

**New Violations Found:**

*   `e2e-tests/src/tests/normal-flow/group-display.e2e.test.ts`:
    *   `page.goto('/groups/${groupId}')`
*   `e2e-tests/src/tests/normal-flow/multi-currency-basic.e2e.test.ts`:
    *   `page.goto('/dashboard')`
*   `e2e-tests/src/tests/normal-flow/policy-pages.e2e.test.ts`:
    *   `page.goto('/privacy')`, `page.goto('/cookies')`

## 7. Opportunities for Improvement

*   **Redundant Tests**:
    *   `e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts` and `e2e-tests/src/tests/error-testing/timeout-errors.e2e.test.ts` are very similar and could potentially be consolidated.
*   **Tests to Convert to Unit/Component Tests**:
    *   `e2e-tests/src/tests/edge-cases/seo-validation.e2e.test.ts`: This test only checks for page titles, which is better suited for a unit test.
    *   `e2e-tests/src/tests/edge-cases/performance-benchmarks.e2e.test.ts`: This test measures page load time, which should be handled by performance budgets in CI, not as a functional E2E test.
    *   `e2e-tests/src/tests/edge-cases/accessibility.e2e.test.ts`: While valuable, full Axe scans can be slow and are often run in a separate accessibility testing stage.

## Summary and Recommendations

The sweep identified several violations of the established E2E testing guidelines. The most common issues are the use of bespoke selectors directly in tests, hard-coded waits, and direct page navigation.

It is recommended to:
1.  Refactor the identified tests to use Page Object Model methods for all selectors and navigation.
2.  Replace all instances of `page.waitForTimeout()` and `setTimeout` with web-first assertions and explicit waits.
3.  Remove or re-enable all skipped tests.
4.  Replace `page.keyboard.press('Enter')` for form submissions with clicks on submit buttons.
5.  Evaluate the tests identified as candidates for unit/component tests and consider moving them to a more appropriate testing stage to improve the speed and focus of the E2E suite.
