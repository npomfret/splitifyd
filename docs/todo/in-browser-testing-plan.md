# Plan for In-Browser Testing

## Objective
To implement robust in-browser end-to-end (E2E) testing for the Splitifyd web application to ensure critical user flows and UI interactions function as expected across different browsers.

## Recommended Technology - Deep Dive

### Cypress
**Why Cypress?**
*   **Developer Experience:** Unparalleled ease of setup, fast execution, and excellent debugging capabilities directly within the browser. The Cypress Test Runner provides a visual representation of your tests as they run, making debugging intuitive.
*   **JavaScript-based:** Aligns perfectly with the existing JavaScript/TypeScript codebase, allowing for a consistent development experience and easy sharing of utilities.
*   **Real-time Reloading:** Provides immediate feedback during test development, accelerating the test writing process.
*   **Automatic Waiting:** Intelligently waits for elements to appear and animations to complete, significantly reducing test flakiness without manual waits.
*   **Component and API Testing:** While primarily E2E, Cypress can also be used for component and API testing, offering a unified testing solution within a single framework.
*   **Network Control:** Easily stub, mock, and spy on network requests, allowing for isolated testing of UI components and predictable test environments.

**Considerations for Cypress:**
*   **Browser Support:** Primarily Chrome, Firefox, Edge, and Electron. WebKit (Safari) support is available but might require additional setup or plugins.
*   **Execution Speed in CI:** Can be slower for large test suites compared to Playwright due to its architecture (running tests in the browser). Parallelization requires external tools or Cypress Cloud.

### Playwright
**Why Playwright?**
*   **True Cross-Browser Support:** Developed by Microsoft, it offers robust, first-class support for Chromium, Firefox, and WebKit (Safari) from a single API, ensuring wider browser coverage.
*   **Fast and Reliable:** Designed for modern web applications, providing extremely fast and reliable test execution, especially in headless environments.
*   **Parallel Execution (Built-in):** Supports parallel test execution out-of-the-box, which can significantly speed up CI/CD pipelines for large test suites.
*   **Auto-waiting:** Similar to Cypress, Playwright includes auto-waiting mechanisms to reduce flakiness.
*   **Language Bindings:** Supports TypeScript, JavaScript, Python, Java, and .NET, offering flexibility for different teams.

**Considerations for Playwright:**
*   **Developer Experience:** While excellent, it might have a slightly steeper learning curve than Cypress for beginners due to its more traditional WebDriver-like architecture.
*   **Debugging:** Debugging is powerful but might not be as visually integrated as Cypress's Test Runner.

**Recommendation:**
For a JavaScript-centric project prioritizing developer experience and integrated debugging, **Cypress** is an excellent starting point. If broad cross-browser compatibility (including Safari) and maximum CI/CD speed are paramount, **Playwright** might be a better long-term choice. Given the existing JavaScript codebase, Cypress's developer experience and integrated debugging might lead to faster test adoption and development.

## Implementation Plan

### Phase 1: Setup and Basic Configuration

1.  **Install Chosen Framework:**
    *   **Cypress:**
        ```bash
        cd webapp/
        npm install cypress --save-dev
        npx cypress open # This will open the Cypress Test Runner and create example files
        ```
    *   **Playwright:**
        ```bash
        cd webapp/
        npm install @playwright/test --save-dev
        npx playwright install # Install browser binaries
        npx playwright test --ui # This will open the Playwright UI and create example files
        ```

2.  **Initial Configuration:**
    *   **Cypress (`cypress.config.js` in `webapp/`):**
        ```javascript
        const { defineConfig } = require('cypress');

        module.exports = defineConfig({
          e2e: {
            baseUrl: 'http://localhost:5000', // Or your staging URL
            specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
            supportFile: 'cypress/support/e2e.js',
            // Add other configurations like viewport, video, screenshots
          },
        });
        ```
    *   **Playwright (`playwright.config.ts` in `webapp/`):**
        ```typescript
        import { defineConfig, devices } from '@playwright/test';

        export default defineConfig({
          testDir: './tests/e2e',
          fullyParallel: true,
          forbidOnly: !!process.env.CI,
          retries: process.env.CI ? 2 : 0,
          workers: process.env.CI ? 1 : undefined,
          reporter: 'html',
          use: {
            baseURL: 'http://localhost:5000', // Or your staging URL
            trace: 'on-first-retry',
          },
          projects: [
            {
              name: 'chromium',
              use: { ...devices['Desktop Chrome'] },
            },
            {
              name: 'firefox',
              use: { ...devices['Desktop Firefox'] },
            },
            {
              name: 'webkit',
              use: { ...devices['Desktop Safari'] },
            },
          ],
        });
        ```

