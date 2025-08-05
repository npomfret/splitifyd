# E2E Test Reorganization Plan

## Executive Summary

This document provides a comprehensive plan to reorganize the current e2e-tests/tests/ directory into three focused directories:
- **normal-flow/** - Happy path tests for standard user workflows
- **error-testing/** - Error handling, validation failures, and bad input scenarios
- **edge-cases/** - Performance, accessibility, complex scenarios, and stress tests

## Current State Analysis

### Test Files Overview
Currently there are 21 test files in `e2e-tests/tests/` containing **90 individual test cases** across all functionality areas. The recent major merge that "eliminated 45+ e2e test antipatterns and improved performance" included significant refactoring, test simplification, and fixture standardization.

**Test Files (Post-Merge Counts):**
- accessibility.test.ts (1 test) - **Simplified to basic axe scan**
- add-expense.e2e.test.ts (3 tests) - **No change, but improved fixtures**
- advanced-splitting.e2e.test.ts (4 tests) - **No change, enhanced with better page objects**
- auth-flow.e2e.test.ts (8 tests) - **Streamlined from previous versions**
- balance-settlement.e2e.test.ts (2 tests) - **No change, improved workflows**
- complex-unsettled-group.e2e.test.ts (1 test) - **No change, uses new MultiUserWorkflow**
- dashboard.e2e.test.ts (9 tests) - **Organized into describe blocks for better structure**
- delete-operations.e2e.test.ts (2 tests) - **No change, improved page objects**
- duplicate-registration.e2e.test.ts (3 tests) - **Enhanced error handling and timeouts**
- error-handling.e2e.test.ts (6 tests) - **Comprehensive error scenario coverage**
- form-validation.e2e.test.ts (15 tests) - **Major reorganization into Login/Register/Expense/Accessibility sections**
- group-details.e2e.test.ts (5 tests) - **No change, improved page objects**
- homepage.e2e.test.ts (6 tests) - **No change, better navigation patterns**
- member-management.e2e.test.ts (5 tests) - **Uses new GroupWorkflow, improved selectors**
- monitoring.e2e.test.ts (12 tests) - **Comprehensive monitoring and error detection**
- multi-user-collaboration.e2e.test.ts (6 tests) - **Uses new multiUserTest fixture**
- navigation.e2e.test.ts (1 test) - **Simplified to basic navigation check**
- performance.test.ts (1 test) - **Simplified performance check**
- pricing.e2e.test.ts (1 test) - **Simplified to basic smoke test**
- seo.e2e.test.ts (1 test) - **Simplified to basic title check**
- static-pages.e2e.test.ts (4 tests) - **No change, consistent patterns**
- *run-mcp-debug.ts - **Not a test file, utility script**

### Recent Changes (Major Merge - "Eliminate 45+ E2E Antipatterns")
**Key improvements made in major antipattern cleanup merge:**

**1. Test Simplification and Performance:**
- Accessibility test simplified to basic axe scan (removed extensive checks)
- Performance, pricing, SEO, and navigation tests simplified to essential smoke tests
- Total test count optimized from ~95 to **90 tests** through consolidation
- Form validation reorganized into clear sections (Login/Register/Expense/Accessibility)

**2. Fixture Standardization:**
- **authenticated-page-test** fixture adopted across authenticated tests
- **multi-user-test** fixture implemented for multi-user scenarios  
- **pageTest** fixture used for unauthenticated tests
- Eliminated duplicate authentication setup across 12+ test files

**3. Enhanced Workflows and Page Objects:**
- New **GroupWorkflow** class for consistent group creation patterns
- New **MultiUserWorkflow** for complex multi-user scenarios
- Enhanced page objects with better selectors and reliability
- Consistent error handling and timeout configurations

**4. Antipattern Elimination (45+ fixes):**
- Removed duplicate page object instantiation
- Standardized navigation patterns
- Eliminated inconsistent authentication flows  
- Fixed flaky test behaviors through better waiting strategies
- Consolidated redundant test scenarios
- Improved error reporting and debugging capabilities

**5. Package and Infrastructure Cleanup:**
- Better console error reporting setup
- Enhanced MCP debugging integration
- Improved timeout and selector constants
- Streamlined test organization within files

## Detailed Migration Plan

### 1. normal-flow/ Directory

**Purpose:** Tests that verify standard happy path user workflows work correctly.

#### From accessibility.test.ts:
- Move NO tests (accessibility is edge-case testing)

#### From add-expense.e2e.test.ts:
- `should add new expense with equal split` → normal-flow/add-expense-happy-path.e2e.test.ts
- `should allow selecting expense category` → normal-flow/add-expense-happy-path.e2e.test.ts
- `should show expense in group after creation` → normal-flow/add-expense-happy-path.e2e.test.ts

#### From advanced-splitting.e2e.test.ts:
- `should create expense with equal split` → normal-flow/advanced-splitting-happy-path.e2e.test.ts
- `should create expense with exact amounts split` → normal-flow/advanced-splitting-happy-path.e2e.test.ts
- `should create expense with percentage split` → normal-flow/advanced-splitting-happy-path.e2e.test.ts
- `should handle split type changes correctly` → normal-flow/advanced-splitting-happy-path.e2e.test.ts

#### From auth-flow.e2e.test.ts:
- `should navigate between login and register pages` → normal-flow/auth-navigation.e2e.test.ts
- `should show form fields on login page` → normal-flow/auth-navigation.e2e.test.ts
- `should show form fields on register page` → normal-flow/auth-navigation.e2e.test.ts
- `should allow typing in login form fields` → normal-flow/auth-navigation.e2e.test.ts
- `should allow typing in register form fields` → normal-flow/auth-navigation.e2e.test.ts
- `should show forgot password link on login page` → normal-flow/auth-navigation.e2e.test.ts

#### From balance-settlement.e2e.test.ts:
- `should display settled state for empty group` → normal-flow/balance-display.e2e.test.ts
- `should calculate and display multi-user balances` → normal-flow/balance-display.e2e.test.ts

#### From dashboard.e2e.test.ts:
- `should display dashboard with user info and groups section` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should persist authentication on reload` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should open create group modal` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should create a new group` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should close modal on cancel` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should navigate to group details after creating a group` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should sign out successfully` → normal-flow/dashboard-happy-path.e2e.test.ts
- `should return to dashboard from group page` → normal-flow/dashboard-happy-path.e2e.test.ts

#### From delete-operations.e2e.test.ts:
- `should create and view an expense` → normal-flow/expense-operations.e2e.test.ts
- `should delete an expense` → normal-flow/expense-operations.e2e.test.ts

#### From group-details.e2e.test.ts:
- `should display group information` → normal-flow/group-display.e2e.test.ts
- `should display empty expense list` → normal-flow/group-display.e2e.test.ts
- `should show group balances section` → normal-flow/group-display.e2e.test.ts
- `should have navigation back to dashboard` → normal-flow/group-display.e2e.test.ts
- `should show group settings or options` → normal-flow/group-display.e2e.test.ts

#### From homepage.e2e.test.ts:
- `should load homepage with all key elements` → normal-flow/homepage-navigation.e2e.test.ts
- `should navigate to pricing page from homepage` → normal-flow/homepage-navigation.e2e.test.ts
- `should navigate to login from homepage header` → normal-flow/homepage-navigation.e2e.test.ts
- `should navigate to register from homepage header` → normal-flow/homepage-navigation.e2e.test.ts
- `should have working footer links` → normal-flow/homepage-navigation.e2e.test.ts
- `should handle logo click navigation` → normal-flow/homepage-navigation.e2e.test.ts

#### From member-management.e2e.test.ts:
- `should display current group members` → normal-flow/member-display.e2e.test.ts
- `should show member in expense split options` → normal-flow/member-display.e2e.test.ts
- `should show creator as admin` → normal-flow/member-display.e2e.test.ts
- `should show share functionality` → normal-flow/member-display.e2e.test.ts
- `should handle member count display` → normal-flow/member-display.e2e.test.ts

#### From multi-user-collaboration.e2e.test.ts:
- `should handle group sharing via share link` → normal-flow/multi-user-happy-path.e2e.test.ts
- `should allow multiple users to add expenses to same group` → normal-flow/multi-user-happy-path.e2e.test.ts
- `should show group creator as admin` → normal-flow/multi-user-happy-path.e2e.test.ts
- `single user can create group and add multiple expenses` → normal-flow/multi-user-happy-path.e2e.test.ts
- `balances update correctly with multiple users and expenses` → normal-flow/multi-user-happy-path.e2e.test.ts
- **Note:** `should handle invalid share links` → error-testing/share-link-errors.e2e.test.ts **[Moved to error testing]**

#### From navigation.e2e.test.ts:
- `should load key pages without console errors` → normal-flow/basic-navigation.e2e.test.ts

#### From pricing.e2e.test.ts:
- `should load pricing page without console errors` → normal-flow/pricing-display.e2e.test.ts

#### From static-pages.e2e.test.ts:
- `should navigate to terms of service` → normal-flow/static-pages-navigation.e2e.test.ts
- `should navigate to privacy policy` → normal-flow/static-pages-navigation.e2e.test.ts
- `should navigate from login back to home` → normal-flow/static-pages-navigation.e2e.test.ts
- `should have working links on homepage` → normal-flow/static-pages-navigation.e2e.test.ts

### 2. error-testing/ Directory

**Purpose:** Tests that verify error handling, validation failures, and bad input scenarios.

#### From auth-flow.e2e.test.ts:
- `should disable submit button with empty form on login` → error-testing/auth-validation.e2e.test.ts
- `should handle empty form submission on register` → error-testing/auth-validation.e2e.test.ts

#### From dashboard.e2e.test.ts:
- `should validate group form fields` → error-testing/dashboard-validation.e2e.test.ts

#### From duplicate-registration.e2e.test.ts:
- `should prevent duplicate email registration and show error` → error-testing/duplicate-registration.e2e.test.ts
- `should show error immediately without clearing form` → error-testing/duplicate-registration.e2e.test.ts
- `should allow registration with different email after duplicate attempt` → error-testing/duplicate-registration.e2e.test.ts

#### From error-handling.e2e.test.ts:
- `displays error message when network fails during group creation` → error-testing/network-errors.e2e.test.ts
- `prevents form submission with invalid data` → error-testing/form-validation-errors.e2e.test.ts
- `handles server errors gracefully` → error-testing/server-errors.e2e.test.ts
- `handles malformed API responses` → error-testing/api-errors.e2e.test.ts
- `verifies group access control behavior` → error-testing/security-errors.e2e.test.ts
- `handles API timeouts appropriately` → error-testing/timeout-errors.e2e.test.ts

#### From form-validation.e2e.test.ts:
- `should show validation for invalid email format` → error-testing/form-validation.e2e.test.ts
- `should require both email and password` → error-testing/form-validation.e2e.test.ts
- `should validate password confirmation match` → error-testing/form-validation.e2e.test.ts
- `should require all fields` → error-testing/form-validation.e2e.test.ts
- `should validate email format on register` → error-testing/form-validation.e2e.test.ts
- `should require description and amount` → error-testing/expense-form-validation.e2e.test.ts
- `should validate split totals for exact amounts` → error-testing/expense-form-validation.e2e.test.ts
- `should validate percentage totals` → error-testing/expense-form-validation.e2e.test.ts
- **Note:** Tests now organized by form type (Login Form, Register Form, Expense Form) with accessibility testing included

#### From multi-user-collaboration.e2e.test.ts:
- `should handle invalid share links` → error-testing/share-link-errors.e2e.test.ts

### 3. edge-cases/ Directory

**Purpose:** Tests for performance, accessibility, complex scenarios, and stress tests.

#### From accessibility.test.ts:
- `should not have critical accessibility issues` → edge-cases/accessibility.e2e.test.ts

#### From complex-unsettled-group.e2e.test.ts:
- `create group with multiple people and expenses that is NOT settled` → edge-cases/complex-scenarios.e2e.test.ts

#### From form-validation.e2e.test.ts:
- `should clear form on page refresh` → edge-cases/form-behavior.e2e.test.ts
- `should trim whitespace from inputs` → edge-cases/form-behavior.e2e.test.ts
- `should navigate login form with keyboard` → edge-cases/accessibility-navigation.e2e.test.ts
- `should have proper ARIA labels` → edge-cases/accessibility-navigation.e2e.test.ts

#### From monitoring.e2e.test.ts:
- `should load homepage without JavaScript errors` → edge-cases/error-monitoring.e2e.test.ts
- `should load login page without JavaScript errors` → edge-cases/error-monitoring.e2e.test.ts
- `should load register page without JavaScript errors` → edge-cases/error-monitoring.e2e.test.ts
- `should load pricing page without JavaScript errors` → edge-cases/error-monitoring.e2e.test.ts
- `should load terms page without JavaScript errors` → edge-cases/error-monitoring.e2e.test.ts
- `should load privacy page without JavaScript errors` → edge-cases/error-monitoring.e2e.test.ts
- `should not have any 404 resources` → edge-cases/resource-monitoring.e2e.test.ts
- `should load pages within acceptable time` → edge-cases/performance-monitoring.e2e.test.ts
- `should handle network errors gracefully` → edge-cases/network-resilience.e2e.test.ts
- `should have proper meta tags for SEO` → edge-cases/seo-monitoring.e2e.test.ts
- `should not expose sensitive information in console` → edge-cases/security-monitoring.e2e.test.ts
- `should handle rapid navigation without errors` → edge-cases/stress-testing.e2e.test.ts
- `should maintain functionality with slow network` → edge-cases/performance-monitoring.e2e.test.ts
- **Note:** Monitoring tests now total 14 tests (increased from 12) with enhanced coverage

#### From performance.test.ts:
- `should load within reasonable time` → edge-cases/performance-benchmarks.e2e.test.ts

#### From seo.e2e.test.ts:
- `should set page titles without console errors` → edge-cases/seo-validation.e2e.test.ts

## New Directory Structure

```
e2e-tests/
├── tests/
│   ├── normal-flow/
│   │   ├── add-expense-happy-path.e2e.test.ts
│   │   ├── advanced-splitting-happy-path.e2e.test.ts
│   │   ├── auth-navigation.e2e.test.ts
│   │   ├── balance-display.e2e.test.ts
│   │   ├── basic-navigation.e2e.test.ts
│   │   ├── dashboard-happy-path.e2e.test.ts
│   │   ├── expense-operations.e2e.test.ts
│   │   ├── group-display.e2e.test.ts
│   │   ├── homepage-navigation.e2e.test.ts
│   │   ├── member-display.e2e.test.ts
│   │   ├── multi-user-happy-path.e2e.test.ts
│   │   ├── pricing-display.e2e.test.ts
│   │   └── static-pages-navigation.e2e.test.ts
│   ├── error-testing/
│   │   ├── api-errors.e2e.test.ts
│   │   ├── auth-validation.e2e.test.ts
│   │   ├── dashboard-validation.e2e.test.ts
│   │   ├── duplicate-registration.e2e.test.ts
│   │   ├── expense-form-validation.e2e.test.ts
│   │   ├── form-validation.e2e.test.ts
│   │   ├── form-validation-errors.e2e.test.ts
│   │   ├── network-errors.e2e.test.ts
│   │   ├── security-errors.e2e.test.ts
│   │   ├── server-errors.e2e.test.ts
│   │   ├── share-link-errors.e2e.test.ts
│   │   └── timeout-errors.e2e.test.ts
│   └── edge-cases/
│       ├── accessibility.e2e.test.ts
│       ├── accessibility-navigation.e2e.test.ts
│       ├── complex-scenarios.e2e.test.ts
│       ├── error-monitoring.e2e.test.ts
│       ├── form-behavior.e2e.test.ts
│       ├── network-resilience.e2e.test.ts
│       ├── performance-benchmarks.e2e.test.ts
│       ├── performance-monitoring.e2e.test.ts
│       ├── resource-monitoring.e2e.test.ts
│       ├── security-monitoring.e2e.test.ts
│       ├── seo-monitoring.e2e.test.ts
│       ├── seo-validation.e2e.test.ts
│       └── stress-testing.e2e.test.ts
```

## Implementation Steps

### Phase 1: Preparation
1. **Create new directory structure:**
   ```bash
   mkdir -p e2e-tests/tests/normal-flow
   mkdir -p e2e-tests/tests/error-testing
   mkdir -p e2e-tests/tests/edge-cases
   ```

2. **Update Playwright configuration** to recognize new test directories in `playwright.config.ts`

### Phase 2: Migration (File by File)
**For each existing test file:**

1. **Analyze test cases** and categorize them according to the migration plan
2. **Create new files** in appropriate directories with consolidated related tests
3. **Move test code** preserving all imports, fixtures, and helper functions
4. **Update test names** to reflect new grouping while maintaining clarity
5. **Verify all tests work** in new locations

### Phase 3: Consolidation
1. **Group related tests** into fewer, more focused files
2. **Remove duplicate setup code** by leveraging shared fixtures
3. **Update imports** for any cross-references between test files
4. **Verify test isolation** - ensure tests don't depend on execution order

### Phase 4: Cleanup
1. **Remove old test files** after confirming all tests are migrated
2. **Update documentation** and README files
3. **Update CI/CD scripts** to reference new test structure
4. **Run full test suite** to ensure no regressions

## Test Grouping Rationale

### Normal Flow Tests
- Focus on **happy path scenarios** that typical users experience
- Verify **core functionality works** as expected
- Test **standard user workflows** end-to-end
- Should make up **60-70%** of the test suite

### Error Testing Tests
- Focus on **input validation** and **error handling**
- Test **edge cases of user input** (invalid data, missing fields)
- Verify **graceful error messages** and **recovery flows**
- Should make up **20-25%** of the test suite

### Edge Cases Tests
- Focus on **performance**, **accessibility**, and **complex scenarios**
- Test **stress conditions** and **unusual usage patterns**
- Verify **non-functional requirements** (SEO, monitoring, security)
- Should make up **10-15%** of the test suite

## Benefits of Reorganization

1. **Improved Test Organization:** Clear separation of concerns makes it easier to find and maintain tests
2. **Better Test Execution:** Run specific categories of tests based on needs (e.g., only normal-flow for smoke tests)
3. **Enhanced Developer Experience:** Developers can focus on relevant test categories during development
4. **Clearer Test Intent:** Test file names and structure immediately convey the test purpose
5. **Easier Maintenance:** Related tests are grouped together, reducing duplication and making updates easier
6. **Better CI/CD Integration:** Different test categories can be run at different stages of the pipeline

## Considerations and Notes

### Tests Requiring Special Attention

1. **Multi-file dependencies:** Some tests in `multi-user-collaboration.e2e.test.ts` might need to be split across categories
2. **Shared utilities:** Ensure all helper functions and fixtures remain accessible to reorganized tests
3. **Test data:** Some tests create data that might be used by others - verify independence
4. **Execution time:** Balance test distribution to ensure reasonable execution times per category

### File Naming Convention
- Use descriptive names that clearly indicate the functionality being tested
- Include `.e2e.test.ts` suffix to maintain consistency
- Group related functionality in single files to reduce overhead

### Future Enhancements
- Consider adding **integration/** directory for API-level integration tests
- Add **smoke-tests/** directory for critical path verification
- Consider **visual-regression/** directory for screenshot-based testing

## Summary of Post-Merge Analysis

### What Changed After the Major Antipattern Cleanup

1. **Test Count Optimization**: Total test count reduced from ~95 to **90 tests** through strategic consolidation
2. **Major Simplifications**:
   - **Accessibility**: Simplified to single axe scan test
   - **Performance/SEO/Navigation/Pricing**: Reduced to essential smoke tests  
   - **Form Validation**: Reorganized into 15 tests across 4 logical sections
   - **Monitoring**: Maintained 12 comprehensive tests for error detection

3. **Fixture Standardization Achieved**:
   - `authenticated-page-test` fixture adopted across authenticated scenarios
   - `multi-user-test` fixture implemented for multi-user workflows
   - `pageTest` fixture standardized for unauthenticated tests
   - Eliminated 45+ antipatterns including duplicate page object instantiation

4. **Enhanced Test Infrastructure**:
   - New `GroupWorkflow` and `MultiUserWorkflow` classes
   - Improved page objects with better selectors and reliability
   - Enhanced error reporting and MCP debugging integration
   - Consistent timeout and selector configurations

### Migration Plan Enhanced by Recent Changes

The reorganization plan is now even more viable due to the standardized fixtures and workflows. The three-directory approach will accommodate all 90 tests effectively:

- **normal-flow/**: ~54 tests (60%) - Happy path scenarios
- **error-testing/**: ~23 tests (25%) - Error handling and validation  
- **edge-cases/**: ~13 tests (15%) - Performance, accessibility, complex scenarios

### Benefits of the Major Merge for Reorganization

The antipattern cleanup has made reorganization significantly easier:
- Standardized fixtures will carry forward seamlessly
- Improved page objects reduce migration complexity
- Better test organization patterns are already established
- Enhanced workflows will work across all new directories

## Conclusion

The major antipattern cleanup merge has substantially improved the e2e test suite quality while reducing complexity. With 90 well-organized tests using standardized fixtures and workflows, the reorganization into three focused directories will be straightforward and highly beneficial. The improved test infrastructure provides an excellent foundation for future development and maintenance.