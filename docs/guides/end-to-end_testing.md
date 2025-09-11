# E2E Testing Guide for Splitifyd

## Overview

This project uses Playwright for end-to-end testing with a robust architecture designed for parallel execution, test isolation, and maintainability. The tests run against the Firebase emulator to ensure a consistent testing environment.

In general, the end-to-end test suite is quite slow. During development, ONLY run selected tests (relevant to the stuff you are working on). Only at the end run the entire suite.

## Core Principles

### Fast & Parallel Execution

- **1 second action timeout** - No flaky selectors or slow operations allowed
- **10 second test timeout** - Tests must complete quickly or fail
- **parallel workers** - Tests run simultaneously and must not interfere
- **Browser reuse between tests** - Never assume clean browser state

### Test Isolation

- **Every test must be self-contained** - Tests should not depend on the state left by previous tests
- **Explicit state setup** - Always verify and establish the expected starting state
- **Browser context reuse** - Tests must work when the browser is reused from previous tests
- **Clean teardown** - Tests clean up after themselves using fixtures

### Fixtures Over Bare Tests

- **Always use appropriate fixtures** instead of bare `test()` calls
- **Authentication is handled by fixtures** - Never manually authenticate in tests
- **Page objects are provided by fixtures** - Access page objects through fixture parameters

### State Verification

- **Verify state** - everywhere! fail as early as possible with clear error messages
- **Always assert navigation state** - Verify URLs and page content before performing actions
- **Fail fast on unexpected state** - Tests should immediately fail if preconditions aren't met
- **Use explicit waits** - Wait for specific conditions rather than arbitrary timeouts

## Test Architecture

The tests are split into 3 group; normal flow (happy path), error testing, and edge cases).

# E2E Testing Guide for Splitifyd

## Overview

This project uses Playwright for end-to-end testing with a robust architecture designed for parallel execution, test isolation, and maintainability. The tests run against the Firebase emulator to ensure a consistent and isolated testing environment.

In general, the end-to-end test suite is quite slow. During development, ONLY run selected tests (relevant to the stuff you are working on). Only at the end run the entire suite.

Don't ever run tests that require manual debugging.

Don't ever serve the Playwright html report, it takes over the users default browser. Always use `PLAYWRIGHT_HTML_OPEN=never` or ideally use `e2e-tests/run-until-fail.sh`.

## Core Principles: The Foundation of a Stable Test Suite

Our E2E tests are the ultimate guarantee of quality. They must be fast, reliable, and deterministic. Adherence to these principles is not optional.

However, they are slow: Do not use them when a simple unit test would be better and faster. They are for _coarse grained_ testing.

### 1. Speed and Performance

- **1.5 Second Action Timeout**: Actions must be immediate. This forces the use of efficient and reliable selectors.
- **15 Second Test Timeout**: A test must complete within 15 seconds or it is considered a failure. This prevents hangs and surfaces performance regressions.
- **Parallel Execution**: Tests run with 4 workers in parallel. This demands absolute test isolation.

### 2. Absolute Test Isolation

- **Self-Contained Tests**: Every test must set up its own state and clean up after itself. No test shall depend on the state left by another.
- **Browser Context Reuse**: Tests must function correctly when sharing a browser context. Never assume a clean slate.
- **Statelessness**: The application's real-time features are robust. Tests **must** rely on these features, not on hacks like `page.reload()`.

### 3. Deterministic Execution: One Test, One Path

- A test must follow a single, predictable execution path.
- **Conditional logic (`if/else`, `try/catch` for control flow) is strictly forbidden.** A test that needs to check for multiple possible outcomes is a confused test and must be refactored.
- **Ambiguous selectors (e.g., using `|` in a regex) are prohibited.** Assert one specific, expected state.

## The Golden Rule: No Flaky Tests

Flakiness is the primary enemy of a useful test suite. Our architecture and principles are designed to eliminate it.

- **`waitForTimeout()` is strictly forbidden.** There are no exceptions. Using it will fail code review.
- **Use Web-First Assertions**: Rely on Playwright's built-in waiting mechanisms. `expect(locator).toBeVisible()` waits automatically.
- **Build Robust Helpers**: For complex asynchronous operations (e.g., waiting for balance calculations), create dedicated, polling-based helper methods within the Page Object. These methods should repeatedly check the DOM for a specific state until it is met or a timeout is exceeded.
- Don't use `page.waitForURL(...`, instead use `expect(page).toHaveURL(...` which has a built-in short timeout

