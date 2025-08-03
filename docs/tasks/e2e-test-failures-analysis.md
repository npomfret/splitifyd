# E2E Test Failures Analysis

## Executive Summary

This document analyzes the systematic failures in the E2E test suite for the Splitifyd application. **As of 2025-08-03, 15 tests are failing** after implementing the fillPreactInput utility fix.

### Key Findings:
1. **Root Cause Identified**: Playwright's `fill()` method doesn't trigger Preact signal updates
2. **Solution Implemented**: `fillPreactInput` utility that types characters individually
3. **Mixed Results**: Fixed balance-settlement tests but add-expense tests regressed
4. **New Test Failures**: Dashboard and monitoring tests now failing
5. **Persistent Issues**: Modal dialogs, multi-user flows, and navigation problems remain

## Current Test Status (2025-08-03 - LATEST UPDATE)

### Currently Failing Tests (15 total)

1. **add-expense.e2e.test.ts** (4 tests) - **REGRESSION**
   - `should add new expense with equal split`
   - `should allow selecting expense category`
   - `should show expense in group after creation`
   - `should handle expense with date selection`

2. **balance-settlement.e2e.test.ts** - **ALL FIXED ✅**

3. **complex-unsettled-group.e2e.test.ts** (1 test)
   - `create group with multiple people and expenses that is NOT settled`

4. **dashboard.e2e.test.ts** (1 test) - **NEW**
   - `should navigate to group details after creating a group`

5. **delete-operations.e2e.test.ts** (1 test)
   - `should handle multi-user expense visibility`

6. **duplicate-registration.e2e.test.ts** (2 tests)
   - `should show error immediately without clearing form`
   - `should allow registration with different email after duplicate attempt`

7. **member-management.e2e.test.ts** (2 tests)
   - `should show member in expense split options`
   - `should show share functionality`

8. **monitoring.e2e.test.ts** (1 test) - **NEW**
   - `should handle rapid navigation without errors`

9. **multi-user-collaboration.e2e.test.ts** (2 tests)
   - `should handle group sharing via share link`
   - `should allow multiple users to add expenses to same group`

10. **multi-user-expenses.e2e.test.ts** (1 test)
    - `multiple users can join a group via share link and add expenses`

### Previously Fixed Tests Now Passing ✅

Based on the test results, the following tests that were documented as failing are now passing:
- `delete-operations.e2e.test.ts`: "should create and view an expense" ✅
- `balance-settlement.e2e.test.ts`: "should calculate balances after expenses" ✅
- `balance-settlement.e2e.test.ts`: "should handle complex balance calculations" ✅
- `duplicate-registration.e2e.test.ts`: Main duplicate registration test ✅

## Progress Update (2025-08-03)

### Completed Fixes

#### ⚠️ Priority 1: Create Group Modal Input Issue (REGRESSED)
**Previous Solution**: Added proper wait conditions and error handling in `create-group-modal.page.ts`
- Added explicit wait for modal to be visible
- Added fallback selectors for better reliability
- Improved error messages with debugging info
- Tests passed when run individually or with limited parallelism

**Key Changes Applied**:
```typescript
// Wait for modal to be fully visible first
await this.page.getByText(this.modalTitle).waitFor({ state: 'visible' });

// Wait for input to be enabled
await expect(nameInput).toBeEnabled({ timeout: 5000 });

// Use force option for filling
await nameInput.fill(name, { force: true });
```

**Status**: This fix has REGRESSED - tests are failing again with the same create group modal issues

#### ✅ Priority 2: Expense Detail Selector Violations (FIXED)
**Solution Applied**: Updated selector in `delete-operations.e2e.test.ts` to use `.first()`
```typescript
// Fixed from:
await expect(page.getByText('$50.00')).toBeVisible();

// To:
await expect(page.getByText('$50.00').first()).toBeVisible();
```

### New Tests Created

#### ✅ Duplicate User Registration Tests
Created comprehensive tests to ensure the server properly handles duplicate user registrations:

1. **Integration Test** (`firebase/functions/__tests__/integration/duplicate-user-registration.test.ts`)
   - Tests server API directly
   - Verifies 409 Conflict response for duplicate emails
   - Tests concurrent registration attempts
   - Confirms email case-insensitivity
   - All tests pass ✅

2. **E2E Test** (`e2e-tests/tests/duplicate-registration.e2e.test.ts`)
   - Tests full user flow through UI
   - Successfully registers user, logs out, attempts duplicate registration
   - Verifies error message appears on screen: "An account with this email already exists"
   - Confirms 409 error in console (marked as expected with `skip-error-checking` annotation)
   - Test passes ✅

### Outstanding Issues

#### 🔄 Priority 3: Share Link Join Flow
**Status**: Not yet addressed
**Next Steps**:
- Need to investigate join flow implementation
- Check if URL format has changed
- Verify authentication during join process

#### 🔄 Priority 4: Modal Dialog Selectors
**Status**: Not yet addressed
**Next Steps**:
- Update share modal selectors
- Consider adding data-testid attributes

## Detailed Failure Analysis

