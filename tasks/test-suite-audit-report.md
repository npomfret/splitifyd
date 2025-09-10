# Test Suite Audit Report (September 2025)

## 1. Overview

This document details findings from a comprehensive audit of the project's entire test suite, conducted in September 2025. All 118 test files across the `firebase`, `e2e-tests`, and `webapp-v2` packages were analyzed. The goal is to identify all areas in need of cleanup, including test gaps, duplication, misleading tests, and opportunities to improve test quality and maintainability.

While the suite has many strengths, particularly in its use of Page Objects and Builders, the audit revealed significant opportunities to improve test focus, reduce redundancy, and increase the thoroughness of critical test cases.

---

## 2. Key Findings & Recommendations

### Finding 1: Incomplete UI-Based Store Tests (`webapp-v2`)

The project has made a strategic decision to favor in-browser tests for data stores over mocked unit tests to improve readability and accuracy. While this is a valid approach, the current implementation of these tests in `webapp-v2/src/__tests__/unit/playwright/` is incomplete.

*   **Issue:** The tests (e.g., `auth-store-converted.playwright.test.ts`, `comments-store-converted.playwright.test.ts`) do not contain the necessary UI interactions to actually validate the store logic they are targeting. For example, the test for the comments store simply loads the application but does not navigate to a comments section, create a comment via the UI, or assert that a comment appears.
*   **Impact:** The tests are not fulfilling their intended purpose. They provide a false sense of security by existing, but they do not actually verify the functionality of the data stores from the user's perspective.
*   **Recommendation (Highest Priority):**
    1.  **Enhance the Tests to be UI-Driven:** The Playwright-based store tests must be updated to include the full UI interaction workflow. For example:
        *   To test `authStore.login()`, the test should navigate to the login page, fill in the form, click the submit button, and assert that the UI updates to a logged-in state.
        *   To test `commentsStore.createComment()`, the test must navigate to a group or expense, use the comment input form to submit a comment, and assert that the new comment appears in the comment list.
    2.  **Consolidate with E2E Tests:** Since these enhanced tests will effectively become mini E2E tests, they should be consolidated with the main E2E test suite in the `e2e-tests/` directory to avoid duplication.

### Finding 2: Redundant Integration & E2E Tests

There is significant duplication in tests covering the same "happy path" user journeys, particularly between the backend integration tests and the E2E tests.

*   **Location:** `firebase/functions/src/__tests__/integration/` and `e2e-tests/src/__tests__/integration/normal-flow/`
*   **Issue:** Multiple test suites contain variations of the same workflow: create a group, add a member, create an expense. For example, `firebase/functions/src/__tests__/integration/normal-flow/business-logic/group-lifecycle.test.ts` and `e2e-tests/src/__tests__/integration/normal-flow/add-expense-happy-path.e2e.test.ts` test nearly identical scenarios from different perspectives (API vs. UI).
*   **Impact:** This slows down the entire test suite and increases maintenance overhead.
*   **Recommendation:**
    1.  **Consolidate Redundant Tests:** Merge overlapping tests into single, more comprehensive user journey tests. For example, the E2E suite should have one primary test that covers the entire lifecycle (register, create group, add multi-type expenses, invite user, settle up, logout).
    2.  **Define Clear Test Boundaries:** The `firebase` integration tests should focus on validating API contracts and business logic, while the E2E tests should focus on UI interaction and visual verification.

### Finding 3: Critical Test Gaps

Despite the high volume of tests, there are dangerous gaps in coverage for critical logic.

*   **Gap 1: Debt Simplification Logic**
    *   **Location:** `firebase/functions/src/__tests__/integration/normal-flow/balance-calculation.test.ts`
    *   **Issue:** The main test for balance calculation contains the comment `// Verify individual debts` but has **no assertions** for the `simplifiedDebts` array. This critical piece of the financial logic is not being tested.
    *   **Recommendation:** Immediately add assertions to validate the structure and correctness of the `simplifiedDebts` array.

*   **Gap 2: Comprehensive Group Deletion**
    *   **Issue:** There is no integration test that verifies the hard deletion of a group containing *all* its sub-collections (expenses, settlements, comments, share links). Given that the `deleteGroup` service method is non-transactional, this is a high-risk gap.
    *   **Recommendation:** Create a new integration test that populates a group with every type of related data and then verifies that every single related document is properly deleted.

*   **Gap 3: Expense Split Editing (E2E)**
    *   **Issue:** There is no E2E test for *editing* an expense and changing its split type (e.g., from 'equal' to 'exact').
    *   **Recommendation:** Add a test to `expense-operations.e2e.test.ts` that covers editing an existing expense and modifying its split details.

### Finding 4: Missed Opportunities for Unit Tests

Complex business logic within services is often tested only at the integration level, where faster, more precise unit tests would be more appropriate.

*   **Location:** `firebase/functions/src/__tests__/unit/services/GroupService.test.ts`
*   **Issue:** This file is nearly empty, yet the `GroupService` contains complex, non-database logic for data transformation and aggregation within its `listGroups` method. This logic is only tested via slow, end-to-end API calls.
*   **Recommendation:** Refactor `GroupService` to extract the data transformation logic into pure functions. Add focused unit tests for these functions to `GroupService.test.ts`, using mocked data. This will be faster and provide more precise feedback.

### Finding 5: Inconsistent Test Setup

*   **Issue:** While builders are used well in many places, their application is inconsistent. Some tests, particularly older ones, still rely on large, manually-constructed data objects or verbose `apiDriver` calls.
*   **Location:** `firebase/functions/src/__tests__/integration/edge-cases/permission-edge-cases.test.ts`
*   **Recommendation:** Create a `GroupBuilder` and `SettlementBuilder` in the `@splitifyd/test-support` package. Refactor the remaining tests to use these builders for a cleaner, more declarative, and more maintainable test setup.