**Example: A Robust Waiting Helper**

```typescript
// In your Page Object
async waitForSettledUpMessage(timeout: number = 5000): Promise<void> {
  // Use expect().toPass() to poll for a condition
  await expect(async () => {
    const count = await this.page.getByText('All settled up!').count();
    if (count === 0) {
      throw new Error('No "All settled up!" text found yet');
    }
  }).toPass({ timeout });
}
```

## Page Object Model (POM): The Source of Truth

All UI interactions **must** be abstracted through Page Objects. Direct use of `page.locator()` or `page.getByRole()` within a test file is a violation of this pattern.

### Key Responsibilities of a Page Object:

1.  **Selector Encapsulation**: Centralize all element selectors.
2.  **Action Abstraction**: Provide clear, semantic methods for user actions (e.g., `createGroup()`, `addExpense()`).
3.  **State Verification**: Include methods that assert the page is in a correct state.
4.  **Framework-Specific Handling**: Encapsulate workarounds for framework behavior (e.g., `fillPreactInput()` for Preact signals).

### The Base Page: Standardize Common Actions

To ensure consistency, a `BasePage` should provide standardized methods for common interactions.

**Example: Standardized Button Click**

```typescript
// In BasePage
async clickButton(button: Locator, options: { buttonName: string }): Promise<void> {
  await expect(button).toBeVisible();
  // Provide detailed error messages if a button is disabled
  await expect(button).toBeEnabled({
    timeout: 1000,
    message: `Button '${options.buttonName}' was not enabled.`
  });
  await button.click();
}
```

## Multi-User Testing: Serialization is Mandatory

Testing real-time collaboration is complex. To eliminate race conditions and ensure deterministic outcomes, all multi-user tests **must serialize operations**.

**The Correct Pattern:**

1.  **User A** performs an action (e.g., creates a group, adds an expense).
2.  **Wait and Verify**: The test waits for the application's real-time updates to propagate.
3.  **Synchronize ALL Users**: The test verifies that **every user's page** correctly and completely reflects the new state _before_ proceeding.
4.  **User B** performs the next action.
5.  Repeat.

**Do NOT perform actions with multiple users in parallel.** This creates a non-deterministic test that is impossible to debug.

**Example: Multi-User Synchronization**

```typescript
// In the test file
const allPages = [
  { page: alicePage, groupDetailPage: aliceGroupDetailPage, userName: 'Alice' },
  { page: bobPage, groupDetailPage: bobGroupDetailPage, userName: 'Bob' }
];

// User Alice creates an expense...
await aliceGroupDetailPage.addExpense(...);

// The test MUST now wait and verify the result for ALL users
await aliceGroupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

// ONLY NOW can Bob safely perform the next action
await bobGroupDetailPage.recordSettlement(...);
```

## Real-Time Updates vs. `page.reload()`

The application has robust real-time data synchronization. Tests **must rely on this functionality**.

- **`page.reload()` is prohibited for state synchronization.** Using it masks bugs in the application's real-time layer.
- A test should only use `page.reload()` when it is _specifically testing the behavior of a browser refresh_ (e.g., auth persistence).

## Test Architecture

The tests are split into 3 group; normal flow (happy path), error testing, and edge cases).

When debugging test failures, first ALWAYS look in `e2e-tests/playwright-report` for the failure report, console logs, screenshots etc.

### Fixtures Hierarchy

```typescript
base-test.ts                    // Base Playwright test with console error reporting
  ↓
authenticated-test.ts           // Provides authenticated page with user
  ↓
authenticated-page-test.ts      // Adds page objects to authenticated test
  ↓
multi-user-test.ts             // Extends for multi-user scenarios
```

### Key Fixtures

#### `authenticatedPageTest`

The most commonly used fixture that provides:

- Pre-authenticated browser session
- All page objects initialized
- Automatic user pool management
- Clean state for each test

