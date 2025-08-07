# Task: E2E Test Suite Audit and Refactoring

**Status:** In Progress
**Priority:** High  
**Effort:** Medium

## Executive Summary

The E2E test suite has excellent documentation (`e2e-tests/README.md`) defining clear principles: 1-second action timeouts, 10-second test timeouts, fixture-based authentication, and strict test isolation. However, the actual implementation has accumulated technical debt with console.log debugging, complex abstractions, and duplicated tests.

This document outlines the refactoring plan to bring the test suite into full compliance with its stated guidelines.

## Current Issues

### 1. Console.log Debugging (30+ instances)
**Issue:** Tests contain extensive console.log statements for debugging, violating the principle of using Playwright's built-in debugging tools.

**Most Affected:** 
- `balance-visualization.e2e.test.ts` (30+ console.log statements)

### 2. Complex Test Abstractions
**Issue:** Tests contain unnecessary abstractions that make them harder to read and maintain.

**Example:**
- `BalanceTestScenarios` class in `balance-visualization.e2e.test.ts` (lines 14-106)

### 3. Test Duplication
**Issue:** Multiple files test the same functionality, increasing maintenance burden and test execution time.

**Examples:**
- Access control tested in both `security-errors.e2e.test.ts` and potentially other files
- Form validation spread across multiple files
- Balance calculations tested in multiple places

### 4. Fixture Usage
**Note:** Based on inspection, most tests now correctly use `authenticatedPageTest`. The audit's claim about manual user creation may be outdated - `member-display.e2e.test.ts` properly uses fixtures.

## Refactoring Plan

### Phase 1: Remove Anti-patterns (High Priority)
**Target Files:** `balance-visualization.e2e.test.ts`, `three-user-settlement.e2e.test.ts`

1. **Remove all console.log statements** 
   - Replace with Playwright's trace viewer and HTML reporter
   - Use `test.info()` for necessary test metadata

2. **Simplify complex test logic**
   - Remove `BalanceTestScenarios` class 
   - Make tests direct and readable using page object methods
   - Remove unnecessary page.reload() calls

### Phase 2: Consolidate Duplicate Tests (Medium Priority)

3. **Merge form validation tests**
   - Create single comprehensive `form-validation.e2e.test.ts`
   - Remove redundant validation from other files

4. **Consolidate access control tests**
   - Keep only one version in appropriate location
   - Use `multiUserTest` fixture for proper multi-user testing

5. **Centralize balance tests**
   - Keep balance logic in `balance-visualization.e2e.test.ts`
   - Remove redundant balance checks from other files

### Phase 3: Optimize Test Structure (Low Priority)

6. **Remove inefficient beforeEach hooks**
   - Combine related tests into single user journeys
   - Create groups within tests rather than in setup

7. **Verify fixture usage**
   - Audit all test files for correct fixture usage
   - Ensure no manual authentication remains

## Expected Outcomes

- **Performance:** Test suite execution under 2 minutes (currently likely 3-4 minutes)
- **Reliability:** No flaky tests from complex logic or console.log debugging
- **Maintainability:** Simple, readable tests without abstractions
- **Compliance:** 100% adherence to README principles

## Implementation Approach

1. **Start with Phase 1** - Removing anti-patterns provides immediate reliability improvements
2. **Track metrics** - Measure test execution time before and after each phase
3. **Add enforcement** - Consider pre-commit hooks to prevent regression:
   - Block console.log in test files
   - Detect test.skip or commented tests
   - Enforce timeout limits

## Success Criteria

- Zero console.log statements in test files
- No custom test abstraction classes
- Single source of truth for each test scenario
- All tests complete within timeout limits (10 seconds per test)
- Full compliance with `e2e-tests/README.md` principles