3.  **Directory Structure:**
    *   Create a dedicated `webapp/tests/e2e/` directory for E2E tests.
    *   For Cypress, the default is `webapp/cypress/e2e/`. You can configure `specPattern` in `cypress.config.js` to point to `webapp/tests/e2e/` if preferred.
    *   For Playwright, configure `testDir` in `playwright.config.ts` to `webapp/tests/e2e/`.

### Phase 2: Core User Flow Testing - Code Guide & Best Practices

**General Best Practices for E2E Tests:**
*   **Isolate Tests:** Each test should be independent and not rely on the state of previous tests.
*   **Clear Naming:** Use descriptive names for test files and individual tests (e.g., `login.cy.ts`, `should allow a user to log in with valid credentials`).
*   **Use Data Attributes for Selectors:** Prefer `data-testid` or similar attributes over fragile CSS classes or element positions for selecting elements. This makes tests more resilient to UI changes.
    ```html
    <button data-testid="login-button">Login</button>
    ```
    ```javascript
    // Cypress
    cy.get('[data-testid="login-button"]').click();
    // Playwright
    await page.locator('[data-testid="login-button"]').click();
    ```
*   **Avoid `cy.wait()` (Cypress) / `page.waitForTimeout()` (Playwright):** Rely on the framework's automatic waiting mechanisms or explicit waits for specific conditions (e.g., `cy.contains()`, `cy.url().should()`, `page.waitForSelector()`, `page.waitForURL()`).
*   **Reset State Before Each Test:** Ensure a clean slate for each test. This often involves:
    *   Clearing local storage/cookies.
    *   Seeding test data in the backend (e.g., via API calls or direct database manipulation).
    *   Logging out any previously logged-in users.
*   **Page Object Model (Optional but Recommended):** For larger applications, consider using the Page Object Model pattern to encapsulate page interactions and selectors, making tests more readable and maintainable.

**Example Test Structure (Cypress):**

```javascript
// webapp/cypress/e2e/auth/login.cy.ts

describe('Authentication', () => {
  beforeEach(() => {
    // Clear local storage and visit the login page before each test
    cy.clearLocalStorage();
    cy.visit('/login.html'); // Adjust to your actual login path
  });

  it('should allow a user to log in with valid credentials', () => {
    // Use data-testid for robust selectors
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    // Assert that the user is redirected to the dashboard
    cy.url().should('include', '/dashboard.html');
    cy.get('[data-testid="welcome-message"]').should('contain', 'Welcome, test@example.com');
  });

  it('should display an error message for invalid credentials', () => {
    cy.get('[data-testid="email-input"]').type('invalid@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    // Assert that an error message is displayed
    cy.get('[data-testid="error-message"]').should('be.visible').and('contain', 'Invalid credentials');
    cy.url().should('include', '/login.html'); // Still on the login page
  });
});
```

**Example Test Structure (Playwright):**

```typescript
// webapp/tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear local storage and visit the login page before each test
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login.html'); // Adjust to your actual login path
  });

  test('should allow a user to log in with valid credentials', async ({ page }) => {
    // Use data-testid for robust selectors
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();

    // Assert that the user is redirected to the dashboard
    await expect(page).toHaveURL(/.*dashboard.html/);
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome, test@example.com');
  });

  test('should display an error message for invalid credentials', async ({ page }) => {
    await page.locator('[data-testid="email-input"]').fill('invalid@example.com');
    await page.locator('[data-testid="password-input"]').fill('wrongpassword');
    await page.locator('[data-testid="login-button"]').click();

    // Assert that an error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    await expect(page).toHaveURL(/.*login.html/); // Still on the login page
  });
});
```

### Phase 3: Advanced Scenarios and Edge Cases

*   **Error Handling:**
    *   **Cypress:** Use `cy.intercept()` to mock network failures or specific error responses from your API.
    *   **Playwright:** Use `page.route()` to intercept and modify network requests/responses.
*   **Permissions:** Create tests with different user roles and verify access to features/data. This often involves logging in as different users or manipulating user roles via API calls before the test.
*   **Data Persistence:** After performing actions that modify data, navigate away and back, or refresh the page, to ensure data is correctly saved and loaded.
*   **Responsive Design (Optional but Recommended):**
    *   **Cypress:** Use `cy.viewport()` to test different screen sizes.
    *   **Playwright:** Use `page.setViewportSize()` to simulate various device dimensions.

### Phase 4: Integration with CI/CD

1.  **Headless Testing:** Both Cypress and Playwright run in headless mode by default in CI environments.
    *   **Cypress:** `npx cypress run`
    *   **Playwright:** `npx playwright test`

