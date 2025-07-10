# Webapp Issue: Implement In-Browser End-to-End Testing

## Issue Description

There is a need to implement robust in-browser end-to-end (E2E) testing for the Splitifyd web application to ensure critical user flows and UI interactions function as expected across different browsers.

## Recommendation

Implement E2E testing using either Cypress or Playwright, prioritizing developer experience and integrated debugging (Cypress) or broad cross-browser compatibility and maximum CI/CD speed (Playwright).

## Implementation Suggestions

### Chosen Framework (Decision Required)

*   **Cypress:** Recommended for JavaScript-centric projects prioritizing developer experience and integrated debugging.
*   **Playwright:** Recommended for broad cross-browser compatibility (including Safari) and maximum CI/CD speed.

### Phase 1: Setup and Basic Configuration

1.  **Install Chosen Framework:**
    *   **Cypress:** `cd webapp/ && npm install cypress --save-dev && npx cypress open`
    *   **Playwright:** `cd webapp/ && npm install @playwright/test --save-dev && npx playwright install && npx playwright test --ui`

2.  **Initial Configuration:**
    *   Configure `cypress.config.js` or `playwright.config.ts` in `webapp/` with `baseUrl`, `specPattern`, and other relevant settings.

3.  **Directory Structure:**
    *   Create `webapp/tests/e2e/` for E2E tests.

### Phase 2: Core User Flow Testing - Code Guide & Best Practices

*   **General Best Practices:**
    *   Isolate Tests, Clear Naming, Use Data Attributes for Selectors (`data-testid`).
    *   Avoid arbitrary `wait()`/`waitForTimeout()`. Rely on framework's auto-waiting.
    *   Reset State Before Each Test (clear local storage/cookies, seed test data via API, logout).
    *   Consider Page Object Model for larger applications.

*   **Example Test Structure (Cypress/Playwright):** (Refer to original `in-browser-testing-plan.md` for detailed code examples for login/authentication tests).

### Phase 3: Advanced Scenarios and Edge Cases

*   **Error Handling:** Use `cy.intercept()` (Cypress) or `page.route()` (Playwright) to mock network failures or specific error responses.
*   **Permissions:** Create tests with different user roles.
*   **Data Persistence:** Verify data is correctly saved and loaded after modifications.
*   **Responsive Design (Optional):** Use `cy.viewport()` (Cypress) or `page.setViewportSize()` (Playwright) to test different screen sizes.

### Phase 4: Integration with CI/CD

1.  **Headless Testing:** Both frameworks run in headless mode in CI.
    *   **Cypress:** `npx cypress run`
    *   **Playwright:** `npx playwright test`

2.  **Reporting:** Configure HTML reporters (e.g., `mochawesome` for Cypress, built-in HTML reporter for Playwright).

3.  **Automation (Example GitHub Actions Workflow):** (Refer to original `in-browser-testing-plan.md` for detailed GitHub Actions workflow examples for Cypress and Playwright).

### Data Management for Tests

*   **Test Data Seeding:** Prefer API calls for creating test data. For Firebase/Firestore, consider Firebase Admin SDK for direct database manipulation.
*   **Test Data Cleanup:** Clean up data created by tests after the test run (via API calls or direct database deletion).

### Maintenance and Troubleshooting

*   **Regular Review:** Periodically review and update tests.
*   **Flaky Tests:** Address immediately by ensuring sufficient waiting, stable selectors, and test isolation.
*   **Debugging:** Use framework-specific debugging tools (`cy.debug()`, `page.pause()`, `PWDEBUG=1`).
*   **Performance:** Optimize test execution time by running tests in parallel and minimizing unnecessary UI interactions.

## Next Steps

1.  Confirm the chosen framework (Cypress or Playwright).
2.  Begin Phase 1: Setup and Basic Configuration.
3.  Prioritize core user flows for initial test development, applying the best practices and code examples provided.
4.  Integrate tests into the CI/CD pipeline early to catch issues quickly.