```typescript
authenticatedPageTest(
    'should perform authenticated action',
    async ({
        authenticatedPage, // { page: Page, user: User }
        dashboardPage, // DashboardPage instance
        groupDetailPage, // GroupDetailPage instance
        createGroupModalPage, // CreateGroupModalPage instance
    }) => {
        const { page, user } = authenticatedPage;

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Perform test actions...
    },
);
```

#### `multiUserTest`

For tests requiring multiple authenticated users:

```typescript
multiUserTest(
    'multi-user interaction',
    async ({
        authenticatedPage, // First user
        secondUser, // Second user with page and page objects
    }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, user: bob } = secondUser;

        // Test multi-user scenarios...
    },
);
```

## Writing and Debugging Tests

### Test Structure

Follow the existing structure for clarity and consistency. A test should clearly define its purpose, set up its required state, perform a single logical action, and assert the outcome.

### Debugging

1.  **Start with the Playwright HTML Report**: Always check `e2e-tests/playwright-report/` first. It contains traces, console logs, network requests, and screenshots.
2.  **Use the `run-until-fail.sh` script** to reliably reproduce flaky test failures.
3.  **Leverage Enhanced Error Messages**: The `synchronizeMultiUserState` and `clickButton` helpers are designed to provide detailed context when they fail. Read the error messages carefully.

## Build Scripts

```bash
# Run all E2E tests
npm run test:integration

# Run specific test suites
npm run test:e2e:normal-flow    # Happy path tests
npm run test:e2e:error-testing  # Error handling tests
npm run test:e2e:edge-cases     # Edge cases and monitoring

# Build TypeScript (type checking)
npm run build

# Install Playwright browsers
npm run install-browsers
```

## Test Organization

```
src/tests/
├── normal-flow/        # Happy path user journeys
├── error-testing/      # Error handling and validation
└── edge-cases/         # Performance, accessibility, security
```

## Configuration

### Critical: Fast Timeouts & Parallel Execution

- **Action Timeout**: **1.5 seconds** - Forces fast, reliable selectors
- **Global Timeout**: **15 seconds** - Entire test must complete quickly
- **Parallel Execution**: Tests run with **4 workers in parallel**
- **Test Isolation Required**: Every test MUST work when run in any order with any other tests
- **Browser Reuse**: Tests share browser contexts - NEVER assume clean state

**Why Short Timeouts?**

- Forces proper element selectors (no flaky waits)
- Catches performance issues early
- Ensures tests fail fast rather than hanging
- Total test suite runs in under 2 minutes

### Other Settings

- **Browser**: Chromium only (for consistency)
- **Retries**: 2 retries on CI, none locally
- **Reports**: HTML reports in `playwright-report/`

## Best Practices

### ✅ Encouraged Practices

- **Use Fixtures**: Always use fixtures for authentication, page objects, and managing test state.
- **Verify State**: Explicitly verify page state (e.g., URL, visibility of elements) before and after every action.
- **Semantic Selectors**: Prefer user-facing selectors like `getByRole`, `getByLabel`, `getByText`.
- **Use `fillPreactInput()`**: Always use the custom `fillPreactInput()` method for form fields to ensure Preact's signal-based state updates correctly.
- **Atomic & Idempotent Tests**: Each test should be self-contained, create its own data, and clean up after itself to ensure it can run independently and in parallel.
- **Descriptive Naming**: Write clear, descriptive test names that explain what the test does.
- **Logical Grouping**: Group related tests using `describe` blocks.
- **Single, Deterministic Path**: A test should have one clear purpose and a single execution path.

### ❌ Prohibited Practices

- **Ignoring Console Errors**: Console errors MUST fail every test, except for tests specifically designed to assert those errors.
- **Code Duplication**:
    - **Redundant Setup**: Abstract common setup or user "journeys" into shared fixtures or page object methods.
    - **Redundant Behavior**: Avoid re-testing the same feature repeatedly. Focus on distinct scenarios.
- **State Dependency & Ambiguity**:
    - **Test Inter-dependence**: Tests MUST set up their own state completely and MUST NOT rely on the state left by another test.
    - **Conditional Logic**: A test must be deterministic. The following are strictly forbidden as they indicate a test is confused about the application's state:
        - `if/else` blocks.
        - `try/catch` blocks to try one action and then another.
        - Regex patterns with `|` (OR) to match multiple possible outcomes.
