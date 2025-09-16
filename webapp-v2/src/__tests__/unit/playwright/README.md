# Webapp Unit Tests (Playwright)

## Purpose

These are **unit tests** for webapp components that run in a real browser environment using Playwright. They test component behavior and user interactions without external dependencies.

## Testing Philosophy

### ✅ What SHOULD be tested here:

- **User behaviors**: Form submission, input validation, navigation flows
- **Component interactions**: Button enable/disable, form state management
- **Browser APIs**: localStorage, sessionStorage, URL parameter handling
- **Client-side routing**: Navigation between pages, URL preservation
- **DOM manipulation**: Dynamic content, accessibility attributes
- **Input handling**: Form validation, field persistence, user interactions

### ❌ What should NOT be tested here:

- **Backend integration**: These are unit tests - no API calls to real servers
- **Firebase authentication**: Mock at the network level or skip entirely
- **Database operations**: No Firestore, no emulator dependencies
- **Complex business logic**: That belongs in Vitest unit tests
- **E2E user journeys**: Use the main e2e-tests directory for full workflows
- **Implementation details**: Don't test internal React/Preact state

## Test Structure

### Network Mocking

When external calls are unavoidable, mock at the network level:

```typescript
await page.route('**/api/endpoint**', (route) => {
    route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
});
```

### Focus on Behavior

```typescript
// ✅ Good - tests user behavior
test('form prevents submission when fields are empty', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
});

// ❌ Bad - tests implementation details
test('form has correct CSS classes', async ({ page }) => {
    await expect(page.locator('.form-container')).toHaveClass('login-form');
});
```

### Test Independence

- Each test should be completely independent
- Clear storage/state in beforeEach
- Don't rely on test execution order
- Mock external dependencies, don't use real APIs

## Guidelines

1. **Keep tests simple** - Simpler than the code they test
2. **Test behaviors** - What users can do, not how it's implemented
3. **Fast execution** - No network calls, no emulator dependencies
4. **Deterministic** - Same result every time
5. **Single responsibility** - One behavior per test
6. **Clear naming** - Test name should describe the behavior

## Example Test Patterns

### Form Validation

```typescript
test('submit button enabled only when required fields are filled', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');

    await expect(submitButton).toBeDisabled();

    await page.fill('#email-input', 'user@example.com');
    await expect(submitButton).toBeDisabled(); // Still disabled, need password

    await page.fill('#password-input', 'password123');
    await expect(submitButton).toBeEnabled(); // Now enabled
});
```

### Navigation

```typescript
test('clicking forgot password navigates to reset page', async ({ page }) => {
    await page.click('button:has-text("Forgot")');
    await expect(page).toHaveURL('/reset-password');
});
```

### State Persistence

```typescript
test('form fields persist in sessionStorage', async ({ page }) => {
    await page.fill('#email-input', 'test@example.com');

    const storedEmail = await page.evaluate(() => sessionStorage.getItem('login-email'));
    expect(storedEmail).toBe('test@example.com');
});
```

## Running Tests

```bash
# Run all Playwright tests
npx playwright test

# Run specific test file
npx playwright test login-page.test.ts

# Run with UI mode for debugging
npx playwright test --ui

# Run tests in parallel
npm run test:unit  # Runs both Vitest and Playwright tests
```

## When to Use vs Alternatives

**Use these Playwright tests when:**

- Testing browser-specific behavior (localStorage, navigation, DOM events)
- Testing form interactions and validation
- Testing client-side routing and URL handling
- Testing component behavior that requires a real DOM

**Use Vitest unit tests when:**

- Testing pure functions and business logic
- Testing component props and rendering
- Testing utilities and helpers
- Testing anything that doesn't require a browser

**Use E2E tests when:**

- Testing complete user workflows
- Testing integration between frontend and backend
- Testing with real authentication and data
- Testing cross-page user journeys

## Debugging

When tests fail:

1. Run with `--headed` flag to see the browser
2. Use `page.pause()` to inspect state
3. Check screenshots in `playwright-report/`
4. Use browser dev tools in headed mode

## Recent Improvements

### Shared Test Helpers (`test-helpers.ts`)

We've created a comprehensive set of reusable test utilities:

**Key helpers:**

- `setupTestPage()` - Standard page setup with auth/storage clearing
- `fillFormField()` - Type-safe form filling with validation
- `expectButtonState()` - Consistent button state assertions
- `verifyNavigation()` - Navigation verification with proper timeouts
- `testFormValidation()` - Systematic form validation testing
- `testSessionStoragePersistence()` - Storage persistence testing

**Centralized constants:**

- `SELECTORS` - All CSS selectors in one place
- `TEST_SCENARIOS` - Common test data (emails, passwords, etc.)

**Benefits:**

- Eliminated duplication across 34 tests
- Consistent patterns and better maintainability
- More reliable tests with proper waits
- Faster development of new tests

### Test Structure Improvements

**Before:**

```typescript
test('form renders elements', async ({ page }) => {
    await expect(page.locator('#email-input')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();
    // ... repetitive checks
});
```

**After:**

```typescript
test('should render all required form elements', async ({ page }) => {
    await expectElementVisible(page, SELECTORS.EMAIL_INPUT);
    await verifyFormAccessibility(page, [{ selector: SELECTORS.EMAIL_INPUT, type: 'email' }]);
});
```

### Performance Optimizations

- **Fast timeouts:** 10s test timeout, 5s action timeout
- **Single worker:** Consistent execution with `workers: 1`
- **Reduced retries:** Faster feedback on failures
- **Better waits:** Replaced hardcoded timeouts with proper conditions

**Result:** Tests complete in ~30s instead of timing out

### Current Test Coverage

| Page           | Tests | Status                                |
| -------------- | ----- | ------------------------------------- |
| Login          | 7     | ✅ All passing                        |
| Register       | 10    | ✅ All passing                        |
| Reset Password | 10    | ⚠️ Some limitations due to Firebase   |
| Join Group     | 7     | ⚠️ Limited by ProtectedRoute          |
| Settings       | 2     | ✅ Protected route behavior           |
| Pricing        | 6     | ✅ Full content and interaction tests |
| Landing        | 1     | ✅ Basic rendering                    |
| Privacy Policy | 1     | ✅ Basic rendering                    |

**Total: 44 tests with high-quality behavioral coverage**

### Recent Additions

**Settings Page Tests** - Focuses on protected route behavior and authentication flow:

- Redirect to login when accessing protected route
- Preservation of returnUrl for post-login navigation

**Pricing Page Tests** - Comprehensive content and behavioral testing:

- Core pricing sections and plan rendering
- Feature display and humorous content verification
- Call-to-action button functionality
- Page metadata and SEO elements
- Free pricing transparency messaging
- User interaction patterns

The Pricing Page represents an excellent example of comprehensive unit testing for static content, covering user-facing functionality, content verification, and interaction patterns without requiring external dependencies.
