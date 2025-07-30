# Webapp v2 Authenticated User Tests Implementation Plan

## Problem Statement

The current test suite has **71 tests** running against the Firebase emulator, but they're missing critical coverage of authenticated user functionality. This is why broken functionality in the app isn't being caught:

- **All current tests only verify UI elements exist** - they don't test actual functionality
- **No tests for authenticated user flows** - login forms are tested, but not what happens after login
- **Zero coverage of core features** - groups, expenses, balances are completely untested
- **Form tests are shallow** - they check if buttons are disabled, not if forms actually work

## Current Test Coverage Analysis

### What We Have ✅
- Static page tests (home, pricing, terms, etc.)
- Login/Register form visibility tests
- Basic navigation tests
- Console error monitoring
- Accessibility checks

### What We're Missing ❌
- **Post-login functionality** - Dashboard, groups, expenses
- **CRUD operations** - Creating, reading, updating, deleting groups/expenses
- **User interactions** - Form submissions, modal dialogs, data updates
- **API integration** - How UI interacts with backend
- **Error handling** - Network failures, validation errors, edge cases
- **Business logic** - Balance calculations, expense splitting, settlements

## Implementation Plan

**Note**: Based on analysis, the v2 app HAS dashboard, groups, and expense functionality implemented. We need to test it!

### Phase 1: Authentication Setup (Commit 1-2)

#### Commit 1: Create auth test utilities
**Goal**: Set up reusable authentication helpers for tests

```typescript
// webapp-v2/e2e/helpers/auth-utils.ts
export async function loginTestUser(page: Page, credentials?: TestCredentials) {
  // Navigate to login
  // Fill credentials
  // Submit form
  // Wait for dashboard
  // Return user context
}

export async function createAndLoginTestUser(page: Page) {
  // Generate unique user
  // Register via API or UI
  // Login
  // Return user context
}

export async function ensureLoggedOut(page: Page) {
  // Check if logged in
  // Sign out if needed
}
```

#### Commit 2: Update test fixtures with auth support
**Goal**: Extend Playwright fixtures to handle authentication

```typescript
// webapp-v2/e2e/fixtures/authenticated-test.ts
export const authenticatedTest = test.extend({
  authenticatedPage: async ({ page }, use) => {
    const user = await createAndLoginTestUser(page);
    await use({ page, user });
    await ensureLoggedOut(page);
  }
});
```

### Phase 2: Dashboard Tests (Commit 3-5)

#### Commit 3: Basic dashboard tests
**Goal**: Test dashboard loads and displays user data correctly

```typescript
// webapp-v2/e2e/dashboard.e2e.test.ts
test.describe('Dashboard E2E', () => {
  test('should display user info after login', async ({ page }) => {
    await loginTestUser(page);
    
    // Verify dashboard loaded
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Check user name displayed
    await expect(page.getByText('Test User')).toBeVisible();
    
    // Check welcome message
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });

  test('should display user groups', async ({ page }) => {
    // Login user with existing groups
    // Verify groups are listed
    // Check group details (members, expenses, balance)
  });

  test('should handle empty state', async ({ page }) => {
    // Login new user with no groups
    // Verify empty state message
    // Check Create Group button is prominent
  });
});
```

#### Commit 4: Create group modal tests
**Goal**: Test group creation flow

```typescript
test('should open create group modal', async ({ page }) => {
  await loginTestUser(page);
  
  // Click Create Group button
  await page.getByRole('button', { name: 'Create Group' }).click();
  
  // Verify modal opened
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Create New Group')).toBeVisible();
  
  // Check form fields
  await expect(page.getByLabel('Group Name')).toBeVisible();
  await expect(page.getByLabel('Description')).toBeVisible();
});

test('should create a new group', async ({ page }) => {
  await loginTestUser(page);
  
  // Open modal
  await page.getByRole('button', { name: 'Create Group' }).click();
  
  // Fill form
  await page.getByLabel('Group Name').fill('Test Group');
  await page.getByLabel('Description').fill('Test Description');
  
  // Submit
  await page.getByRole('button', { name: 'Create Group' }).last().click();
  
  // Verify group appears in list
  await expect(page.getByText('Test Group')).toBeVisible();
  
  // Verify we're on group page
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
});
```

