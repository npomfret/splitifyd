# E2E Testing Guide for Splitifyd

## Overview

This project uses Playwright for end-to-end testing with a robust architecture designed for parallel execution, test isolation, and maintainability. The tests run against the Firebase emulator to ensure a consistent testing environment.

## Core Principles

### 1. Fast & Parallel Execution
- **1 second action timeout** - No flaky selectors or slow operations allowed
- **10 second test timeout** - Tests must complete quickly or fail
- **4 parallel workers** - Tests run simultaneously and must not interfere
- **Browser reuse between tests** - Never assume clean browser state

### 2. Test Isolation
- **Every test must be self-contained** - Tests should not depend on the state left by previous tests
- **Explicit state setup** - Always verify and establish the expected starting state
- **Browser context reuse** - Tests must work when the browser is reused from previous tests
- **Clean teardown** - Tests clean up after themselves using fixtures

### 3. Fixtures Over Bare Tests
- **Always use appropriate fixtures** instead of bare `test()` calls
- **Authentication is handled by fixtures** - Never manually authenticate in tests
- **Page objects are provided by fixtures** - Access page objects through fixture parameters

### 4. State Verification
- **Always assert navigation state** - Verify URLs and page content before performing actions
- **Fail fast on unexpected state** - Tests should immediately fail if preconditions aren't met
- **Use explicit waits** - Wait for specific conditions rather than arbitrary timeouts

## Test Architecture

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
authenticatedPageTest('should perform authenticated action', async ({ 
  authenticatedPage,    // { page: Page, user: User }
  dashboardPage,        // DashboardPage instance
  groupDetailPage,      // GroupDetailPage instance
  createGroupModalPage  // CreateGroupModalPage instance
}) => {
  const { page, user } = authenticatedPage;
  
  // Verify starting state
  await expect(page).toHaveURL(/\/dashboard/);
  
  // Perform test actions...
});
```

#### `multiUserTest`
For tests requiring multiple authenticated users:

```typescript
multiUserTest('multi-user interaction', async ({ 
  authenticatedPage,  // First user
  secondUser         // Second user with page and page objects
}) => {
  const { page: alicePage, user: alice } = authenticatedPage;
  const { page: bobPage, user: bob } = secondUser;
  
  // Test multi-user scenarios...
});
```

## Page Object Model

All UI interactions go through page objects that encapsulate:
- Element selectors
- Common actions
- State verification methods
- Preact-specific input handling

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

## Writing Tests

### Test Structure

```typescript
import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Feature Name', () => {
  authenticatedPageTest('should do something specific', async ({ 
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
  });
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

- **Action Timeout**: **1 second** - Forces fast, reliable selectors
- **Global Timeout**: **10 seconds** - Entire test must complete quickly  
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
- **Hard-coded Waits**: Do not use `waitForTimeout()`. Use web-first assertions and explicit `waitFor` conditions.

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