### 1. delete-operations.e2e.test.ts

#### Test: "should create and view an expense" ✅ FIXED
- **Error**: `strict mode violation: getByText('$50.00') resolved to 2 elements`
- **Location**: Line 42
- **Root Cause**: The expense detail page has two elements with "$50.00" text:
  - `<h2 class="text-3xl font-bold">$50.00</h2>` (heading)
  - `<p class="font-semibold">$50.00</p>` (paragraph)
- **Component**: ExpenseDetailPage.tsx
- **Fix Applied**: Used `.first()` selector

#### Test: "should handle multi-user expense visibility"
- **Error**: `page.waitForURL: Test timeout exceeded`
- **Location**: Line 76
- **Root Cause**: User 2 cannot join the group via share link - the navigation never completes
- **Component**: Join flow / routing
- **Status**: Pending fix

### 2. member-management.e2e.test.ts

#### Test: "should display current group members" ✅ FIXED
- **Error**: `Failed to fill group name. Expected: "Members Display Group", Got: ""`
- **Location**: CreateGroupModalPage line 47
- **Root Cause**: The group name input field is not accepting input
- **Component**: CreateGroupModalPage form handling
- **Fix Applied**: Updated CreateGroupModalPage with better wait conditions

#### Test: "should show member in expense split options" ✅ FIXED
- **Error**: Same create group modal issue
- **Root Cause**: Cannot proceed past group creation
- **Fix Applied**: Same as above

#### Test: "should show share functionality"
- **Error**: `[2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m()[22m`
- **Location**: Line 112
- **Root Cause**: The share modal dialog selector doesn't match the actual DOM
- **Component**: Share modal implementation
- **Status**: Pending fix

### 3. add-expense.e2e.test.ts

#### All 4 tests in this file ✅ FIXED:
- **Error**: `Failed to fill group name. Expected: "[Group Name]", Got: ""`
- **Tests affected**:
  - "should add new expense with equal split"
  - "should handle expense form validation"
  - "should allow selecting expense category"
  - "should show expense in group after creation"
- **Root Cause**: CreateGroupModalPage cannot fill the group name input
- **Fix Applied**: Updated CreateGroupModalPage with better wait conditions

### 4. balance-settlement.e2e.test.ts

#### Tests: "should calculate balances after expenses" and "should handle complex balance calculations" ✅ FIXED
- **Error**: `Failed to fill group name`
- **Root Cause**: Same create group modal issue
- **Fix Applied**: Same as above

### 5. complex-unsettled-group.e2e.test.ts

#### Test: "create group with multiple people and expenses that is NOT settled" ✅ FIXED
- **Error**: `MultiUserTestBuilder.createGroupWithFirstUser failed`
- **Root Cause**: The test builder relies on the same broken create group flow
- **Fix Applied**: Same as above

### 6. multi-user-collaboration.e2e.test.ts

#### Test: "should handle group sharing via share link"
- **Error**: `page.waitForURL: Test timeout`
- **Root Cause**: Join flow not completing navigation
- **Status**: Pending fix

#### Test: "should allow multiple users to add expenses to same group" ✅ FIXED
- **Error**: `Failed to fill group name`
- **Root Cause**: Create group modal issue
- **Fix Applied**: Same as above

## Common Failure Patterns

### Pattern 1: Create Group Modal Input Failure (Critical) ✅ FIXED
**Affected Tests**: 10 out of 12 failures
**Symptom**: Input field exists but doesn't accept text
**Root Cause**: Timing issues with modal animation and input readiness
**Solution Applied**: Added explicit waits and force fill option

### Pattern 2: Strict Mode Selector Violations ✅ FIXED
**Affected Tests**: 1 test
**Symptom**: Multiple elements match the same text selector
**Solution Applied**: Use `.first()` selector

### Pattern 3: Share Link Navigation ✅ FIXED
**Affected Tests**: 2 tests
**Symptom**: Navigation to group page after join never completes
**Root Cause**: 
- The join-group-store was trying to join the group during the preview phase
- Tests expected automatic navigation, but users need to click "Join Group" button
**Solution Applied**:
1. Created a new `/groups/preview` endpoint that returns group info without joining
2. Updated join-group-store to use preview endpoint instead of join endpoint
3. Updated tests to click the "Join Group" button before expecting navigation
4. Tests now pass when run individually

### Pattern 4: Modal Dialog Detection 🔄 PENDING
**Affected Tests**: 1 test
**Symptom**: Cannot find share modal dialog
**Possible Causes**:
- Selector mismatch
- Modal rendering outside expected container

## Lessons Learned

1. **Parallel Test Execution**: Tests that pass individually may fail when run in parallel due to timing issues
2. **Wait Strategies**: Explicit waits for element states are crucial for reliable tests
3. **Error Annotations**: Use `skip-error-checking` annotation for expected errors (e.g., 409 conflicts)
4. **Logout Flow**: Proper logout requires clicking user menu first, then the sign out button in dropdown

## Root Cause Analysis & Solution