#### Commit 5: Dashboard navigation tests
**Goal**: Test navigation from dashboard to other areas

```typescript
test('should navigate to group details', async ({ page }) => {
  // Setup user with groups
  // Click on group
  // Verify navigation to group page
});

test('should sign out successfully', async ({ page }) => {
  // Login
  // Click sign out
  // Verify redirect to home/login
});
```

### Phase 3: Group Management Tests (Commit 6-9)

#### Commit 6: Group detail page tests
**Goal**: Test group page displays correctly

```typescript
// webapp-v2/e2e/group-details.e2e.test.ts
test.describe('Group Details E2E', () => {
  test('should display group information', async ({ page }) => {
    // Create group with test data
    // Navigate to group
    // Verify group name, members, balance
  });

  test('should display expense list', async ({ page }) => {
    // Create group with expenses
    // Verify expenses shown
    // Check expense details
  });
});
```

#### Commit 7: Add expense tests
**Goal**: Test expense creation flow

```typescript
test('should add new expense', async ({ page }) => {
  // Navigate to group
  // Click Add Expense
  // Fill form (amount, description, payer, split)
  // Submit
  // Verify expense appears in list
  // Verify balances updated
});

test('should handle expense validation', async ({ page }) => {
  // Try to submit invalid expense
  // Verify validation messages
  // Fix errors and resubmit
});
```

#### Commit 8: Member management tests
**Goal**: Test adding/removing group members

```typescript
test('should add member to group', async ({ page }) => {
  // Open member management
  // Add new member
  // Verify member appears
  // Verify can select in expense splits
});

test('should remove member from group', async ({ page }) => {
  // Verify can't remove member with balance
  // Settle balances
  // Remove member
  // Verify member gone
});
```

#### Commit 9: Balance and settlement tests
**Goal**: Test balance calculations and settlements

```typescript
test('should calculate balances correctly', async ({ page }) => {
  // Add multiple expenses
  // Verify balance calculations
  // Check who owes whom
});

test('should record settlement', async ({ page }) => {
  // Create expenses
  // Record settlement payment
  // Verify balances updated
  // Check settlement in history
});
```

### Phase 4: Error Handling Tests (Commit 10-12)

#### Commit 10: Network error tests
**Goal**: Test UI handles network failures gracefully

```typescript
// webapp-v2/e2e/error-handling.e2e.test.ts
test('should handle network errors gracefully', async ({ page, context }) => {
  await loginTestUser(page);
  
  // Intercept API calls to simulate failure
  await context.route('**/api/groups', route => route.abort());
  
  // Try to create group
  await page.getByRole('button', { name: 'Create Group' }).click();
  // ... fill form and submit
  
  // Verify error message shown
  await expect(page.getByText(/network error|try again/i)).toBeVisible();
  
  // Verify UI still responsive
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});
```

#### Commit 11: Validation error tests
**Goal**: Test form validation and error display

```typescript
test('should display validation errors', async ({ page }) => {
  // Submit invalid data
  // Verify field-level errors
  // Verify form can be corrected and resubmitted
});
```

#### Commit 12: Permission error tests
**Goal**: Test unauthorized access handling

```typescript
test('should handle unauthorized access', async ({ page }) => {
  // Try to access group user doesn't belong to
  // Verify error message
  // Verify redirect to dashboard
});
```

### Phase 5: End-to-End User Journey Tests (Commit 13-15)

#### Commit 13: Complete expense flow test
**Goal**: Test full user journey from login to settlement

```typescript
// webapp-v2/e2e/user-journeys.e2e.test.ts
test('complete expense splitting journey', async ({ page }) => {
  // Register new user
  // Create group
  // Add members
  // Add multiple expenses
  // View balances
  // Record settlement
  // Verify settled state
});
```

#### Commit 14: Multi-user interaction test
**Goal**: Test multiple users interacting with same group

```typescript
test('multi-user group interaction', async ({ browser }) => {
  // Create two browser contexts (two users)
  // User 1 creates group and adds User 2
  // User 2 views group and adds expense
  // User 1 sees updated expense
  // Verify both see same balances
});
```

#### Commit 15: Data persistence test
**Goal**: Verify data persists across sessions

```typescript
test('data persists across sessions', async ({ page, context }) => {
  // Create group and expenses
  // Clear cookies/storage
  // Login again
  // Verify all data still present
});
```

