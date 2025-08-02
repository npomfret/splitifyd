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