- **Skipped or Commented-Out Tests**: `test.skip()` or commented-out tests are NOT ALLOWED. All checked-in tests must run.
- **Future-Facing Tests**: Tests for features that do not yet exist in the application are NOT ALLOWED.
- **Manual State Management**: Do not manually authenticate or create page objects inside tests; use the provided fixtures.
- **Long Timeouts**: Tests must fail quickly. The application is fast, so long timeouts are unnecessary and mask performance issues.
- **Hard-coded Waits**: Do not use `await this.page.waitForTimeout()`. Use web-first assertions and explicit `waitFor` conditions instead.
- **Bespoke selectors**: All code to select on-screen elements should be abstracted away behind a page object model.

### Fixtures Hierarchy

```typescript
base-test.ts                    // Base Playwright test with console error reporting
  ↓
authenticated-test.ts           // Provides authenticated page with user
  ↓
authenticated-page-test.ts      // Adds page objects to authenticated test
  ↓
multi-user-test.ts             // Extends for multi-user scenarios
```

### Key Fixtures

#### `authenticatedPageTest`

The most commonly used fixture that provides:

- Pre-authenticated browser session
- All page objects initialized
- Automatic user pool management
- Clean state for each test

```typescript
authenticatedPageTest(
    'should perform authenticated action',
    async ({
        authenticatedPage, // { page: Page, user: User }
        dashboardPage, // DashboardPage instance
        groupDetailPage, // GroupDetailPage instance
        createGroupModalPage, // CreateGroupModalPage instance
    }) => {
        const { page, user } = authenticatedPage;

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Perform test actions...
    },
);
```

#### `multiUserTest`

For tests requiring multiple authenticated users:

```typescript
multiUserTest(
    'multi-user interaction',
    async ({
        authenticatedPage, // First user
        secondUser, // Second user with page and page objects
    }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, user: bob } = secondUser;

        // Test multi-user scenarios...
    },
);
```

## Page Object Model

All UI interactions go through page objects that encapsulate:

- Element selectors
- Common actions
- State verification methods
- Preact-specific input handling

Never write bespoke selectors in tests. Always use the page object model pattern.

### Base Page Pattern

```typescript
export class SomePage extends BasePage {
    // URL for navigation
    readonly url = '/some-path';

    // Navigation method
    async navigate() {
        await this.page.goto(this.url);
        await this.waitForNetworkIdle();
    }

    // Element accessors (prefer semantic selectors)
    getSubmitButton() {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    // Action methods
    async submitForm(data: FormData) {
        // Always verify state before actions
        await expect(this.page).toHaveURL(/\/expected-url/);

        // Use fillPreactInput for form fields
        await this.fillPreactInput('#input-id', data.value);

        await this.getSubmitButton().click();
    }
}
```

### Important Page Methods

- `fillPreactInput()` - Handles Preact signal updates correctly
- `waitForNetworkIdle()` - Waits for network activity to settle
- `expectUrl()` - Asserts URL matches pattern
- `getUrlParam()` - Extracts parameters from URL

Note: as the site does not yet automatically update when new data is available, it is often necessary to refresh the browser to see changes.

## Automatic Error Handling with Proxy

All page objects automatically benefit from enhanced error handling through a JavaScript Proxy mechanism. This ensures that every test failure includes rich contextual information without developers needing to add error handling code.

### How It Works

When a page object is instantiated, it's automatically wrapped in a proxy that:

1. **Intercepts all method calls** on the page object
2. **Detects async methods** by checking if they return Promises
3. **Wraps Promise-returning methods** with automatic error handling
4. **Enriches errors** with context when failures occur
5. **Preserves synchronous methods** as-is (e.g., Locator getters)

### What Gets Captured on Error

When an async method fails, the proxy automatically captures:

- **Method context**: Class name and method name that failed
- **Current URL**: The page URL at time of error
- **Method arguments**: Sanitized arguments passed to the method
- **User information**: If available, the test user's email and display name
- **Page state**: Including:
    - Visible buttons and their enabled/disabled state
    - Visible headings
    - Visible error messages
    - Form input states
    - Dialog presence
    - Loading indicators
