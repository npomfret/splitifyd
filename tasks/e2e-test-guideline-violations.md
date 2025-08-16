# E2E Test Guideline Violations Report

**Last Updated:** 2025-08-16

This report details all the violations of the E2E testing guidelines found in the `e2e-tests/` directory.

## 1. Prohibited use of `page.waitForTimeout()` or `setTimeout`

The `e2e-testing.md` guide strictly forbids the use of `page.waitForTimeout()` or other fixed waits. This is to prevent flaky tests and encourage the use of web-first assertions and explicit waits.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/parallel-group-joining.e2e.test.ts`:
    -   `await new Promise(resolve => setTimeout(resolve, 2000));`
-   `e2e-tests/src/tests/security/security-user-isolation.e2e.test.ts`:
    -   `await page1.waitForTimeout(500);`

## 2. Prohibited use of `test.skip()`

The `e2e-testing.md` guide strictly forbids skipping tests. All checked-in tests must run.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/share-link-network-resilience.e2e.test.ts`:
    -   `multiUserTest.skip(...)`
-   `e2e-tests/src/tests/normal-flow/share-link-comprehensive.e2e.test.ts`:
    -   `test.skip(...)`
    -   `multiUserTest.skip(...)`

## 3. Use of Bespoke Selectors in Tests

The `e2e-testing.md` guide requires all UI interactions to be abstracted through Page Objects. Direct use of `page.locator()` or `page.getByRole()` with generic selectors within a test file is a violation of this pattern.

**Note:** This issue is widespread across almost all test files. The list below is not exhaustive but provides representative examples from files not previously listed.

**New Violations Found In:**

-   `e2e-tests/src/tests/error-testing/duplicate-registration.e2e.test.ts`:
    -   `page.locator(SELECTORS.ERROR_MESSAGE)`
    -   `page.getByRole('button', { name: displayName })`
-   `e2e-tests/src/tests/error-testing/expense-editing-errors.e2e.test.ts`:
    -   `page.getByRole('button', { name: /edit/i })`
    -   `page.locator('input[type="number"]').first()`
-   `e2e-tests/src/tests/normal-flow/multi-currency-basic.e2e.test.ts`:
    -   `page.getByText('$25.00')`
    -   `page.locator('[data-testid="group-card"]').first()`
-   `e2e-tests/src/tests/error-testing/share-link-errors.e2e.test.ts`:
    -   `page.getByText('Unable to Join Group')`

## 4. Prohibited use of `page.reload()`

The `e2e-testing.md` guide prohibits the use of `page.reload()` for state synchronization.

**Existing Violations:**

-   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`
-   `e2e-tests/src/tests/edge-cases/form-behavior.e2e.test.ts`
-   `e2e-tests/src/tests/edge-cases/removed-user-access.spec.ts`
-   `e2e-tests/src/tests/security/security-auth.e2e.test.ts`

**New Violations Found:**

-   `e2e-tests/src/pages/group-detail.page.ts`
-   `e2e-tests/src/pages/join-group.page.ts`
-   `e2e-tests/src/tests/edge-cases/parallel-group-joining.e2e.test.ts`
-   `e2e-tests/src/tests/normal-flow/dashboard-happy-path.e2e.test.ts`
-   `e2e-tests/src/tests/security/security-authorization.e2e.test.ts`

## 5. Prohibited use of `force: true`

The `e2e-testing.md` guide prohibits using `force: true` as it can hide underlying issues where an element is not properly intractable.

**Violations found in:**

-   `e2e-tests/src/tests/error-testing/negative-value-validation.e2e.test.ts`:
    -   `await saveButton.click({ force: true });`

## 6. Prohibited use of `page.keyboard.press()`

Using `page.keyboard.press()` is an anti-pattern. Form submissions should use button locators, and keyboard navigation should be modeled via tabbing through located elements.

**Violations found in:**

-   `e2e-tests/src/pages/group-detail.page.ts`: `press('Escape')`
-   `e2e-tests/src/tests/edge-cases/accessibility-navigation.e2e.test.ts`: `press('Tab')`, `press('Enter')`
-   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`: `press('Escape')`
-   `e2e-tests/src/tests/error-testing/form-validation.e2e.test.ts`: `press('Tab')`
-   `e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts`: `press('Escape')`
-   `e2e-tests/src/tests/normal-flow/settlement-management.e2e.test.ts`: `press('Escape')`

## 7. Direct `page.goto()` Calls in Tests

The `e2e-testing.md` guide requires navigation to be handled by Page Objects to encapsulate URLs and navigation logic. Direct calls to `page.goto()` within test files are a violation of this pattern.

**Violations found in:**

-   `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`
-   `e2e-tests/src/tests/edge-cases/parallel-group-joining.e2e.test.ts`
-   `e2e-tests/src/tests/error-testing/share-link-error-scenarios.e2e.test.ts`
-   `e2e-tests/src/tests/normal-flow/dashboard-happy-path.e2e.test.ts`
-   `e2e-tests/src/tests/normal-flow/group-display.e2e.test.ts`
-   `e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`
-   `e2e-tests/src/tests/normal-flow/policy-pages.e2e.test.ts`
-   `e2e-tests/src/tests/normal-flow/terms-acceptance.e2e.test.ts`
-   `e2e-tests/src/tests/security/security-abuse.e2e.test.ts`
-   `e2e-tests/src/tests/security/security-auth.e2e.test.ts`
-   `e2e-tests/src/tests/security/security-authorization.e2e.test.ts`
-   `e2e-tests/src/tests/security/security-input-validation.e2e.test.ts`
-   `e2e-tests/src/tests/security/security-user-isolation.e2e.test.ts`

## 8. Redundant Tests

Some tests are redundant and could be merged to improve maintainability and reduce execution time. This requires manual review.

**Examples:**

-   The tests in `e2e-tests/src/tests/error-testing/form-validation.e2e.test.ts` and `form-validation-comprehensive.e2e.test.ts` could likely be merged.
-   The tests in `e2e-tests/src/tests/error-testing/negative-value-validation.e2e.test.ts` are partially covered in `form-validation-comprehensive.e2e.test.ts`.
-   The tests in `e2e-tests/src/tests/error-testing/server-errors.e2e.test.ts` and `network-errors.e2e.test.ts` are very similar and could be merged.