### Phase 6: Integration with Existing Tests (Commit 16)

#### Commit 16: Update existing auth tests to actually login
**Goal**: Enhance existing auth-flow.e2e.test.ts to test real login

```typescript
test('should login with valid credentials', async ({ page }) => {
  // Register a test user
  // Navigate to login
  // Fill credentials
  // Submit form
  // Verify redirect to dashboard
  // Verify user info displayed
});
```

## Technical Approach

### Authentication Strategy
1. **Use Real Firebase Auth**: Tests will use actual Firebase Auth, not mocks
2. **ApiDriver for Setup Only**: Use ApiDriver to create test users/data when needed, but test through browser UI
3. **Browser-First Testing**: All interactions should happen through the browser, not API calls
4. **Test User Pool**: Create pool of test users to avoid conflicts
5. **Cleanup**: Delete test data after each test run
6. **Parallel Testing**: Ensure tests can run in parallel without conflicts

### Key Directives
- **No Mocks**: Use real Firebase emulator and real authentication
- **Test Via Browser**: Primary testing happens through UI interactions, not API calls
- **ApiDriver for Setup**: Only use ApiDriver to create necessary test data (users, groups) before UI testing
- **Real User Flows**: Test as a real user would interact with the app

### Test Data Management
```typescript
// webapp-v2/e2e/helpers/test-data.ts
export class TestDataManager {
  private testUsers: Map<string, TestUser> = new Map();
  private testGroups: Map<string, TestGroup> = new Map();
  
  async createTestUser(): Promise<TestUser> {
    // Create unique user via Firebase Auth
    // Track for cleanup
  }
  
  async createTestGroup(userId: string): Promise<TestGroup> {
    // Create group via API
    // Track for cleanup
  }
  
  async cleanup() {
    // Delete all test data
  }
}
```

### Page Object Pattern
```typescript
// webapp-v2/e2e/pages/dashboard.page.ts
export class DashboardPage {
  constructor(private page: Page) {}
  
  async navigateToGroup(groupName: string) {
    await this.page.getByText(groupName).click();
  }
  
  async openCreateGroupModal() {
    await this.page.getByRole('button', { name: 'Create Group' }).click();
  }
  
  async getGroupCards() {
    return this.page.locator('[data-testid="group-card"]').all();
  }
}
```

## Success Criteria

### Coverage Metrics
- [ ] 100% of authenticated pages have at least one test
- [ ] All CRUD operations tested (Create, Read, Update, Delete)
- [ ] All form submissions tested with valid and invalid data
- [ ] All error states tested (network, validation, permissions)

### Quality Metrics
- [ ] Tests catch regressions within 24 hours of introduction
- [ ] Tests run in under 5 minutes
- [ ] Zero flaky tests (all tests pass consistently)
- [ ] Tests are readable and maintainable

### Specific Functionality Coverage
- [ ] User registration and login
- [ ] Dashboard display and navigation
- [ ] Group creation and management
- [ ] Expense creation with all split types
- [ ] Balance calculation verification
- [ ] Settlement recording
- [ ] Member management
- [ ] Error handling for all failure modes

## Implementation Approach

### Small, Focused Commits
Each commit should be independently testable and add value:

1. **Auth helpers first** - Create reusable authentication utilities
2. **One feature at a time** - Dashboard, then groups, then expenses
3. **Happy path before edge cases** - Get basic flows working first
4. **Incremental coverage** - Each commit adds new test coverage

### Test Only What Exists
- Dashboard with groups list ✅
- Create group modal ✅
- Group detail page ✅
- Add expense page ✅
- Join group page ✅

### Skip What Doesn't Exist Yet
- Complex permission tests (if permissions aren't implemented)
- Advanced features not in UI
- Theoretical edge cases

## Notes

1. **Start Simple**: Begin with happy path tests, then add edge cases
2. **Use Real Data**: Avoid hardcoded test data where possible
3. **Test User Perspective**: Write tests from user's point of view, not implementation
4. **Fail Fast**: Tests should fail quickly and clearly when functionality breaks
5. **Maintainability**: Use page objects and helpers to keep tests DRY

This comprehensive test suite will ensure that broken functionality is caught immediately, preventing the issues currently affecting the production app.