# E2E Test Consolidation Plan

## Current State Analysis
- **42 test files** in `e2e-tests/src/__tests__/integration/`
- Significant duplication across test files
- Many redundant "happy path" tests
- Tests are currently working and passing

## Identified Issues
1. **Massive duplication**: Same scenarios tested multiple times
2. **Poor organization**: Tests scattered across too many files
3. **Redundant coverage**: Multiple "happy path" files testing the same flows
4. **Maintenance burden**: 42 files to maintain for similar functionality

## Consolidation Plan

### Target: 12 Focused Test Files

#### 1. **auth-and-registration.e2e.test.ts**
Consolidates:
- auth-security.e2e.test.ts
- duplicate-registration.e2e.test.ts
- registration-loading.e2e.test.ts
- terms-acceptance.e2e.test.ts

#### 2. **group-lifecycle.e2e.test.ts**
Consolidates:
- group-management.e2e.test.ts
- group-deletion-multi-user.e2e.test.ts
- parallel-group-joining.e2e.test.ts

#### 3. **member-lifecycle.e2e.test.ts**
Consolidates:
- member-management.e2e.test.ts
- member-display.e2e.test.ts
- leave-group.e2e.test.ts

#### 4. **expense-lifecycle.e2e.test.ts**
Consolidates:
- expense-operations.e2e.test.ts
- expense-editing-errors.e2e.test.ts
- expense-datetime.e2e.test.ts
- freeform-categories.e2e.test.ts

#### 5. **settlements-and-balances.e2e.test.ts**
Consolidates:
- settlements.e2e.test.ts
- balance-visualization.e2e.test.ts
- three-user-settlement.e2e.test.ts

#### 6. **realtime-sync.e2e.test.ts**
Consolidates:
- realtime-dashboard-updates.e2e.test.ts
- realtime-expense-editing.e2e.test.ts
- realtime-member-changes.e2e.test.ts
- realtime-edge-cases.e2e.test.ts
- comments-realtime.e2e.test.ts
- group-realtime-updates.e2e.test.ts

#### 7. **form-validation.e2e.test.ts**
Consolidates:
- form-validation-comprehensive.e2e.test.ts
- input-validation.e2e.test.ts

#### 8. **network-handling.e2e.test.ts**
Consolidates:
- network-errors.e2e.test.ts
- network-resilience.e2e.test.ts
- timeout-errors.e2e.test.ts

#### 9. **navigation-and-static.e2e.test.ts**
Consolidates:
- navigation-comprehensive.e2e.test.ts
- policy-pages.e2e.test.ts
- policy-update-acceptance.e2e.test.ts
- pricing-display.e2e.test.ts
- seo-validation.e2e.test.ts
- accessibility.e2e.test.ts

#### 10. **share-links.e2e.test.ts**
Keep as is:
- share-link-comprehensive.e2e.test.ts (already comprehensive)

#### 11. **multi-currency.e2e.test.ts**
Keep as is:
- multi-currency-basic.e2e.test.ts

#### 12. **user-profile.e2e.test.ts**
Keep as is:
- user-profile-management.e2e.test.ts

### Files to Remove Completely (Pure Redundancy)
- dashboard-happy-path.e2e.test.ts
- multi-user-happy-path.e2e.test.ts
- advanced-splitting-happy-path.e2e.test.ts
- complex-scenarios.e2e.test.ts
- performance-monitoring.e2e.test.ts

## Implementation Approach

### CORRECT APPROACH (Not followed in first attempt):
1. **Copy test cases exactly as they are** - no modifications
2. **Group by describe blocks** within consolidated files
3. **Keep all existing test assertions and page object method calls**
4. **Only remove exact duplicate test cases**
5. **Preserve all skip-error-checking annotations**

### MISTAKES MADE IN FIRST ATTEMPT:
1. **Modified method calls** during consolidation (e.g., changed `inferGroupName()` to `getGroupTitle().textContent()`)
2. **Added unnecessary null checks** (e.g., `|| 'Unknown Group'`)
3. **Changed method signatures** (e.g., `clearFormField` to `fillFormField`)
4. **Renamed methods that didn't exist** (e.g., `expectRemovalBlockedAndCancel` to `waitForOutstandingBalanceError`)
5. **Fixed "errors" that weren't errors** - the tests were working!

## Key Learnings

1. **Tests were working** - All 42 test files were functional with existing page objects
2. **Don't modify during consolidation** - Copy tests exactly as they are
3. **Page object methods exist** - If a test is calling a method, it exists
4. **Compilation errors indicate transcription mistakes** - Not missing methods

## Expected Benefits
- **71% reduction** in test files (42 → 12)
- **Easier maintenance** - Related tests in single files
- **Better organization** - Clear lifecycle patterns
- **Reduced duplication** - Single source of truth for each scenario
- **~40% faster runtime** - Less overhead and duplication

## Next Steps for Clean Implementation
1. Revert all changes
2. Copy tests EXACTLY as they are into new consolidated files
3. Only organize by describe blocks - no code changes
4. Delete redundant files only after verifying consolidated tests compile
5. Run full test suite to ensure no regression

## Critical Rule
**DO NOT MODIFY TEST CODE DURING CONSOLIDATION** - If it worked before, it should work after consolidation with zero changes to the test logic or method calls.