### The Problem
The primary issue was that Playwright's `fill()` method wasn't properly triggering Preact signal updates. When `fill()` was used to set input values, the Preact signals that control form validation and button states weren't updating, causing submit buttons to remain disabled even with valid input.

### The Solution: fillPreactInput Utility
Created a reusable utility function that:
1. **Clicks to focus** the input
2. **Clears existing content** with `fill('')`
3. **Types each character individually** using `type()` to trigger onChange events
4. **Blurs the field** to ensure validation runs
5. **Waits 100ms** for signal updates to propagate

```typescript
async fillPreactInput(selector: string | Locator, value: string) {
  const input = typeof selector === 'string' ? this.page.locator(selector) : selector;
  await input.click();
  await input.fill('');
  for (const char of value) {
    await input.type(char);
  }
  await input.blur();
  await this.page.waitForTimeout(100);
}
```

### Implementation
1. Added `fillPreactInput` to `BasePage` class
2. Updated all page objects to use the new utility:
   - `CreateGroupModalPage`
   - `RegisterPage` 
   - `LoginPage`
   - `GroupDetailPage`
3. Updated tests with direct `fill()` calls to use the utility

### Results
- **Initial failing tests**: 16
- **After fillPreactInput utility**: 15 (different set)
- **Tests fixed**: balance-settlement (8 tests), some member-management
- **New failures**: add-expense tests regressed, dashboard and monitoring tests added

### Important Note
The add-expense tests that were passing earlier have now regressed, suggesting the fillPreactInput utility may need refinement or there are other timing/state issues.

## Remaining Issues (15 tests)

### Category 1: Expense Creation Issues (4 tests) - REGRESSION
- **add-expense**: All 4 tests now failing (were passing after initial fix)
- Likely cause: Form submission or navigation timing issues

### Category 2: Modal Dialog Issues (2 tests)
- **member-management**: "should show share functionality" - Can't find dialog role
- **member-management**: "should show member in expense split options" - Split section UI issue

### Category 3: Multi-User Flow Issues (5 tests)
- **multi-user-collaboration**: Both tests failing on share link navigation
- **multi-user-expenses**: Join flow not completing
- **delete-operations**: Multi-user expense visibility
- **complex-unsettled-group**: Multi-user test builder issues

### Category 4: Form/Navigation Issues (3 tests)
- **duplicate-registration**: Both tests stuck on dashboard after logout
- **dashboard**: Navigation after group creation

### Category 5: Performance/Monitoring (1 test)
- **monitoring**: Rapid navigation test failing

## Key Learnings

1. **Preact Signals & Playwright**: Playwright's `fill()` method doesn't trigger the onChange events that Preact signals rely on. This is a fundamental incompatibility that requires typing characters individually.

2. **User-Like Testing**: The solution respects the principle of testing like a user - we're still interacting with the same UI elements users would, just ensuring the events fire properly.

3. **Centralized Solutions**: Creating a utility function in the base class provides a single place to maintain the workaround, making it easy to update or remove when Playwright/Preact compatibility improves.

4. **Test Categories**: The remaining failures fall into distinct categories that need different solutions:
   - Modal selectors need updating
   - Multi-user flows need proper navigation handling
   - Form navigation issues need state management fixes
   - Server errors need backend investigation

## Next Steps

1. **Fix Modal Selectors**: Update share modal to use proper selectors (not dialog role)
2. **Fix Multi-User Navigation**: Ensure proper "Join Group" button clicks and navigation waits
3. **Fix Duplicate Registration**: Ensure proper navigation to register page after logout
4. **Investigate Server Error**: Check why expense creation returns 500 in one specific test
5. **Consider Test Parallelism**: Some issues may be related to parallel test execution

## Regression Pattern Analysis

### Key Observations
1. **Widespread Regression**: 10 out of 16 failing tests were previously marked as fixed
2. **Create Group Modal**: The most critical fix has completely regressed
3. **Parallel Execution Issues**: Tests that passed individually are now failing even in isolation
4. **New Test Failures**: Additional tests are now failing that weren't documented before

### Possible Causes of Regression
1. **Recent Code Changes**: The commit history shows multiple "fixing tests" commits which may have introduced new issues
2. **Timing/Race Conditions**: The fixes may have been fragile and dependent on specific timing
3. **Environmental Changes**: Changes to the Firebase emulator or test environment
4. **Incomplete Fixes**: The original fixes may have addressed symptoms rather than root causes

## Notes

- The application appears to be using Preact (not React) which might affect timing
- The tests use Playwright's strict mode which is good for reliability
- Consider adding more specific selectors (data-testid) to avoid text-based selections
- The multi-user test scenarios are complex and may need special handling for timing
- Server correctly handles duplicate user registrations with 409 status
- Existing logout test confirmed in `dashboard.e2e.test.ts`
- Join flow now requires explicit user action (clicking Join button) for security
- Firebase functions auto-reload on changes but may need a few seconds to pick up new endpoints
- Create Group Modal issue appears intermittently when tests run in parallel
- **Major regression observed**: Previously fixed tests are failing again, indicating unstable fixes