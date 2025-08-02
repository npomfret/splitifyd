# E2E Test Gap Analysis Report

**Date:** 2025-08-02

## 1. Executive Summary

This report details the findings of a comprehensive analysis of the end-to-end (E2E) test suite against the documented features of the Splitifyd web application. The goal is to identify gaps in test coverage, areas of over-testing, and opportunities for test redesign to improve efficiency and effectiveness.

The analysis reveals that the existing E2E tests provide a solid foundation, covering critical paths like user authentication, group creation, and basic expense adding. However, as the application has grown, several key areas remain untested, and some tests have become redundant or could be consolidated.

**Key Findings:**
- **Good Coverage:** Core features like authentication, group creation, and the "add expense" form are well-tested.
- **Major Gaps:** Significant gaps exist in testing for multi-currency support, advanced splitting options, and user profile settings.
- **Redundancy:** There is some overlap in tests for form validation and basic navigation, which could be streamlined.
- **Opportunity:** The `manual-complex-scenario.e2e.test.ts` and `complex-unsettled-group.e2e.test.ts` tests are valuable but could be redesigned for better automation and clearer assertions.

## 2. Untested Features (Gaps)

The following features have been identified as having little to no E2E test coverage. These represent the most significant risks and should be prioritized for new test development.

| Feature | Priority | Recommended Test Scenarios |
|---|---|---|
| **Multi-currency Support** | **High** | - Create a group with a non-default currency. <br>- Add expenses in multiple currencies within the same group. <br>- Verify that balances are calculated and displayed correctly per currency. <br>- Test the "simplify debts" feature with multi-currency balances. |
| **Advanced Splitting Options** | **High** | - Create an expense and split it by unequal shares. <br>- Test item-based splitting from a receipt. <br>- Verify tax and tip calculations are applied correctly. <br>- Set up and verify a recurring expense. |
| **User Profile & Settings** | **Medium** | - Update user display name and profile photo. <br>- Change default currency and notification settings. <br>- Test theme selection (light/dark mode). |
| **Settlement & Payment Recording** | **Medium** | - Record a cash payment between users. <br>- Mark a debt as fully settled. <br>- Verify that settlement history is accurately recorded. |
| **Expense List View** | **Medium** | - Navigate to the all-expenses view. <br>- Filter expenses by date range, participants, and group. <br>- Test sorting functionality (by date, amount, etc.). |
| **Export & Reports** | **Low** | - Generate and export a CSV of transactions. <br>- Create and view a PDF summary report. |
| **Friends & Contacts Management** | **Low** | - Add a friend by email. <br>- View and search the contact list. <br>- Remove a friend from the contact list. |

## 3. Over-tested Features & Redundancies

Some features are tested in multiple test files, leading to redundancy. While some overlap is acceptable (e.g., creating a group as a prerequisite), we can consolidate some assertions to make the test suite more efficient.

| Area of Redundancy | Files | Recommendation |
|---|---|---|
| **Basic Form Validation** | `auth-flow.e2e.test.ts`, `form-validation.e2e.test.ts`, `add-expense.e2e.test.ts` | Consolidate detailed form validation tests into `form-validation.e2e.test.ts`. Other tests should assume basic validation works and focus on the success path. For example, `add-expense.e2e.test.ts` should focus on the successful creation of an expense, not on testing every validation rule of the form. |
| **Navigation** | `homepage.e2e.test.ts`, `static-pages.e2e.test.ts`, `navigation.e2e.test.ts` | Merge `static-pages.e2e.test.ts` and `navigation.e2e.test.ts` into a single, more comprehensive navigation test file. The homepage test should focus on the elements of the homepage itself, not on navigating away from it. |
| **Group Creation** | `dashboard.e2e.test.ts`, `add-expense.e2e.test.ts`, `group-details.e2e.test.ts`, etc. | Group creation is a necessary setup step for many tests. However, we should create a helper function or a fixture to handle group creation, rather than repeating the UI steps in every test file. This will make the tests faster and less brittle. |

