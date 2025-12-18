# Testing

## Philosophy

**Two test types:**
- **Unit tests** - No external dependencies are required
- **Integration tests** - Which either require...
  - the Firebase emulator (e.g. `e2e-tests/src/__tests__/integration`, `firebase/functions/src/__tests__/integration`)
  - a web-browser using Playwright (e.g. `webapp-v2/src/__tests__/integration`). These tests run their own webserver.

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

### Critical Test Suites

We have two high-value test suites that mock/stub Firebase but exercise the vast majority of application code. These are our primary defense against bugs and should be used exhaustively.

**`webapp-v2/src/__tests__/integration/playwright`** — Client-side integration tests

- Uses MSW (Mock Service Worker) to intercept API calls
- Runs real browser via Playwright against the actual webapp
- Exercises the full UI: routing, state management, form validation, API integration
- **Use for:** Exhaustively testing all user flows, edge cases, and error handling in the client
- Fast feedback loop (no emulator needed), ideal for TDD on frontend features
- Tests use builders to provide correctly structured firebase responses
- Tests can be slow to run, be accuracy is far more important than speed

**`firebase/functions/src/__tests__/unit/api`** — Server-side API tests

- Uses Firebase Simulator for in-memory Firestore (no emulator process)
- Calls handlers directly (bypasses HTTP layer)
- Exercises services, validation, business logic, and (simulated) database operations
- **Use for:** Exhaustively testing all API endpoints, authorization, and data transformations
- Extremely fast execution, should cover every API behavior including edge cases
- Can and must be used for very fine grained testing

### Emulator-Based Tests (Coarse-Grained)

These suites run against the full Firebase Emulator and are suited for end-to-end validation:

**`firebase/functions/src/__tests__/integration`** — Backend integration tests

- Requires running emulator
- Tests real HTTP requests against the API
- Use for verifying emulator behavior, Cloud Functions triggers, and cross-service interactions

**`e2e-tests/src/__tests__/integration`** — Full end-to-end tests

- Multi-browser tests with real users against the emulator
- Tests complete user journeys across client and server
- Use for smoke testing, multi-user scenarios, and validating the full stack works together
- Slower to run; rely on the playwright/API tests above for comprehensive coverage

### Firebase Functions API Unit Tests

The tests located in `firebase/functions/src/__tests__/unit/api/` are a critical part of the project's test suite. They are designed to cover all areas of the Firebase backend code.

To ensure they run quickly and reliably, these tests:
- **Bypass the HTTP interface:** They call the underlying function implementations directly.
- **Use the Firebase Simulator:** This provides a local environment which simulates (in-memory) *some* Firebase services, which allows us to avoid the slow Firebase emulator.

When adding or changing any server-side behaviour, these tests should be the first port of call.

## Commands

Avoid running entire suites, they are often very slow. Focus on running specific test cases.

To run single tests, use `run-test.sh`, it is a universal single-test runner (works in src parent). You must `cd` to the correct dir and then:

```bash
npx vitest run file-pattern optional-test-pattern

# eg
cd foo
./run-test.sh login.test.ts                 # Webapp Playwright file match
./run-test.sh login.test.ts "should show"   # Specific test name
```

Notes:
- `file-pattern` is fuzzy; it matches `*.test.ts` under that workspace’s `src`.
- Optional `test-name` passes through to `--grep`/`--testNamePattern`.
- `HEADED=1` opens the Playwright browser. `RUNS=N` repeats N times.
- From inside a workspace (e.g., `cd webapp-v2`), drop the workspace prefix: `./run-test.sh login`.

Avoid running suites, they take too long. To run a suite, these commands can be run from the root or any subdir
```bash
# Root (all workspaces)
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
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

All builders live in `packages/test-support`. If there isn't a builder for your data object, create one.

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
await dashboardPage.verifySubmitButtonEnabled();
```

**CRITICAL RULE: Public Locator Methods Are PROHIBITED**

Page Objects must NOT expose public locator getter methods (e.g., `getSubmitButton()`).
Tests must interact with Page Objects through:
1. **Action methods** - perform operations (click, fill, navigate)
2. **Verification methods** - assert state (verify*, await expect() internally)

**Why this rule exists:**
- Prevents tight coupling between tests and DOM structure
- Encapsulates selector logic within Page Objects
- Makes tests more readable and declarative
- Allows UI changes without touching test code

```typescript
// ❌ PROHIBITED - exposing locators to tests
export class SomePage extends BasePage {
    getSubmitButton(): Locator {  // PUBLIC getter - WRONG!
        return this.page.getByRole('button', { name: 'Submit' });
    }
}

// Test incorrectly depends on DOM details
await expect(somePage.getSubmitButton()).toBeEnabled();
await expect(somePage.getSubmitButton()).toHaveText('Submit');
```

