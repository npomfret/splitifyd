# Testing

## Philosophy

**Two test types:**
- **Unit tests** - No emulator required, test isolated code
- **Integration tests** - Require Firebase emulator or a browser (via Playwright)

**Principles:**
- Reliability > Speed > Everything else
- No flaky tests
- No skipped tests
- Test isolation - no dependencies between tests
- Focus on behavior, not implementation
- Test complexity must be lower code complexity -> extract complex test code into classes

## Tech Stack

- **Vitest** - Unit test runner
- **Playwright** - Browser testing (E2E + webapp unit tests)
- **Firebase Emulator** - Backend integration tests

## Commands

Avoid runnning entier suites, they are often very slow.  Focus on running specific test cases.

```bash
# Root (all workspaces)
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests

# Single unit test:
npx vitest run src/__tests__/unit/your-test.test.ts

# Webapp-v2 Playwright tests (MUST use wrapper script)
cd webapp-v2
./run-test.sh login                    # Run login.test.ts
./run-test.sh login "specific test"    # Run specific test
./run-test.sh login --headed           # Debug with visible browser
./run-test.sh login --repeat 10        # Flakiness detection

# E2E tests (edit the run-until-fail.sh file to specify a test file and test case)
cd e2e-tests
./run-until-fail.sh 1                   # Run and e2e test against the debugger
```

## Build System: No-Compile Development

**Development mode** (`BUILD_MODE=development`):
- Uses `tsx` to execute TypeScript directly
- Instant startup, no compilation
- `npm run dev` starts immediately

**Test mode** (`BUILD_MODE=test`):
- Auto-set by test harness
- Tests run against compiled output where needed

**Production mode** (`BUILD_MODE=production`):
- Full TypeScript compilation
- `BUILD_MODE=production npm run build`

## Directory Structure

Co-located tests:
```
src/
  __tests__/
    unit/
    integration/
```

## Builder Pattern (MANDATORY)

**All test data creation uses builders. Manual object creation is prohibited.**

```typescript
// ❌ DON'T
const expense = {
    amount: "50.00",
    description: "Lunch",
    currency: "USD",
    groupId: "abc123",
    // ... 10 more unimportant fields
};

// ✅ DO
const expense = new CreateExpenseRequestBuilder()
    .withAmount("50.00")
    .withDescription("Lunch")
    .build();
```

**Builders:**

All builders live in `packages/test-support`. If tehre isn't a builder for your data object, create one.

## Async Testing: Polling Pattern

**Never use arbitrary sleeps. Always poll for conditions.**

```typescript
// ❌ DON'T
await new Promise(resolve => setTimeout(resolve, 2000));
const data = await fetchData();

// ✅ DO
const data = await pollUntil(
    () => fetchData(),
    (result) => result.status === 'completed',
    { timeout: 5000, errorMsg: 'Operation did not complete' }
);
```

**For Firebase triggers:**
```typescript
// ✅ Use helper
import { pollForChange } from '../support/changeCollectionHelpers';

const change = await pollForChange(
    FirestoreCollections.TRANSACTION_CHANGES,
    (doc) => doc.id === expectedId && doc.type === 'settlement',
    { timeout: 5000, groupId }
);
```

## E2E Testing with Playwright

### Core Principles

Always look at surrounding tests to see what patterns are in use.

**Speed & Isolation:**
- The app is very asynchronous, always wait for things to happen, but don't over-wait else failiures will slow down the build
- Browser reuse between tests - never assume clean state

**Determinism:**
- Single execution path per test
- No `if/else`, no `try/catch` for control flow
- No conditional regex (`|`) in selectors
- No `page.waitForTimeout()` - strictly forbidden

**State Verification:**
- Verify state everywhere, fail early
- Always assert navigation: `await expect(page).toHaveURL(/\/dashboard/)`
- Use Web-First assertions: `expect(locator).toBeVisible()` (auto-waits)

### Page Object Model (MANDATORY)

**ALL UI interactions through Page Objects. No raw selectors in tests.**

```typescript
// ❌ PROHIBITED in test files
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Welcome')).toBeVisible();
const isDisabled = await page.getByRole('button').isDisabled();

// ✅ REQUIRED - everything through page objects
const loginPage = new LoginPage(page);
await loginPage.login(email, password);

const dashboardPage = new DashboardPage(page);
await dashboardPage.verifyWelcomeMessageVisible();
await expect(dashboardPage.getSubmitButton()).toBeEnabled();
```

**Page Object Structure:**
```typescript
export class SomePage extends BasePage {
    readonly url = '/some-path';

    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.waitForNetworkIdle();
    }

    // Locator getters (synchronous)
    getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    // Action methods (async, return next page)
    async submitAndNavigate(): Promise<NextPage> {
        await this.clickButton(this.getSubmitButton(), { buttonName: 'Submit' });
        await expect(this.page).toHaveURL(/\/next/);
        return new NextPage(this.page);
    }

    // Verification methods
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getHeading()).toBeVisible();
    }
}
```

### Selector Priority

1. **ARIA roles/labels** - `getByRole('button', { name: 'Submit' })`
2. **Visible text** - `getByRole('heading', { name: 'Settings' })`
3. **Form labels** - `getByLabel('Email address')`
4. **Placeholders** - `getByPlaceholder('Enter amount')`
5. **Test IDs (last resort)** - `getByTestId('user-menu')` - only when semantic options don't exist