- **Stack trace**: Full error stack for debugging

### What You SHOULD Do

✅ **Write methods normally** - The proxy handles errors automatically:

```typescript
// Good - Simple, clean async method
async submitForm() {
    const button = this.getSubmitButton();
    await this.clickButton(button);
    // No try-catch needed! Proxy adds context if this fails
}
```

✅ **Keep Locator getters synchronous** - Return Locators directly:

```typescript
// Good - Synchronous getter
getSubmitButton() {
    return this.page.getByRole('button', { name: 'Submit' });
}
```

✅ **Use async for methods that perform actions**:

```typescript
// Good - Async method gets automatic error handling
async fillAndSubmit(data: FormData) {
    await this.fillPreactInput('#name', data.name);
    await this.submitForm();
}
```

✅ **Let errors bubble up naturally**:

```typescript
// Good - Natural error flow
async validateAndSubmit() {
    await this.validate(); // If this fails, proxy adds context
    await this.submit();   // Clean, readable code
}
```

### What You SHOULD NOT Do

❌ **Don't add try-catch blocks** - The proxy handles this:

```typescript
// Bad - Unnecessary and loses proxy context
async login() {
    try {
        await this.fillForm();
    } catch (error) {
        throw new Error('Login failed'); // Loses rich context!
    }
}

// Good - Let proxy handle it
async login() {
    await this.fillForm(); // Proxy adds context automatically
}
```

❌ **Don't make getters async unnecessarily**:

```typescript
// Bad - Creates unnecessary Promise
async getSubmitButton() {
    return this.page.getByRole('button');
}

// Good - Keep it synchronous
getSubmitButton() {
    return this.page.getByRole('button');
}
```

❌ **Don't create your own error wrappers**:

```typescript
// Bad - Double wrapping
async submit() {
    throw new ProxiedMethodError(...); // Don't do this!
}

// Good - Throw simple errors
async submit() {
    if (!valid) {
        throw new Error('Form is invalid'); // Proxy will wrap this
    }
}
```

### Configuration

The proxy is configured in `BasePage` constructor with these options:

```typescript
{
    captureScreenshot: false,  // Can be enabled for debugging
    collectState: true,        // Always collect page state
    excludeMethods: [          // Methods to exclude from proxying
        'page',                // Property getter
        'waitForFocus',        // Private helper
        'getFieldIdentifier',  // Private helper
        // Add other methods as needed
    ]
}
```

### Excluded Methods

By default, these method patterns are excluded from proxying:

- Methods starting with `get*`, `is*`, `has*` (typically synchronous getters)
- Private methods starting with underscore
- Standard object methods (`constructor`, `toString`, `valueOf`, `toJSON`)
- Methods explicitly listed in `excludeMethods` config

### Example Error Output

When a test fails, you'll see rich error messages like:

```
ExpenseFormPage.submitExpense failed: Button "Save Expense" is disabled.

Context:
- URL: http://localhost:9099/groups/abc123/expenses/new
- User: test@example.com (Test User)
- Method: submitExpense
- Arguments: { amount: "50.00", description: "Lunch" }

Page State:
- Visible errors: ["Amount is required", "Please select a payer"]
- Visible buttons: ["Cancel", "Save Expense (disabled)"]
- Form inputs: { description: "", amount: "", payer: "(not selected)" }
- Loading indicators: none

Stack trace:
  at ExpenseFormPage.submitExpense (expense-form.page.ts:45:10)
  at Context.<anonymous> (expense.test.ts:23:5)
```

### Special Cases

#### Custom Error Handling

If you need special error handling (e.g., retry logic), you can still use try-catch:

```typescript
async tryLogin(maxAttempts = 3) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await this.login();
            return; // Success
        } catch (error) {
            if (i === maxAttempts - 1) throw error;
            await this.page.waitForTimeout(1000);
        }
    }
}
```

#### Excluding Methods from Proxy

To exclude a method from automatic error handling, add it to the `excludeMethods` array in `base.page.ts`:

```typescript
excludeMethods: [
    'mySpecialMethod', // Won't be proxied
    'anotherMethod', // Handle errors manually here
];
```

