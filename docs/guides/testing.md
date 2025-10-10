## Testing

We have just 2 types of test:

- unit tests - these do not need the emulator to be running
- integration tests - these DO need the emulator to be running

## Tech choices

We use Vitest as a test runner and Playwright for in-browser testing.

## Example run commands

Each build file _should_ follow the same patther with its run targets.

```
npm run test:unit
npm run test:integration # runs only the integration tests (the emulator is not needed)
npm run test # runs all tests (the emulator is not needed)
```

To run just one test:

```shell
npx vitest run src/<...path...>.test.ts --reporter=verbose --reporter=json --outputFile=test-report.json
```

## Guidelines for Writing Tests

- **NEVER** use random sleeps (`await new Promise((resolve) => setTimeout(resolve, 5000))`) - always wait for a state change using notifications or polling (look for exising patterns)
- When running tests, wait for them to finish, and report which have failed.
- Skipped tests are not permitted.
- Test complexity must be lower than the code they exercise
- Focus on behaviour, not implementation details
- Avoid complex mocking setups; prefer builder patterns (see below) or in-browser testing
- Remove pointless, outdated, redundant, duplicated, outdated, pedantic or low‑benefit tests
- Never test features that don’t exist (yet)
- Ignore theoretical edge cases that won’t occur (**don't be pedantic**)
- Avoid high maintenance tests with low benefit
- Factor out complex setup in order to make tests easy to read
- Fail fast!!: Test state regularly and early; fail quickly with great error messages
- Use specific matchers: Test for the exact condition you need, not just "something changed"
- Set reasonable timeouts: Start with 1 second, then noadjust based on actual operation timing
- Provide descriptive error messages: Include context about what condition was expected

## Builders ✅

**MANDATORY**: All test data creation MUST use the builder pattern. Manual object creation is prohibited.

Mocks are useful, but the builder pattern is simple and very powerful. It can be used to reduce the lines of coded needed in test setup **and** helps to focus the test on what's important.

### ❌ Avoid Manual Object Creation

```typescript
const foo = {
    name: "bob",
    age: 66,
    location: "the moon",// only this one is imporant
    occupation: "stunt guy"
}

const res = app.doSomething(foo);

assert(res)...
```

### ✅ Use Builder Pattern (Required)

```typescript
const foo = new FooBuilder()
    .withLocation("the moon")
    .build();

const res = app.doSomething(foo);

assert(res)...
```

### Available Builders

The project provides builders for all common test data types:

**Request Builders:**

- `CreateExpenseRequestBuilder` - For expense creation requests
- `CreateGroupRequestBuilder` - For group creation requests
- `CreateSettlementRequestBuilder` - For settlement creation requests
- `CommentRequestBuilder` - For comment requests
- `UserRegistrationBuilder` - For user registration data
- `RegisterRequestBuilder` - For registration requests

**Document Builders:**

- `FirestoreGroupBuilder` - For Firestore group documents
- `FirestoreExpenseBuilder` - For Firestore expense documents
- `GroupMemberDocumentBuilder` - For group membership documents

**Update Builders:**

- `GroupUpdateBuilder` - For group update operations
- `UserUpdateBuilder` - For user profile updates
- `PasswordChangeBuilder` - For password change operations

**Test Support Builders:**

- `ExpenseSplitBuilder` - For expense split data
- `SplitAssertionBuilder` - For test assertions on splits
- `ChangeMetadataBuilder` - For change tracking metadata
- `ThemeBuilder` - For user theme objects

### Builder Usage Principles

1. **Focused Testing**: Only specify properties relevant to your test scenario
2. **Default Sufficiency**: Let builders provide sensible defaults for irrelevant properties
3. **Readability**: Tests should focus on business logic, not object construction
4. **Maintainability**: Changes to data structures only require builder updates

### Example: Focused Testing with Builders

```typescript
// Testing expense validation - only specify what matters
const invalidExpense = new CreateExpenseRequestBuilder()
    .withAmount(0) // Invalid amount - this is what we're testing
    .build();

expect(() => validateCreateExpense(invalidExpense)).toThrow('Amount must be positive');
```

### Builder Pattern Compliance

As of September 2025, the project maintains **100% builder pattern compliance** across all test files:

- 257+ test instances migrated across 17 test files
- Zero manual object creation remaining in core tests
- All new tests must follow this pattern

## Testing Asynchronous Operations with Polling

For testing asynchronous operations where the timing is unpredictable (background jobs, database triggers, eventual consistency, etc.), use a polling pattern rather than fixed delays.

### The Pattern

The polling pattern repeatedly calls a data source until a matcher function returns true, or until a timeout is reached:

```typescript
// Generic polling method
async function pollUntil<T>(
    fetcher: () => Promise<T>, // Function that retrieves data
    matcher: (value: T) => boolean, // Function that tests the condition
    options: {
        timeout?: number; // Total timeout in ms (default: 10000)
        interval?: number; // Polling interval in ms (default: 500)
        errorMsg?: string; // Custom error message
    } = {},
): Promise<T> {
    const { timeout = 10000, interval = 500, errorMsg = 'Condition not met' } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await fetcher();
            if (await matcher(result)) {
                return result;
            }
        } catch (error) {
            // Log but continue polling (or fail fast if needed)
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`${errorMsg} after ${timeout}ms`);
}
```

### Usage Example

```typescript
// Wait for async operation to complete
const result = await pollUntil(
    () => api.getResource(id), // How to fetch data
    (data) => data.status === 'completed', // What condition to check
    { timeout: 15000, errorMsg: 'Operation did not complete' },
);

// Test the final state
expect(result.value).toBe(expectedValue);
```

## Firebase Trigger Testing Patterns

When testing Firebase triggers (Firestore document changes, Cloud Functions), avoid flaky timing-based approaches.

### ❌ Avoid These Anti-Patterns

```typescript
// DON'T: Fixed timeouts with listeners
const changePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
        reject(new Error('Timeout after 2 seconds'));
    }, 2000); // Arbitrary fixed timeout

    const listener = db.collection('changes').onSnapshot((snapshot) => {
        // Complex listener logic...
        clearTimeout(timeout);
        resolve(data);
    });
});
```

```typescript
// DON'T: Arbitrary sleep delays
await new Promise((resolve) => setTimeout(resolve, 2000));
const changes = await getChanges(); // Hope trigger fired by now
```

### ✅ Use Condition-Based Polling

```typescript
// DO: Use the pollForChange helper
import { pollForChange } from '../support/changeCollectionHelpers';

const change = await pollForChange(FirestoreCollections.TRANSACTION_CHANGES, (doc) => doc.id === expectedId && doc.type === 'settlement' && doc.users.includes(userId), { timeout: 5000, groupId });
```

### Key Principles

1. **Poll for specific conditions**, not arbitrary time periods
2. **Use existing helpers** like `pollForChange` instead of custom listeners
3. **Check for exact state** you expect (all required fields/values)
4. **Set reasonable timeouts** (5-10 seconds for triggers)
5. **Clean up properly** - remove unused listener variables and callbacks

## In-Browser Testing with Playwright

In-browser tests using Playwright serve two distinct purposes in this project:

1. **Unit tests for the webapp** (`webapp-v2/src/__tests__/unit/playwright/`) - Test individual React/Preact components in isolation within a real browser environment. These are our primary unit tests for UI components.
2. **End-to-end tests** (`e2e-tests/`) - Test complete user workflows across the entire application stack (frontend + backend + database).

### Page Object Model (POM) - Mandatory Pattern

**All browser interactions MUST go through Page Object Models.** Never use raw selectors or Playwright locators directly in test files.

#### ✅ Correct: Use Page Objects

```typescript
// In test file
const loginPage = new LoginPage(page);
await loginPage.navigate();
await loginPage.login(email, password);

const dashboardPage = new DashboardPage(page);
await dashboardPage.waitForDashboard();
const groupDetailPage = await dashboardPage.createGroupAndNavigate('My Group');
```

#### ❌ Prohibited: ANY Direct Selector Usage in Tests

**Tests must do NOTHING with selectors.** This means:
- No `page.getByRole()`, `page.locator()`, `page.getByText()`, etc.
- No visibility checks like `await page.getByText('X').isVisible()`
- No enable/disable checks like `await page.getByRole('button').isDisabled()`
- No direct assertions like `expect(page.getByText('X')).toBeVisible()`

**ALL selector operations, checks, and assertions belong in Page Objects.**

```typescript
// ❌ DON'T: Never use selectors directly in tests
await page.goto('/login');
await page.getByRole('textbox', { name: 'Email' }).fill(email);
await page.getByRole('button', { name: 'Sign in' }).click();

// ❌ DON'T: Not even for simple visibility checks
await expect(page.getByText('Welcome')).toBeVisible();
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
const isVisible = await page.getByTestId('modal').isVisible();

// ❌ DON'T: Not even for reading values
const userName = await page.getByTestId('user-name').textContent();
const count = await page.getByText(/\d+ items/).textContent();
```

#### ✅ Correct: All Checks Through Page Objects

```typescript
// ✅ DO: Page objects handle selectors and provide semantic methods
const loginPage = new LoginPage(page);
await loginPage.navigate();
await loginPage.login(email, password);

// ✅ DO: Page objects provide verification methods
const dashboardPage = new DashboardPage(page);
await dashboardPage.verifyWelcomeMessageVisible();
await dashboardPage.verifySubmitButtonEnabled();

// ✅ DO: Page objects provide value extraction methods
const userName = await dashboardPage.getUserName();
const itemCount = await dashboardPage.getItemCount();

// ✅ DO: Even simple checks go through page objects
await expect(dashboardPage.getWelcomeMessage()).toBeVisible();
await expect(dashboardPage.getSubmitButton()).toBeEnabled();
```

**In Page Object:**
```typescript
export class DashboardPage extends BasePage {
    // Locator getters (private selectors)
    getWelcomeMessage(): Locator {
        return this.page.getByText('Welcome');
    }

    getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    // High-level verification methods (preferred)
    async verifyWelcomeMessageVisible(): Promise<void> {
        await expect(this.getWelcomeMessage()).toBeVisible();
    }

    async verifySubmitButtonEnabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    // Value extraction methods
    async getUserName(): Promise<string> {
        const element = this.page.getByTestId('user-name');
        const text = await element.textContent();
        if (!text) throw new Error('User name not found');
        return text.trim();
    }
}
```

### Page Objects Are Not Just for Pages

Create Page Object Models for **all UI components** that have user interactions:

- **Pages**: `LoginPage`, `DashboardPage`, `GroupDetailPage`
- **Modals/Dialogs**: `CreateGroupModalPage`, `ConfirmationDialogPage`, `ShareModalPage`
- **Complex Components**: `ExpenseFormPage`, `SettlementFormPage`
- **Shared Components**: `HeaderPage` (navigation, user menu)

### Semantic Selectors - Find What Users See

**Prefer selectors based on what users can see and interact with**, not implementation details.

#### Priority Order for Selectors

1. **ARIA roles and labels** - `getByRole('button', { name: 'Submit' })`
2. **Visible text/headings** - `getByRole('heading', { name: 'Group Settings' })`
3. **Form labels** - `getByLabel('Email address')`
4. **Placeholder text** - `getByPlaceholder('Enter amount')`
5. **Test IDs (last resort)** - `getByTestId('user-menu-button')` - only when semantic options don't exist

#### ❌ Avoid These Selectors

```typescript
// DON'T: CSS classes (brittle, implementation detail)
page.locator('.text-sm.font-medium.text-gray-700');

// DON'T: Complex CSS selectors
page.locator('div > ul > li:nth-child(2) > button');

// DON'T: XPath expressions
page.locator('//div[@class="container"]//button');
```

#### ✅ Use Semantic Selectors

```typescript
// DO: Find by what users see
getGroupNameHeading(): Locator {
    return this.page.getByRole('heading', { level: 2 });
}

getSubmitButton(): Locator {
    return this.page.getByRole('button', { name: 'Create Group' });
}

getEmailInput(): Locator {
    return this.page.getByLabel('Email address');
}
```

### Modifying Components for Better Testing

**It's encouraged to modify TSX components** to add semantic attributes when natural semantic selectors don't exist.

#### Example: Adding Data Attributes for Testing

```typescript
// Before: No way to select user display name
<p className='text-sm font-medium text-gray-700'>{userName}</p>

// After: Added semantic test attribute
<p className='text-sm font-medium text-gray-700' data-testid='user-menu-display-name'>
    {userName}
</p>
```

**Guidelines for modifying components:**

- Add ARIA attributes first (`role`, `aria-label`, `aria-describedby`)
- Use `data-testid` when ARIA isn't appropriate
- Prefer finding containers by headings: `getByRole('heading', { name: 'Settings' })`
- Never add test-only elements that users don't see

### Fluent Methods - Action Chaining

Page objects should provide fluent methods that perform actions and return the resulting page object. This creates readable, chainable test code.

#### ✅ Correct: Fluent Methods with Single Path

```typescript
// In LoginPage
async login(email: string, password: string): Promise<DashboardPage> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
    await expect(this.page).toHaveURL(/\/dashboard/);
    return new DashboardPage(this.page);
}

// In DashboardPage
async createGroupAndNavigate(name: string): Promise<GroupDetailPage> {
    const modal = await this.openCreateGroupModal();
    await modal.fillName(name);
    await modal.submit();
    await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    return new GroupDetailPage(this.page);
}

// In test - fluent chaining
const dashboardPage = await loginPage.login(email, password);
const groupPage = await dashboardPage.createGroupAndNavigate('My Group');
await groupPage.verifyGroupName('My Group');
```

#### ❌ Prohibited: Conditional Logic in Fluent Methods

```typescript
// DON'T: Methods that could return different page objects based on conditions
async submitForm(): Promise<DashboardPage | ErrorPage> {
    await this.clickSubmit();

    if (await this.page.getByText('Error').isVisible()) {
        return new ErrorPage(this.page);  // ❌ Ambiguous - test doesn't know what to expect
    }
    return new DashboardPage(this.page);
}
```

**Why this is wrong:** Tests should have deterministic paths. The test should explicitly handle different scenarios with separate methods.

#### ✅ Correct: Explicit Methods for Different Scenarios

```typescript
// DO: Separate methods for different expected outcomes
async submitAndExpectSuccess(): Promise<DashboardPage> {
    await this.clickSubmit();
    await expect(this.page).toHaveURL(/\/dashboard/);
    return new DashboardPage(this.page);
}

async submitAndExpectError(): Promise<void> {
    await this.clickSubmit();
    await expect(this.getErrorMessage()).toBeVisible();
    // Stay on current page, verify error state
}

// In test - explicit intent
if (testingValidInput) {
    const dashboard = await loginPage.submitAndExpectSuccess();
} else {
    await loginPage.submitAndExpectError();
    await expect(loginPage.getErrorMessage()).toContainText('Invalid credentials');
}
```

### Never Use waitForTimeout

**Absolutely prohibited:** `page.waitForTimeout()`, `setTimeout()`, `sleep()` and similar arbitrary delays.

#### ❌ Prohibited Patterns

```typescript
// DON'T: Arbitrary waits
await page.waitForTimeout(2000);  // ❌ Flaky, slow, unreliable

// DON'T: Manual sleep
await new Promise(resolve => setTimeout(resolve, 1000));  // ❌ Never
```

#### ✅ Use Condition-Based Waiting

```typescript
// DO: Wait for specific conditions with Playwright's built-in waiting
await expect(this.page.getByText('Loading...')).toBeHidden();
await expect(this.page.getByRole('button', { name: 'Submit' })).toBeEnabled();

// DO: Wait for navigation
await expect(this.page).toHaveURL(/\/dashboard/);

// DO: Use expect().toPass() for polling
await expect(async () => {
    const count = await this.getMemberCount();
    expect(count).toBe(expectedCount);
}).toPass({ timeout: 5000 });
```

### Page Object Structure

A well-structured Page Object follows this template:

```typescript
export class ExamplePage extends BasePage {
    // 1. Navigation
    readonly url = '/example';

    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.waitForPageLoad();
    }

    // 2. Element getters (return Locators, not promises)
    getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    getHeading(): Locator {
        return this.page.getByRole('heading', { level: 1 });
    }

    // 3. Action methods (async, do things)
    async fillForm(data: FormData): Promise<void> {
        await this.fillPreactInput('#name', data.name);
        await this.fillPreactInput('#email', data.email);
    }

    async submitAndExpectSuccess(): Promise<NextPage> {
        await this.clickButton(this.getSubmitButton(), { buttonName: 'Submit' });
        await expect(this.page).toHaveURL(/\/success/);
        return new NextPage(this.page);
    }

    // 4. Verification methods (assertions)
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getHeading()).toBeVisible();
        await expect(this.getSubmitButton()).toBeEnabled();
    }
}
```

### Key Principles Summary

1. **No raw selectors in tests** - Always use Page Object methods
2. **Semantic selectors first** - Use what users see (roles, labels, text)
3. **Modify components when needed** - Add semantic attributes to improve testability
4. **Page Objects for everything** - Pages, modals, dialogs, complex components
5. **Fluent methods return page objects** - Enable readable test chaining
6. **No conditional logic in methods** - Each method has one deterministic outcome
7. **Never waitForTimeout** - Always wait for specific conditions
8. **Fail fast with context** - Provide clear error messages when assertions fail