## 4. Opportunities for Test Redesign

Certain tests, while valuable, could be improved to provide more reliable and meaningful results.

| Test File | Area for Improvement | Recommendation |
|---|---|---|
| `manual-complex-scenario.e2e.test.ts` | **Automation & Assertions** | This test performs many actions but has very few assertions. It should be broken down into smaller, more focused tests with clear `expect` statements. For example, create separate tests for multi-user expense submission, balance verification, and member invitation. |
| `complex-unsettled-group.e2e.test.ts` | **Clarity & Focus** | Similar to the manual scenario, this test is long and complex. It should be refactored to test a specific complex scenario, such as a multi-user group with a mix of expenses and settlements, and then assert the final balance state is correct. |
| `*-placeholder.e2e.test.ts` | **Implementation** | Several tests are placeholders that pass whether the feature is implemented or not. These should be updated with concrete assertions to verify the functionality they are intended to test. |

## 5. Recommendations & Action Plan

1.  **Prioritize Gap Coverage:** Begin by writing E2E tests for the "High" priority untested features, starting with **Multi-currency Support**.
2.  **Consolidate Redundant Tests:** Refactor the navigation and form validation tests as recommended above to reduce redundancy.
3.  **Create Helper Functions:** Develop a helper function or fixture for common setup tasks like user login and group creation to streamline tests.
4.  **Redesign Complex Scenarios:** Break down the `manual-complex-scenario` and `complex-unsettled-group` tests into smaller, more focused, and fully automated tests.
5.  **Remove Placeholders:** Update placeholder tests with concrete assertions.

By addressing these gaps and opportunities, we can build a more robust, efficient, and reliable E2E test suite that provides greater confidence in the quality of the Splitifyd application.

## Implementation Plan

### Phase 1: Create Test Infrastructure (Foundation)

#### 1.1 Create Common Test Helpers
**File:** `e2e-tests/helpers/test-helpers.ts`
**Purpose:** Reduce redundancy by creating reusable helper functions
**Functions to implement:**
- `createTestGroup(page, groupName, description?)` - Creates a group and returns group ID
- `addTestExpense(page, groupId, amount, description, options?)` - Adds expense via UI
- `getGroupBalances(page, groupId)` - Retrieves current balance state
- `inviteUserToGroup(page, groupId, email)` - Invites user (when implemented)
- `waitForBalanceUpdate(page)` - Waits for balance recalculation

**Commit:** "test: add common helper functions for e2e tests"

#### 1.2 Create Test Data Builders
**File:** `e2e-tests/helpers/test-data-builders.ts`
**Purpose:** Generate consistent test data following the builder pattern
**Builders to implement:**
- `GroupBuilder` - For creating test groups with various configurations
- `ExpenseBuilder` - For creating expenses with different split types
- `UserBuilder` - For creating test users with different roles

**Commit:** "test: add test data builders for e2e tests"

### Phase 2: High Priority Feature Tests

#### 2.1 Multi-Currency Support Tests
**Note:** Since currency support is not implemented in the app, these tests will:
- Document the expected behavior
- Verify current behavior (no currency field)
- Be marked as pending/skipped until feature is implemented

**File:** `e2e-tests/tests/multi-currency.e2e.test.ts`
**Test scenarios:**
1. ❌ Create group with non-default currency (EUR, GBP, JPY)
2. ❌ Add expenses in different currencies within same group
3. ❌ Verify balance calculations show per-currency totals
4. ❌ Test currency conversion in settlement suggestions
5. ✅ Verify current behavior (no currency options available)

**Commit:** "test: add multi-currency e2e tests (pending feature implementation)"

