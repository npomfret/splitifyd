# E2E and Unit Test Coverage Analysis and Recommendations

## Overview

This report analyzes the gaps in the current E2E test suite. Based on the principle of using the right tool for the job, it provides recommendations on whether each gap is better addressed by E2E tests, unit/component tests, or a combination of both. The goal is to increase test coverage efficiently, improve reliability, and speed up the feedback loop.

## Analysis and Recommendations

### 1. Copy Expense Feature
- **Current E2E Coverage:** ✅ **COMPLETED - Comprehensive E2E test coverage implemented**.
- **Implementation Status:** **DONE** - Two comprehensive E2E tests added to `expense-and-balance-lifecycle.e2e.test.ts`:
  1. **Basic copy functionality test** - Verifies complete copy workflow with field pre-population, form validation, and balance updates
  2. **Multi-user real-time test** - Tests complex 3-user scenarios with different payers and real-time updates across browsers
- **Features Tested:**
  - ✅ Copy button navigation (`/groups/{id}/add-expense?copy=true&sourceId={id}`)
  - ✅ "Copy Expense" UI header display
  - ✅ All fields pre-filled from source expense (description, amount, currency, category, payer, split participants)
  - ✅ Date automatically set to today (not source expense date)
  - ✅ Form validation works in copy mode
  - ✅ Modified values can be submitted to create new expense
  - ✅ Both original and copied expenses exist independently
  - ✅ Balance calculations update correctly with both expenses
  - ✅ Real-time updates work across multiple users
  - ✅ Complex multi-user scenarios with different payers and currency handling
- **Page Object Updates:** Added `clickCopyExpenseButton()` to `ExpenseDetailPage` and copy validation helpers to `ExpenseFormPage`
- **Recommended Strategy:** **E2E Test** - **COMPLETED**.
- **Justification:** This multi-step user flow involving navigation, URL parameters, and form pre-filling required comprehensive E2E testing, which has now been successfully implemented.

### 2. Expense Form Drafts
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **Unit Test**.
- **Justification:** The core logic for saving and loading drafts resides in `expense-form-store.ts`. This logic's interaction with `sessionStorage` can be tested robustly and quickly in isolation using unit tests by mocking the `sessionStorage` API. An E2E test would be slower and more brittle.

### 3. Expense Form UI Features (Recent Amounts, Category Suggestions)
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **Component Tests**.
- **Justification:** These features involve the `ExpenseBasicFields.tsx` component rendering UI elements based on props. Component tests (using Vitest and React Testing Library) are the most effective way to verify the UI renders correctly for different states (e.g., with suggestions, without suggestions) without the overhead of a full E2E test.

### 4. Group-Level Comments
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **E2E Test**.
- **Justification:** While expense-level comments are tested, this is a separate feature on a different page (`GroupDetailPage.tsx`). An E2E test is needed to validate the complete user flow: typing and submitting a comment and seeing it appear in the list, including the real-time aspect.

### 5. Group Deletion with Confirmation
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **Both E2E and Component Tests**.
- **Justification:**
    - **Component Test:** The logic within the `EditGroupModal.tsx` that enables the final "Delete" button only after the user correctly types the group's name is a perfect, self-contained piece of UI logic for a component test.
    - **E2E Test:** The overall critical path—a user initiating the deletion, completing the confirmation, and verifying the group is gone—is a destructive and important flow that must be validated end-to-end.

### 6. Share Link Regeneration (in Share Group Modal)
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **E2E Test**.
- **Justification:** The user action of clicking the "Generate New" button and visually confirming that the share link and associated QR code data have been updated is a user-facing interaction that should be covered by an E2E test. Testing the QR code's image is not feasible, but we can assert the underlying data changes.

### 7. Real-time Connectivity Indicator
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **Unit and Component Tests**.
- **Justification:** Reliably testing network disconnection in an E2E test is complex and can be flaky. The logic for detecting connectivity status should be covered by **unit tests** (for the hook or store), and the `RealTimeIndicator.tsx` component's visual changes based on a status prop ('connected', 'disconnected') should be covered by simple **component tests**.

### 8. Settlement Editing and Deletion
- **Current E2E Coverage:** Untested.
- **Recommended Strategy:** **E2E Test**.
- **Justification:** This represents a core CRUD (Create, Read, Update, Delete) lifecycle for settlements. The user flow of navigating to the history, editing a settlement, or deleting one involves multiple components, modals, and API calls. This is a classic use case for E2E tests to ensure the entire feature works from the user's perspective.

### 9. Additional Analysis: Expense Split Strategies
An analysis of the codebase was performed to determine the test coverage for the core expense splitting strategies.

-   **Percentage Splits:** ✅ **Excellent coverage.** The backend has dedicated unit tests for the `PercentageSplitStrategy` that validate the total percentage, reject negative values, and ensure calculations are correct.
-   **Equal Splits:** ✅ **Good coverage.** This strategy is used in numerous backend integration and scenario tests. Its correct behavior is implicitly verified by the success of these broader balance and settlement tests.
-   **Exact Amount Splits:** ✅ **COMPLETED - Comprehensive unit test coverage implemented.**