2.  **Reporting:**
    *   **Cypress:**
        *   Default: Mocha's built-in spec reporter.
        *   Recommended: `mochawesome` for HTML reports. Install `npm install mochawesome mochawesome-merge --save-dev`. Configure in `cypress.config.js` and add a script to `package.json` to merge reports.
    *   **Playwright:**
        *   Default: HTML reporter (`playwright-report/index.html`).
        *   Other options: JUnit, Allure.

3.  **Automation (Example GitHub Actions Workflow):**

    ```yaml
    # .github/workflows/e2e-tests.yml
    name: E2E Tests

    on:
      push:
        branches:
          - main
      pull_request:
        branches:
          - main

    jobs:
      cypress-run:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout
            uses: actions/checkout@v4
          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: '20'
          - name: Install dependencies
            run: npm install # Assuming webapp/package.json is at the root or adjust path
            working-directory: ./webapp # Adjust if your webapp is not at the root
          - name: Start local server (if needed)
            run: |
              # Command to start your web application locally
              # Example: npm start &
              # Wait for the server to be ready
              # Example: npx wait-on http://localhost:5000
            working-directory: ./webapp # Adjust if your webapp is not at the root
          - name: Run Cypress tests
            uses: cypress-io/github-action@v6
            with:
              browser: chrome
              # If your Cypress config is not at the root, specify the working directory
              # working-directory: webapp
              # build: npm run build # If you need to build your app before running tests
              # start: npm start # If you want Cypress to start your app
          - name: Upload Cypress reports (if using mochawesome)
            uses: actions/upload-artifact@v4
            if: always()
            with:
              name: cypress-html-report
              path: webapp/cypress/reports # Adjust path

      playwright-run:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout
            uses: actions/checkout@v4
          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: '20'
          - name: Install dependencies
            run: npm install # Assuming webapp/package.json is at the root or adjust path
            working-directory: ./webapp # Adjust if your webapp is not at the root
          - name: Install Playwright browsers
            run: npx playwright install --with-deps
            working-directory: ./webapp # Adjust if your webapp is not at the root
          - name: Start local server (if needed)
            run: |
              # Command to start your web application locally
              # Example: npm start &
              # Wait for the server to be ready
              # Example: npx wait-on http://localhost:5000
            working-directory: ./webapp # Adjust if your webapp is not at the root
          - name: Run Playwright tests
            run: npx playwright test
            working-directory: ./webapp # Adjust if your webapp is not at the root
          - name: Upload Playwright reports
            uses: actions/upload-artifact@v4
            if: always()
            with:
              name: playwright-html-report
              path: webapp/playwright-report # Adjust path
    ```

## Data Management for Tests

*   **Test Data Seeding:**
    *   **API Calls:** The most common and recommended way is to use your application's API to create necessary test data (users, expenses, groups) in `beforeEach` or `beforeAll` hooks. This is fast and reliable.
    *   **Direct Database Manipulation (for Firebase/Firestore):** For Firebase, you might consider using the Firebase Admin SDK in your test setup to directly manipulate Firestore data. This offers fine-grained control but requires careful management of credentials and environment.
    *   **UI-driven Seeding (Avoid):** Avoid creating test data by navigating through the UI in `beforeEach` hooks, as this makes tests slow and brittle.
*   **Test Data Cleanup:**
    *   Ensure data created by tests is cleaned up after the test run, especially in shared environments. This can be done via API calls or direct database deletion in `afterEach` or `afterAll` hooks.
    *   For Firebase Emulators, you can use the `firebase emulators:export` and `firebase emulators:import` commands, or clear data programmatically.

## Maintenance and Troubleshooting

*   **Regular Review:** Periodically review and update tests as the application evolves.
*   **Flaky Tests:** Address flaky tests immediately. Common causes include:
    *   Insufficient waiting for elements or network requests.
    *   Reliance on unstable selectors.
    *   Tests not being isolated.
*   **Debugging:**
    *   **Cypress:** Use `cy.debug()`, `cy.pause()`, and the Cypress Test Runner's interactive debugger.
    *   **Playwright:** Use `page.pause()`, `PWDEBUG=1` environment variable, and browser developer tools.
*   **Performance:** Optimize test execution time by:
    *   Running tests in parallel (Playwright built-in, Cypress via Cloud or external tools).
    *   Minimizing unnecessary UI interactions.
    *   Using API calls for setup whenever possible.

## Next Steps
1.  Confirm the chosen framework (Cypress or Playwright).
2.  Begin Phase 1: Setup and Basic Configuration.
3.  Prioritize core user flows for initial test development, applying the best practices and code examples provided.
4.  Integrate tests into the CI/CD pipeline early to catch issues quickly.