**Prohibited:**
- CSS classes: `.text-sm.font-medium`
- CSS selectors: `div > ul > li:nth-child(2)`
- XPath: `//div[@class="container"]`

### Fluent Methods

```typescript
// ✅ Single deterministic path
async login(email: string, password: string): Promise<DashboardPage> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
    await expect(this.page).toHaveURL(/\/dashboard/);
    return new DashboardPage(this.page);
}

// Test - readable chaining
const dashboardPage = await loginPage.login(email, password);
const groupPage = await dashboardPage.createGroupAndNavigate('My Group');
```

**Prohibited:**
```typescript
// ❌ Conditional returns - test doesn't know what to expect
async submitForm(): Promise<DashboardPage | ErrorPage> {
    await this.clickSubmit();
    if (await this.page.getByText('Error').isVisible()) {
        return new ErrorPage(this.page);
    }
    return new DashboardPage(this.page);
}

// ✅ Separate methods for different outcomes
async submitAndExpectSuccess(): Promise<DashboardPage> { }
async submitAndExpectError(): Promise<void> { }
```

### Multi-User Testing

**Serialize ALL operations:**

```typescript
const allPages = [
    { page: alicePage, groupDetailPage: aliceGroupDetailPage, userName: 'Alice' },
    { page: bobPage, groupDetailPage: bobGroupDetailPage, userName: 'Bob' }
];

// Alice acts
await aliceGroupDetailPage.addExpense(...);

// WAIT for sync on ALL users
await aliceGroupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

// ONLY NOW can Bob act
await bobGroupDetailPage.recordSettlement(...);
```

**Never perform actions in parallel - creates non-deterministic tests.**

### Real-Time Updates

**Rely on app's real-time sync. `page.reload()` prohibited for state sync.**

Use `page.reload()` ONLY when testing browser refresh behavior (e.g., auth persistence).

### Automatic Error Context (Proxy)

Page Objects automatically wrapped with proxy that captures on error:
- Method context (class, method name)
- Current URL
- Method arguments (sanitized)
- User info
- Page state (buttons, headings, errors, form inputs, loading indicators)

**Write clean methods - proxy adds context:**
```typescript
// ✅ Simple, clean - proxy handles errors
async submitForm(): Promise<void> {
    await this.clickButton(this.getSubmitButton());
    // No try-catch needed
}

// ❌ Don't add try-catch - loses proxy context
async submitForm(): Promise<void> {
    try {
        await this.clickButton(this.getSubmitButton());
    } catch (error) {
        throw new Error('Submit failed'); // Loses rich context
    }
}
```

### i18n Resilience

**Import translation files instead of hardcoding text:**

```typescript
// In page objects
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class CreateGroupModalPage extends BasePage {
    readonly modalTitle = translationEn.createGroupModal.title;

    async isOpen(): Promise<boolean> {
        return await this.page.getByRole('heading', { name: this.modalTitle }).isVisible();
    }
}
```

**Benefits:**
- Single source of truth
- Automatic test updates when translations change
- i18n compatible
- No maintenance for text changes

### Prohibited Practices

**Absolutely forbidden:**
- ❌ `page.waitForTimeout()` - use condition-based waiting
- ❌ `page.setContent()` - always navigate to real pages
- ❌ Raw selectors in tests - use Page Objects
- ❌ Conditional logic in tests (`if/else`, `try/catch` for control flow)
- ❌ Skipped tests (`test.skip()`)
- ❌ Console errors (except tests specifically asserting them)
- ❌ `page.reload()` for state sync - rely on real-time updates
- ❌ Parallel multi-user actions - serialize operations

### Configuration

**Timeouts:**
- Action: 1.5s
- Test: 15s
- Total suite: <2 min

**Execution:**
- 4 workers in parallel
- Browser reuse between tests
- 2 retries on CI, none locally

**Reports:**
- HTML reports: `e2e-tests/playwright-output/<type>/report/`
- Console logs, screenshots, traces all captured

### Common Patterns

```typescript
// Create group
const groupId = await dashboardPage.createGroupAndNavigate('Group Name');
await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);

// Form validation
await loginPage.submitAndExpectError();
await expect(loginPage.getErrorMessage()).toContainText('Invalid credentials');

// Waiting for async state
await expect(async () => {
    const count = await groupDetailPage.getMemberCount();
    expect(count).toBe(3);
}).toPass({ timeout: 5000 });
```

### Debugging

1. **Check `playwright-output/` first** - traces, console logs, screenshots
2. **Use `run-until-fail.sh`** - reproduce flaky failures
3. **Read error messages** - proxy provides detailed context
4. **Never serve HTML report** - use `PLAYWRIGHT_HTML_OPEN=never`

## Guidelines Summary

**DO:**
- Use builders for all test data
- Poll for conditions, never sleep
- Use fixtures for auth and page objects
- Verify state before/after every action
- Write deterministic tests (single path)
- Fail fast with clear error messages
- Use semantic selectors
- Keep tests < code complexity

**DON'T:**
- Create test data manually
- Use `waitForTimeout()` or `sleep()`
- Use raw selectors in tests
- Write conditional test logic
- Skip or comment out tests
- Test non-existent features
- Ignore console errors
- Use `page.setContent()`
- Reload page for state sync