### Benefits

1. **Consistent error reporting** - Every async method failure includes context
2. **Zero developer overhead** - No need to remember error handling patterns
3. **Rich debugging information** - See exactly what the page looked like when it failed
4. **Prevents common mistakes** - Can't forget to add error context
5. **Maintains clean code** - Page objects remain simple and readable

The proxy ensures that when tests fail, you have all the information needed to debug quickly, without cluttering your page objects with repetitive error handling code.

## Writing Tests

### Test Structure

```typescript
import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting } from '../../helpers';

authenticatedPageTest.describe('Feature Name', () => {
    authenticatedPageTest(
        'should do something specific',
        async ({
            authenticatedPage,
            dashboardPage,
            // ... other page objects
        }) => {
            const { page, user } = authenticatedPage;

            // 1. Verify starting state
            await expect(page).toHaveURL(/\/dashboard/);

            // 2. Navigate if needed
            await dashboardPage.createGroupAndNavigate('Test Group');

            // 3. Assert new state
            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);

            // 4. Perform test actions
            // ...

            // 5. Verify outcomes
            await expect(someElement).toBeVisible();
        },
    );
});
```

### Common Patterns

#### Creating a Group

```typescript
const groupId = await dashboardPage.createGroupAndNavigate('Group Name', 'Description');
await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
```

#### Form Validation Testing

```typescript
// Use authenticated fixture for proper state
authenticatedPageTest('form validation', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;

    // Verify dashboard state
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to form
    await dashboardPage.createGroupAndNavigate('Test Group');

    // Test validation...
});
```

#### Multi-User Scenarios

```typescript
multiUserTest('user collaboration', async ({ authenticatedPage, secondUser }) => {
    const { page: alicePage } = authenticatedPage;
    const { page: bobPage } = secondUser;

    // Both users start authenticated on dashboard
    await expect(alicePage).toHaveURL(/\/dashboard/);
    await expect(bobPage).toHaveURL(/\/dashboard/);

    // Collaboration logic...
});
```

## Build Scripts

```bash
# Run all E2E tests
npm run test:integration

# Run specific test suites
npm run test:e2e:normal-flow    # Happy path tests
npm run test:e2e:error-testing  # Error handling tests
npm run test:e2e:edge-cases     # Edge cases and monitoring

# Build TypeScript (type checking)
npm run build

# Install Playwright browsers
npm run install-browsers
```

## Test Organization

```
src/tests/
├── normal-flow/        # Happy path user journeys
├── error-testing/      # Error handling and validation
└── edge-cases/         # Performance, accessibility, security
```

## Configuration

### Critical: Fast Timeouts & Parallel Execution

- **Action Timeout**: **1.5 seconds** - Forces fast, reliable selectors
- **Global Timeout**: **15 seconds** - Entire test must complete quickly
- **Parallel Execution**: Tests run with **4 workers in parallel**
- **Test Isolation Required**: Every test MUST work when run in any order with any other tests
- **Browser Reuse**: Tests share browser contexts - NEVER assume clean state

**Why Short Timeouts?**

- Forces proper element selectors (no flaky waits)
- Catches performance issues early
- Ensures tests fail fast rather than hanging
- Total test suite runs in under 2 minutes

### Other Settings

- **Browser**: Chromium only (for consistency)
- **Retries**: 2 retries on CI, none locally
- **Reports**: HTML reports in `playwright-report/`

## Best Practices

### ✅ Encouraged Practices

- **Use Fixtures**: Always use fixtures for authentication, page objects, and managing test state.
- **Verify State**: Explicitly verify page state (e.g., URL, visibility of elements) before and after every action.
- **Semantic Selectors**: Prefer user-facing selectors like `getByRole`, `getByLabel`, `getByText`.
- **Use `fillPreactInput()`**: Always use the custom `fillPreactInput()` method for form fields to ensure Preact's signal-based state updates correctly.
- **Atomic & Idempotent Tests**: Each test should be self-contained, create its own data, and clean up after itself to ensure it can run independently and in parallel.
- **Descriptive Naming**: Write clear, descriptive test names that explain what the test does.
- **Logical Grouping**: Group related tests using `describe` blocks.
- **Single, Deterministic Path**: A test should have one clear purpose and a single execution path.