**Page Object Structure:**
```typescript
export class SomePage extends BasePage {
    readonly url = '/some-path';

    // ✅ Locator getters - PROTECTED (internal use only)
    protected getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    protected getHeading(): Locator {
        return this.page.getByRole('heading', { name: 'Welcome' });
    }

    // ✅ Navigation
    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.waitForNetworkIdle();
    }

    // ✅ Action methods (async, return next page if navigation occurs)
    async submitAndNavigate(): Promise<NextPage> {
        await this.clickButton(this.getSubmitButton(), { buttonName: 'Submit' });
        await expect(this.page).toHaveURL(/\/next/);
        return new NextPage(this.page);
    }

    async clickSubmit(): Promise<void> {
        await this.clickButton(this.getSubmitButton(), { buttonName: 'Submit' });
    }

    // ✅ Verification methods - encapsulate all assertions
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getHeading()).toBeVisible();
    }

    async verifySubmitButtonEnabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    async verifySubmitButtonDisabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeDisabled();
    }

    async verifySubmitButtonText(expectedText: string): Promise<void> {
        await expect(this.getSubmitButton()).toHaveText(expectedText);
    }
}
```

**Exception:** In rare cases where a single locator is used in multiple different assertions
within the SAME test, you may create a `private` helper that returns the locator. Never `public`.

### Selector Priority

**Default selector strategy (MANDATORY):** do what the user does — locate a container by **heading/landmark** (region/dialog/nav/section), then locate the unique element *within that container*.

If you don’t follow this (e.g. page-level `getByRole(...)`, `getByText(...)`, `.first()/.nth()`, generic `dialog/listbox/menu/alert`), add a short comment justifying the exception (what makes it unique/stable, or why you’re deliberately asserting styling/structure).

1. **ARIA roles/labels** - `getByRole('button', { name: 'Submit' })`
2. **Visible text** - `getByRole('heading', { name: 'Settings' })`
3. **Form labels** - `getByLabel('Email address')`
4. **Placeholders** - `getByPlaceholder('Enter amount')`
5. **Test IDs (last resort)** - `getByTestId('user-menu')` - only when semantic options don't exist

**When `data-testid` is appropriate:**
- Container elements without visible text (wrappers, grids)
- List items needing unique identification
- Dynamic IDs in loops
- Structural elements without semantic meaning

**When `data-testid` is NOT needed:**
- Elements with visible text (buttons, links, headings)
- Elements with ARIA roles (`role="alert"`, `role="menu"`, etc.)
- Form inputs with labels or placeholders

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

### i18n Resilience (MANDATORY)

**Import translation files instead of hardcoding text in selectors:**

```typescript
// ❌ PROHIBITED - hardcoded strings break when translations change
export class CreateGroupModalPage extends BasePage {
    async isOpen(): Promise<boolean> {
        return await this.page.getByRole('heading', { name: 'Create Group' }).isVisible();
    }
}

// ✅ REQUIRED - use translation imports
import { translationEn } from '../translations/translation-en';

export class CreateGroupModalPage extends BasePage {
    readonly modalTitle = translationEn.createGroupModal.title;

    async isOpen(): Promise<boolean> {
        return await this.page.getByRole('heading', { name: this.modalTitle }).isVisible();
    }
}
```

**Why this is mandatory:**
- Hardcoded strings silently break when translations are updated
- Tests become false negatives (fail for wrong reason) or false positives (pass when they shouldn't)
- Maintaining duplicate strings is error-prone and creates drift

**Benefits:**
- Single source of truth for all user-facing text
- Tests automatically adapt when translations change
- Multi-language testing becomes trivial
- No maintenance burden for text changes

### Prohibited Practices

**Absolutely forbidden:**
- ❌ `page.waitForTimeout()` - use condition-based waiting
- ❌ `page.setContent()` - always navigate to real pages
- ❌ Raw selectors in tests - use Page Objects
- ❌ **Public locator getters in Page Objects** - use protected/private + verification methods
- ❌ **Hardcoded strings in selectors** - import from translation files
- ❌ Conditional logic in tests (`if/else`, `try/catch` for control flow)
- ❌ Skipped tests (`test.skip()`)
- ❌ Console errors (except tests specifically asserting them)
- ❌ `page.reload()` for state sync - rely on real-time updates
- ❌ Parallel multi-user actions - serialize operations

**Reports:**
- HTML reports: `e2e-tests/playwright-output/<type>/report/`
- Console logs, screenshots, traces all captured

### Debugging

1. **Check `playwright-output/` first** - traces, console logs, screenshots
2. **Use `RUNS=N ./run-test.sh …`** - reproduce flaky failures
3. **Read error messages** - proxy provides detailed context
4. **Never serve HTML report** - use `PLAYWRIGHT_HTML_OPEN=never` (the _run_ scripts already do this)

## Guidelines Summary

**DO:**
- Use builders for all test data
- Poll for conditions, never sleep, never assume instance state
- Use fixtures for auth and page objects
- Verify state before/after every action
- Write deterministic tests (single path, no "ifs" or "ors")
- Fail fast with clear error messages
- Use semantic selectors
- **Make Page Object locator methods protected/private**
- **Use verification methods (verify*) instead of exposing locators**
- **Import translation files for selector text** (e.g., `translationEn.button.submit`)

**DON'T:**
- Create test data manually
- Use `waitForTimeout()` or `sleep()`
- Use raw selectors in tests
- **Expose public locator getters in Page Objects**
- **Hardcode user-facing strings in selectors** (e.g., `{ name: 'Submit' }`)
- Write conditional test logic
- Skip or comment out tests
- Test non-existent features
- Ignore console errors
- Use `page.setContent()`
- Reload page for state sync