#### 2.2 Advanced Splitting Options Tests
**File:** `e2e-tests/tests/advanced-splitting.e2e.test.ts`
**Test scenarios:**
1. ✅ Create expense with equal split (already works)
2. ✅ Create expense with exact amounts split
3. ✅ Create expense with percentage split
4. ❌ Create expense with unequal shares (custom ratios)
5. ❌ Test item-based splitting from receipt
6. ❌ Test tax and tip calculations
7. ❌ Create and verify recurring expense

**Commit:** "test: add advanced splitting options e2e tests"

#### 2.3 Settlement & Payment Recording Tests
**File:** `e2e-tests/tests/settlement-recording.e2e.test.ts`
**Test scenarios:**
1. Record cash payment between two users
2. Record partial payment
3. Mark debt as fully settled
4. Verify settlement appears in transaction history
5. Test settlement with multiple currencies (when available)
6. Verify balance updates after settlement

**Commit:** "test: add settlement recording e2e tests"

### Phase 3: Medium Priority Feature Tests

#### 3.1 User Profile & Settings Tests
**File:** `e2e-tests/tests/user-profile-settings.e2e.test.ts`
**Test scenarios:**
1. ❌ Update display name
2. ❌ Upload and change profile photo
3. ❌ Change default currency preference
4. ❌ Toggle notification settings
5. ❌ Switch between light/dark theme
6. ✅ Verify current profile UI (minimal)

**Commit:** "test: add user profile and settings e2e tests"

#### 3.2 Expense Filtering & Sorting Tests
**File:** `e2e-tests/tests/expense-list-filters.e2e.test.ts`
**Test scenarios:**
1. View all expenses across groups
2. Filter expenses by date range
3. Filter expenses by participant
4. Filter expenses by group
5. Sort by date (newest/oldest)
6. Sort by amount (high/low)
7. Test pagination with many expenses

**Commit:** "test: add expense list filtering e2e tests"

### Phase 4: Test Consolidation

#### 4.1 Consolidate Navigation Tests
**Action:** Merge redundant navigation tests
- Keep `navigation.e2e.test.ts` as the main navigation test
- Move static page checks from `homepage.e2e.test.ts` and `static-pages.e2e.test.ts`
- Remove redundant files after consolidation

**Commit:** "test: consolidate navigation e2e tests"

#### 4.2 Consolidate Form Validation Tests
**Action:** Centralize validation tests
- Keep detailed validation in `form-validation.e2e.test.ts`
- Remove validation checks from `auth-flow.e2e.test.ts` and `add-expense.e2e.test.ts`
- Focus other tests on success paths only

**Commit:** "test: consolidate form validation e2e tests"

#### 4.3 Refactor Complex Scenario Tests
**Files to refactor:**
- `manual-complex-scenario.e2e.test.ts`
- `complex-unsettled-group.e2e.test.ts`

**Action:** Break into smaller, focused tests with clear assertions
- Extract multi-user balance verification test
- Extract group member invitation test
- Extract complex debt settlement test
- Add specific assertions for each step

**Commit:** "test: refactor complex scenario tests into focused tests"

### Phase 5: Low Priority Features (Future)

#### 5.1 Export & Reports Tests
- CSV export functionality
- PDF report generation
- Data accuracy verification

#### 5.2 Friends & Contacts Tests
- Add friend by email
- Search contacts
- Remove friend

### Success Metrics
- Test execution time reduced by 30% through helper functions
- Zero redundant test cases
- All tests have meaningful assertions
- Test failures clearly indicate what feature is broken
- New features can be tested by combining existing helpers

### Implementation Order
1. **Week 1:** Phase 1 (Infrastructure) + Phase 2.2 (Advanced Splitting)
2. **Week 2:** Phase 2.1 (Multi-Currency) + Phase 2.3 (Settlement)
3. **Week 3:** Phase 3 (User Profile + Expense Filters)
4. **Week 4:** Phase 4 (Consolidation & Refactoring)

### Notes
- Tests for unimplemented features will be created but marked as pending
- This provides documentation of expected behavior
- Tests can be enabled as features are implemented
- Focus on testing what EXISTS first, then document what SHOULD exist