#### Implementation Status: COMPLETED
-   **Feature:** `ExactAmountSplitStrategy` Validation
-   **Status:** **DONE** - Enhanced existing unit test with 31 comprehensive test cases covering:
    - **Core validation logic:** Sum validation, tolerance testing (0.01), missing/null amounts
    - **Edge cases:** Negative amounts (refunds), zero amounts, single participant scenarios
    - **Data integrity:** Duplicate users, invalid participants, wrong split counts
    - **Currency support:** Zero-decimal currencies (JPY, KRW, VND), floating-point precision
    - **Financial scenarios:** Large amounts, small amounts, boundary testing
-   **Key Discovery:** The ExactSplitStrategy **already included proper sum validation** - the original analysis was incorrect. The implementation validates that split amounts sum to total within 0.01 tolerance.
-   **Test Results:** All 31 tests pass, TypeScript build successful, no errors.

## Summary Table

| Feature Gap | Recommended Strategy | Status |
| :--- | :--- | :--- |
| Copy Expense | E2E Test | ✅ **COMPLETED** |
| Expense Form Drafts | **Unit Test** | ❌ Not implemented |
| Recent Amounts / Category Suggestions | **Component Test** | ❌ Not implemented |
| Group-Level Comments | E2E Test | ❌ Not implemented |
| Hard Group Deletion | E2E and Component Test | ❌ Not implemented |
| Share Link Regeneration | E2E Test | ❌ Not implemented |
| Real-time Connectivity Indicator | **Unit & Component Test** | ❌ Not implemented |
| Settlement Editing/Deletion | E2E Test | ❌ Not implemented |
| Expense Split Logic (Exact Amount) | **Unit Test** | ✅ **COMPLETED** |

## Implementation Details

### Copy Expense Feature Implementation (COMPLETED)

**Files Modified/Created:**
- `e2e-tests/src/__tests__/integration/expense-and-balance-lifecycle.e2e.test.ts` - Added 2 comprehensive test cases
- `e2e-tests/src/pages/expense-detail.page.ts` - Added `getCopyButton()` and `clickCopyExpenseButton()` methods
- `e2e-tests/src/pages/expense-form.page.ts` - Added copy validation helpers (`verifyCopyMode()`, `verifyPreFilledValues()`, `verifyDateIsToday()`)
- `e2e-tests/src/pages/expense-form.page.ts` - Refactored `waitForMembersInExpenseForm()` to accept member names instead of counts for better validation

**Key Implementation Notes:**
- Copy mode uses "Update Expense" button (not "Save Expense") due to shared `ExpenseFormActions` component logic
- Copy expense form correctly pre-fills all fields except date (which is set to today)
- Multi-user scenarios require careful balance calculation verification
- Real-time updates work correctly across multiple browser instances
- Tests include both basic 2-user and complex 3-user scenarios

**Test Coverage:**
- Basic copy workflow (2 users, EUR currency)
- Complex multi-user scenario (3 users, JPY currency, different payers)
- Form validation and pre-population
- Balance calculations with multiple expenses
- Real-time synchronization across browsers

## Next Steps

Based on this analysis, it is recommended to prioritize creating unit and component tests for the identified gaps first, as they are typically faster to write and provide a high degree of confidence in the core logic. Following that, new E2E tests should be written for the critical user flows. This balanced approach will improve test coverage and application quality most effectively.

### Exact Amount Split Strategy Unit Tests Implementation (COMPLETED)

**Files Modified:**
- `firebase/functions/src/__tests__/unit/services/splits/ExactSplitStrategy.test.ts` - Enhanced from 10 to 31 comprehensive test cases

**Key Implementation Notes:**
- **Corrected Analysis:** The original assessment was wrong - ExactSplitStrategy already included proper validation logic
- **Comprehensive Coverage:** Added 21 new test cases covering all critical edge cases and business scenarios
- **Currency Testing:** Special attention to zero-decimal currencies (JPY, KRW, VND) as requested
- **Financial Precision:** Thorough testing of floating-point precision and rounding tolerance (0.01)
- **Data Integrity:** Complete validation of user duplicates, missing participants, and invalid data states

**Test Results:**
- 31/31 tests passing
- TypeScript build successful
- No runtime errors or type issues
- Covers all identified business logic scenarios

**Business Impact:**
- Prevents financial calculation errors in production
- Ensures accurate expense splitting across all supported currencies
- Validates data integrity for multi-user expense scenarios
- Documents expected behavior for edge cases and error conditions

**Priority Order for Remaining Gaps:**
1. **Unit Tests** (fastest to implement):
   - ✅ ~~Exact Amount Split validation~~ **COMPLETED**
   - Expense Form Drafts logic
2. **Component Tests** (moderate effort):
   - Recent Amounts / Category Suggestions UI
   - Real-time Connectivity Indicator
3. **E2E Tests** (highest effort, highest value):
   - Group-Level Comments
   - Hard Group Deletion
   - Share Link Regeneration
   - Settlement Editing/Deletion