### ❌ Prohibited Practices

- **Ignoring Console Errors**: Console errors MUST fail every test, except for tests specifically designed to assert those errors.
- **Code Duplication**:
    - **Redundant Setup**: Abstract common setup or user "journeys" into shared fixtures or page object methods.
    - **Redundant Behavior**: Avoid re-testing the same feature repeatedly. Focus on distinct scenarios.
- **State Dependency & Ambiguity**:
    - **Test Inter-dependence**: Tests MUST set up their own state completely and MUST NOT rely on the state left by another test.
    - **Conditional Logic**: A test must be deterministic. The following are strictly forbidden as they indicate a test is confused about the application's state:
        - `if/else` blocks.
        - `try/catch` blocks to try one action and then another.
        - Regex patterns with `|` (OR) to match multiple possible outcomes.
- **Skipped or Commented-Out Tests**: `test.skip()` or commented-out tests are NOT ALLOWED. All checked-in tests must run.
- **Future-Facing Tests**: Tests for features that do not yet exist in the application are NOT ALLOWED.
- **Manual State Management**: Do not manually authenticate or create page objects inside tests; use the provided fixtures.
- **Long Timeouts**: Tests must fail quickly. The application is fast, so long timeouts are unnecessary and mask performance issues.
- **Hard-coded Waits**: Do not use `await this.page.waitForTimeout()`. Use web-first assertions and explicit `waitFor` conditions instead.
- **Bespoke selectors**: All code to select on-screen elements should be abstracted away behind a page object model.

## Debugging

### Console Error Reporting

Tests automatically report console errors. Use `setupConsoleErrorReporting()` in your test file.

### MCP Debug on Failure

Captures additional debug info on test failure. Use `setupMCPDebugOnFailure()`.

### Playwright Inspector

```bash
PWDEBUG=1 npm run test:e2e:normal-flow
```

### View Traces

```bash
npx playwright show-trace trace.zip
```

## Common Issues

### Tests Fail Due to Wrong Page State

**Problem**: Test assumes it's on a specific page but browser is elsewhere
**Solution**: Always verify and establish starting state:

```typescript
// Verify we're on dashboard
await expect(page).toHaveURL(/\/dashboard/);
```

### Authentication Issues

**Problem**: Test tries to manually handle authentication
**Solution**: Use `authenticatedPageTest` fixture which handles auth automatically

### Form Input Not Updating

**Problem**: Playwright's `fill()` doesn't trigger Preact signals
**Solution**: Use `fillPreactInput()` method from BasePage

### Parallel Test Interference

**Problem**: Tests interfere with each other when run in parallel
**Solution**: Ensure tests are truly isolated and use unique test data

## Contributing

When adding new tests:

1. Choose the appropriate fixture (`authenticatedPageTest` for most cases)
2. Add page objects for new UI components
3. Follow existing patterns for consistency
4. Ensure tests work in parallel execution
5. Verify tests work with browser reuse
6. Add meaningful descriptions to test names
7. Group related tests logically

## Test Infrastructure Details

### Screenshot and Report Locations

- Playwright HTML reports are saved to `e2e-tests/playwright-report/<type>/` (where type is typically `ad-hoc`, `normal`, `errors` or `edge` depending on the test group being run)
- The main report file is `index.html` in the specified directory
- Screenshots and other assets are automatically organized in subdirectories (e.g., `data/`)
- This is Playwright's default behavior for HTML reports

### Real-Time Updates and Synchronization

**Important**: The app uses real-time updates. Tests should rely on these rather than manual refreshes.

**Best Practices**:

- Avoid using `page.reload()` as it can hide real-time update bugs
- Wait for loading spinners to disappear before assertions
- Use `waitForLoadState('domcontentloaded')` instead of `networkidle` to avoid timeouts
- Check for specific elements like `.animate-spin` or `[role="status"]` to detect loading states

### Multi-User Test Patterns

When testing with multiple users, pass user names for better error reporting:

```typescript
const allPages = [
    { page, groupDetailPage, userName: user1.displayName },
    { page: page2, groupDetailPage: groupDetailPage2, userName: user2.displayName },
    { page: page3, groupDetailPage: groupDetailPage3, userName: user3.displayName },
];

await groupDetailPage.synchronizeMultiUserState(allPages, 3, groupId);
```

The `synchronizeMultiUserState` method:

1. Navigates all users to the group page
2. Checks for 404 or dashboard redirects
3. Waits for member count to update
4. Waits for balances to load
5. Takes screenshots on failure with user identification

To debug navigation issues:

1. Check screenshots in `playwright-report/ad-hoc/data/` to see actual page state
2. Look for user identification in error messages
3. Review console logs for API errors or unexpected redirects
4. Consider whether real-time updates are causing navigation issues

## Making Tests Resilient to Text Changes

When implementing internationalization (i18n) or making text changes, e2e tests can break if they rely on hardcoded text selectors. Follow these patterns to make tests more resilient:

### Import Translation Files in Page Objects

Instead of hardcoding text in page objects, import and use the same translation files used by the application:

```typescript
// In page objects (e.g., create-group-modal.page.ts)
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class CreateGroupModalPage extends BasePage {
    // Use translation keys instead of hardcoded text
    readonly modalTitle = translationEn.createGroupModal.title;

    async isOpen(): Promise<boolean> {
        return await this.page.getByRole('heading', { name: this.modalTitle }).isVisible();
    }

    async submitForm() {
        const submitButton = this.page.getByRole('button', { name: translationEn.createGroupModal.submitButton });
        await this.clickButton(submitButton, {
            buttonName: translationEn.createGroupModal.submitButton,
        });
    }
}
```

### Update All Text-Based Selectors

When refactoring page objects for i18n compatibility, update these common text-based selectors:

- **Modal/Dialog titles**: `getByRole('heading', { name: translationKey })`
- **Button text**: `getByRole('button', { name: translationKey })`
- **Input placeholders**: `getByPlaceholder(translationKey)`
- **Input labels**: `getByLabel(translationKey)`
- **Link text**: `getByRole('link', { name: translationKey })`
- **Error messages**: Use translation keys for validation messages

### Example Refactor Pattern

**Before (brittle to text changes):**

```typescript
async createGroup(name: string) {
    await this.page.getByRole('heading', { name: 'Create New Group' }).waitFor();
    await this.page.getByPlaceholder('e.g., Apartment Expenses').fill(name);
    await this.page.getByRole('button', { name: 'Create Group' }).click();
}
```

**After (resilient to text changes):**

```typescript
async createGroup(name: string) {
    await this.page.getByRole('heading', { name: translationEn.createGroupModal.title }).waitFor();
    await this.page.getByPlaceholder(translationEn.createGroupModal.groupNamePlaceholder).fill(name);
    await this.page.getByRole('button', { name: translationEn.createGroupModal.submitButton }).click();
}
```

### JSON Import Requirements

When importing JSON translation files in TypeScript/ES modules, use the proper import syntax:

```typescript
// Correct ES module JSON import
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };
```

### Testing Text Changes

When making text changes:

1. **Update translation files first** - Make changes in `webapp-v2/src/locales/en/translation.json`
2. **Run affected e2e tests** - Use `e2e-tests/run-until-fail.sh` to test specific components
3. **Update page objects if needed** - Only if new translation keys are added
4. **Avoid hardcoded text** - Never add new hardcoded strings in page objects

### Benefits of This Approach

- **Single source of truth** - Text changes only need to be made in translation files
- **Automatic test updates** - Tests automatically use new text when translations change
- **i18n compatibility** - Tests work with any language by importing different translation files
- **Reduced maintenance** - No need to update tests for every text change
- **Consistency** - Tests use exactly the same text as the application

### Common Pitfalls to Avoid

❌ **Don't hardcode text in tests:**

```typescript
// Bad - breaks when text changes
await page.getByText('Create New Group').click();
```

❌ **Don't use regex when exact text is available:**

```typescript
// Bad - fragile and ambiguous
await page.getByText(/Create.*Group/i).click();
```

✅ **Do use translation keys:**

```typescript
// Good - resilient to text changes
await page.getByText(translationEn.createGroupModal.title).click();
```
