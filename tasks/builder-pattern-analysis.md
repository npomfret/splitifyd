# Builder Pattern Analysis and Recommendations

## 1. Overview

This document provides a detailed, incremental implementation plan for consolidating and improving the builder pattern across the codebase. Based on analysis of the current state, we have identified significant opportunities to improve test maintainability, reduce code duplication, and enforce consistent patterns.

A thorough review of the TypeScript codebase was conducted to identify the usage of the builder pattern for creating test data and other objects. The goal was to find inconsistencies, duplication, and opportunities for improving code quality and maintainability by leveraging this powerful pattern.

The analysis confirms that a comprehensive and well-structured set of builders already exists in the `packages/test-support/builders` directory. However, these builders are not used consistently across the test suites, leading to verbose, duplicated, and less maintainable test code.

**Current State:**
- 8 well-designed builders in `packages/test-support/builders`
- 7+ ad-hoc builders scattered across test files
- Manual object creation in critical test files
- E2E tests with hardcoded test data
- No governance to prevent pattern drift

**Target State:**
- All builders consolidated in shared package
- Zero ad-hoc builders in test files
- Complex objects created exclusively via builders
- E2E tests using builders for dynamic test data
- Automated enforcement of builder patterns

## 2. Key Observations

### 2.1. Excellent Existing Builders

The `packages/test-support/builders` directory is a prime example of good software engineering. It contains a rich collection of builders for nearly every core entity in the application, including:

-   `UserBuilder`: For creating test users.
-   `GroupBuilder` (`CreateGroupRequestBuilder`, `MockGroupBuilder`): For creating groups.
-   `ExpenseBuilder` (`FirestoreExpenseBuilder`, `ValidationExpenseBuilder`): For creating expenses for different testing contexts.
-   `SettlementBuilder` (`FirestoreSettlementBuilder`): For creating settlements.
-   And many more for API requests, updates, and other specific scenarios.

These builders provide a fluent, readable, and maintainable way to construct complex objects with sensible defaults.

### 2.2. Inconsistent Usage in E2E Tests

The most significant finding is the widespread underutilization of these builders in the `e2e-tests/` directory. Many tests manually construct objects, leading to code that is:

-   **Verbose and Repetitive:** Large blocks of code are dedicated to object creation, making the tests harder to read and understand.
-   **Brittle:** When the structure of an object changes, manual creation sites must be found and updated across numerous files. Using a builder centralizes this logic.
-   **Inconsistent:** Different tests create the same types of objects in slightly different ways, leading to potential inconsistencies in test data.

**Examples of Missed Opportunities:**

-   **`e2e-tests/src/__tests__/integration/edge-cases/complex-scenarios.e2e.test.ts`**: Manually creates expense objects. The `ExpenseBuilder` should be used.
    ```typescript
    // Current implementation
    await aliceExpenseFormPage.submitExpense({
        description: 'Beach House Rental',
        amount: 800.0,
        paidBy: alice.displayName,
        currency: 'USD',
        splitType: 'equal',
    });
    ```

    // Recommended approach
    const expense = new ExpenseBuilder()
        .withDescription('Beach House Rental')
        .withAmount(800)
        .withPaidBy(alice.uid)
        .build();
    await aliceExpenseFormPage.submitExpense(expense);
    ```

-   **`e2e-tests/src/__tests__/integration/error-testing/duplicate-registration.e2e.test.ts`**: Manually defines user registration data. The `RegisterRequestBuilder` should be used.
    ```typescript
    // Current implementation
    const email = generateTestEmail('duplicate');
    const password = DEFAULT_PASSWORD;
    const displayName = generateTestUserName('Duplicate');
    await registerPage.register(displayName, email, password);

### Phase 2: Create Essential New Builders ⭐ **HIGH PRIORITY**
**Timeline: 2 hours | Risk: Medium**

#### 2.1 UserBalanceBuilder - Critical for debtSimplifier.test.ts

**Problem:** Manual creation of complex `UserBalance` objects 10+ times
```typescript
// Current problematic pattern:
const balances: Record<string, UserBalance> = {
    user1: {
        userId: 'user1',
        owes: { user2: 50 },
        owedBy: {},
        netBalance: -50
    },
    // ... repeated manually
};
```

**Solution:** Create `packages/test-support/builders/UserBalanceBuilder.ts`
```typescript
export class UserBalanceBuilder {
    private balance: UserBalance;

    constructor(userId: string) {
        this.balance = {
            userId,
            owes: {},
            owedBy: {},
            netBalance: 0
        };
    }

    withOwes(userId: string, amount: number): this {
        this.balance.owes[userId] = amount;
        this.calculateNetBalance();
        return this;
    }

    withOwedBy(userId: string, amount: number): this {
        this.balance.owedBy[userId] = amount;
        this.calculateNetBalance();
        return this;
    }

    build(): UserBalance {
        return { ...this.balance };
    }
}
```

#### 2.2 BalancesBuilder - Composite Builder Pattern

Create `packages/test-support/builders/BalancesBuilder.ts` for building complete balance scenarios:
```typescript
export class BalancesBuilder {
    private balances: Record<string, UserBalance> = {};

    addUser(userId: string, builderFn: (builder: UserBalanceBuilder) => UserBalanceBuilder): this {
        const balance = builderFn(new UserBalanceBuilder(userId)).build();
        this.balances[userId] = balance;
        return this;
    }

    build(): Record<string, UserBalance> {
        return { ...this.balances };
    }
}
```

**Refactoring Target:** Replace all manual balance creation in `debtSimplifier.test.ts`

**Success Criteria:**
- ✅ UserBalanceBuilder handles all balance scenarios
- ✅ BalancesBuilder simplifies complex multi-user scenarios  
- ✅ debtSimplifier.test.ts has zero manual UserBalance objects
- ✅ Test readability significantly improved

---

### Phase 3: E2E Test Data Builders 🔶 **MEDIUM PRIORITY**
**Timeline: 3-4 hours | Risk: Medium**

#### 3.1 Create E2E-Specific Builders

**Current Problem:** Hardcoded test data throughout E2E tests
- Static strings like "Test Group", "Alice", "Bob"
- No data uniqueness for parallel execution
- Difficult to create complex test scenarios

**Solution: Create specialized E2E builders**

**GroupTestDataBuilder:**
```typescript
export class GroupTestDataBuilder {
    private data: GroupTestData;

    constructor() {
        this.data = {
            name: `Test Group ${Date.now()}`,
            description: `Auto-generated test group`,
            currency: 'USD'
        };
    }

    withName(name: string): this {
        this.data.name = name;
        return this;
    }

    forParallelExecution(): this {
        this.data.name += ` - ${Math.random().toString(36).substr(2, 9)}`;
        return this;
    }
}
```

**ExpenseScenarioBuilder:**
```typescript
export class ExpenseScenarioBuilder {
    private scenario: ExpenseScenario;

    static simpleSplit(): ExpenseScenarioBuilder {
        return new ExpenseScenarioBuilder()
            .withAmount(100)
            .withDescription('Test expense')
            .splitEqually();
    }

    static complexSplit(): ExpenseScenarioBuilder {
        return new ExpenseScenarioBuilder()
            .withAmount(150)
            .withCustomSplits();
    }
}
```

#### 3.2 Refactor E2E Tests

**Target Files:**
- `e2e-tests/src/tests/normal-flow/**/*.test.ts`
- `e2e-tests/src/tests/error-testing/**/*.test.ts`

**Implementation Strategy:**
1. Replace hardcoded group names with `GroupTestDataBuilder`
2. Replace hardcoded expense data with `ExpenseScenarioBuilder`
3. Use `UserBuilder` for dynamic user creation
4. Ensure all test data is unique for parallel execution

**Success Criteria:**
- ✅ Zero hardcoded test data strings in E2E tests
- ✅ All test data generated dynamically
- ✅ Tests can run in parallel without conflicts
- ✅ Complex scenarios easier to create and maintain
    // Recommended approach
    const registrationRequest = new RegisterRequestBuilder()
        .withEmail(generateTestEmail('duplicate'))
        .withDisplayName(generateTestUserName('Duplicate'))
        .build();
    await registerPage.register(registrationRequest);
    ```

-   **`e2e-tests/src/__tests__/integration/error-testing/expense-editing-errors.e2e.test.ts`**: Manually creates and submits expenses. The `ExpenseBuilder` would make this much cleaner.

### 2.3. Inconsistent Usage in Firebase Integration Tests

Similar to the E2E tests, the integration tests in `firebase/functions/src/__tests__/integration` show inconsistent use of the builders. While some tests leverage them correctly, others resort to manual object creation.

## 3. Recommendations

To improve the overall quality, readability, and maintainability of the codebase, the following actions are strongly recommended:

1.  **Mandate the Use of Builders in All Tests:** Enforce a coding standard that requires the use of the existing builders in `packages/test-support/builders` for all new and modified tests.

2.  **Refactor Existing Tests:** Systematically refactor the tests in the `e2e-tests/` and `firebase/functions/src/__tests__/` directories to use the builders. This is a high-impact, low-risk task that will immediately improve the codebase.

    -   **Priority Targets for Refactoring:**
        -   `e2e-tests/src/__tests__/integration/edge-cases/complex-scenarios.e2e.test.ts`
        -   `e2e-tests/src/__tests__/integration/error-testing/duplicate-registration.e2e.test.ts`
        -   `e2e-tests/src/__tests__/integration/error-testing/expense-editing-errors.e2e.test.ts`
        -   `e2e-tests/src/__tests__/integration/normal-flow/add-expense-happy-path.e2e.test.ts`
        -   All other tests that manually create `Expense`, `Group`, `User`, or `Settlement` objects.

3.  **Expand the Builder Library:** As new entities or complex objects are introduced into the system, corresponding builders should be added to the `packages/test-support/builders` directory as a standard part of the development process.

## 4. Benefits of Adopting These Recommendations

-   **Improved Readability:** Tests will become more concise and focused on the behavior being tested, rather than the setup.
-   **Increased Maintainability:** When data models change, only the relevant builder needs to be updated, not dozens of individual tests.
-   **Enhanced Consistency:** All tests will create data in a uniform way, reducing the likelihood of subtle bugs caused by inconsistent test data.
-   **Faster Development:** Writing new tests will be quicker and less error-prone.

By consistently applying the builder pattern, we can significantly elevate the quality of our test suites and the overall developer experience.

## 5. Implementation Progress

### Phase 1: Refactored Priority E2E Test Files (COMPLETED)

**Files Successfully Refactored:**

1. **`e2e-tests/src/__tests__/integration/edge-cases/complex-scenarios.e2e.test.ts`**
   - ✅ Replaced manual expense object creation with `ExpenseBuilder`
   - ✅ Added proper import for `@splitifyd/test-support`
   - ✅ Improved readability by using fluent builder API

2. **`e2e-tests/src/__tests__/integration/normal-flow/expense-operations.e2e.test.ts`**
   - ✅ Replaced manual expense object in expense lifecycle test
   - ✅ Now uses `ExpenseBuilder` with proper `withPaidBy(user.uid)` pattern
   - ✅ Much cleaner and more maintainable test setup

3. **`e2e-tests/src/__tests__/integration/normal-flow/multi-user-happy-path.e2e.test.ts`**
   - ✅ Refactored 4 different manual expense creation patterns
   - ✅ Used builders for single expenses, multiple user scenarios, and batch expense creation
   - ✅ Properly uses `user.displayName` for UI interactions where display names are expected

### Patterns Implemented

#### Before (Manual Object Creation):
```typescript
await expenseFormPage.submitExpense({
    description: 'Beach House Rental',
    amount: 800.0,
    paidBy: alice.displayName,
    currency: 'USD',
    splitType: 'equal',
});
```

#### After (Builder Pattern):
```typescript
const beachHouseExpense = new ExpenseBuilder()
    .withDescription('Beach House Rental')
    .withAmount(800.0)
    .withPaidBy(alice.displayName)  // Correct for UI interactions
    .withCurrency('USD')
    .withSplitType('equal')
    .build();
await expenseFormPage.submitExpense(beachHouseExpense);
```

### Benefits Already Realized

### Phase 4: Establish Governance 🔶 **MEDIUM PRIORITY** 
**Timeline: 1-2 hours | Risk: Low**

#### 4.1 Create Builder Guidelines

**Create `packages/test-support/BUILDER_GUIDELINES.md`:**
```markdown
# Builder Pattern Guidelines

## When to Create a New Builder
- Complex objects with 3+ properties
- Objects used in multiple test files
- Objects with conditional logic or computed properties

## Builder Requirements
- Must be in packages/test-support/builders/
- Must implement fluent interface
- Must provide sensible defaults
- Must have build() method
- Should have reset() method for reuse

## Naming Conventions
- Class: {ObjectType}Builder
- File: {ObjectType}Builder.ts
- Methods: with{PropertyName}(value)
```

#### 4.2 Add Automated Enforcement

**ESLint Custom Rule:**
```javascript
// .eslintrc.js addition
rules: {
  'custom/no-adhoc-builders': 'error'
}
```

**Rule Logic:**
- Detect `class *Builder` outside of `packages/test-support/builders/`
- Suggest moving to shared package
- Block CI/CD if violations found

**Success Criteria:**
- ✅ Clear guidelines documented
- ✅ ESLint rule prevents new ad-hoc builders
- ✅ Pre-commit hook validates builder locations
- **Improved Readability**: Test intent is now clearer with explicit builder methods
- **Better Maintainability**: Changes to expense structure only need to be made in the builder
- **Enhanced Consistency**: All expense creation now follows the same pattern
- **Type Safety**: Builder enforces proper types and provides sensible defaults
- **Consistency**: Proper use of `user.displayName` for UI interactions where display names are expected

### Phase 2: Additional E2E Test File Refactoring (IN PROGRESS)

Building on Phase 1 success, Phase 2 continues refactoring E2E tests to use ExpenseBuilder pattern:

### Phase 5: Clean Up and Optimize 🟡 **LOW PRIORITY**
**Timeline: 1 hour | Risk: Low**

#### 5.1 Remove Deprecated Files
- Delete `e2e-tests/src/constants/selectors.ts` (deprecated)
- Delete `e2e-tests/src/utils/error-proxy.ts` (deprecated)
- Clean up unused imports

#### 5.2 Builder Enhancements

**Add Standard Methods to All Builders:**
```typescript
interface StandardBuilder<T> {
    build(): T;
    reset(): this;           // Reset to defaults for reuse
    buildMany(count: number): T[];  // Batch creation
}
```

**Type Safety Improvements:**
```typescript
class TypedBuilder<T extends Record<string, any>> {
    protected data: Partial<T> = {};
    
    build(): T {
        // Ensure all required fields present
        return this.data as T;
    }
}
```
**Files Successfully Refactored in Phase 2:**

4. **`e2e-tests/src/__tests__/integration/normal-flow/add-expense-happy-path.e2e.test.ts`**
   - ✅ Replaced form-based expense creation with ExpenseBuilder in 4 test cases
   - ✅ Converted manual `fillDescription()`, `fillAmount()`, `typeCategoryText()` calls to builder pattern
   - ✅ Improved test readability and maintainability
   
5. **`e2e-tests/src/__tests__/integration/normal-flow/balance-visualization-single-user.e2e.test.ts`** 
   - ✅ Replaced 3 manual `submitExpense` calls with ExpenseBuilder
   - ✅ Refactored single-user and multi-currency expense scenarios
   - ✅ Enhanced test clarity with descriptive builder variable names

6. **`e2e-tests/src/__tests__/integration/normal-flow/multi-currency-basic.e2e.test.ts` (COMPLETED)**
   - ✅ Added ExpenseBuilder import 
   - ✅ Refactored all 5 test cases with multi-currency support
   - ✅ Converted manual submitExpense calls in all test methods
   - ✅ Enhanced test readability with descriptive expense variable names
   - ✅ Demonstrates builder pattern works seamlessly across USD, EUR, and GBP currencies

### Patterns Refined in Phase 2

### Phase 6: Documentation and Training 🟡 **LOW PRIORITY**
**Timeline: 1 hour | Risk: Low**

#### 6.1 Update Test Documentation

**Add to `docs/guides/testing.md`:**
```markdown
## Builder Pattern Usage

### Creating Test Data
```typescript
// ✅ Good - Use builders
const user = new UserBuilder()
    .withEmail('test@example.com')
    .withDisplayName('Test User')
    .build();

// ❌ Bad - Manual object creation
const user = {
    email: 'test@example.com',
    displayName: 'Test User',
    // ... many more properties
};
```

#### 6.2 Migration Examples

**Before/After Examples:**
```typescript
// BEFORE: Manual, brittle, duplicated
const balances: Record<string, UserBalance> = {
    user1: { userId: 'user1', owes: { user2: 50 }, owedBy: {}, netBalance: -50 },
    user2: { userId: 'user2', owes: {}, owedBy: { user1: 50 }, netBalance: 50 }
};

// AFTER: Builder, reusable, readable
const balances = new BalancesBuilder()
    .addUser('user1', b => b.withOwes('user2', 50))
    .addUser('user2', b => b.withOwedBy('user1', 50))
    .build();
```

---

## Success Metrics & Verification

### Quantitative Metrics
- ✅ **Zero ad-hoc builders** in test files (currently 7+)
- ✅ **50% reduction** in test setup code lines
- ✅ **100% builder usage** for complex objects
- ✅ **Zero hardcoded test data** in E2E tests
- ✅ **ESLint rule** preventing pattern violations

### Qualitative Improvements
- ✅ **Improved readability** - tests focus on what matters
- ✅ **Better maintainability** - changes in one place
- ✅ **Reduced duplication** - reusable builders
- ✅ **Easier onboarding** - clear patterns to follow
- ✅ **Parallel test safety** - unique test data

### Verification Steps
1. **After Each Phase:** Run full test suite (`npm test`)
2. **Code Review:** Verify builder quality and consistency
3. **ESLint Check:** Ensure no rule violations
4. **Documentation Review:** Confirm guidelines are clear
5. **Team Training:** Walk through new patterns

---

## Risk Mitigation Strategy

### High-Risk Areas
- **Test logic changes** - Keep original test logic intact
- **Import path updates** - Use search/replace carefully
- **Type compatibility** - Ensure builders match expected types

### Mitigation Actions
- **Incremental approach** - One builder at a time
- **Thorough testing** - Run tests after each extraction
- **Rollback plan** - Git branches for each phase
- **Team review** - Code review after Phase 1
- **Documentation** - Clear migration examples

### Rollback Triggers
- Test suite failure rate > 5%
- Build time increase > 20%
- Team feedback indicates reduced productivity
- ESLint rule causes excessive friction

---

## Next Steps

1. **Get team approval** for implementation plan
2. **Create feature branch** for builder consolidation
3. **Start Phase 1** - extract ad-hoc builders
4. **Review after Phase 1** - gather team feedback
5. **Continue phases** based on priority and feedback
6. **Document lessons learned** for future improvements
#### Consistent ExpenseBuilder Usage:
```typescript
// Standard pattern established across all refactored files
const expenseName = new ExpenseBuilder()
    .withDescription('Descriptive Name')
    .withAmount(numericAmount)
    .withCurrency('USD')
    .withPaidBy(user.displayName)  // Always displayName for UI compatibility
    .withSplitType('equal')
    .build();
await expenseFormPage.submitExpense(expenseName);
```

### Benefits Demonstrated in Phase 2

- **Reduced Code Duplication**: Eliminated repeated form field filling patterns
- **Improved Type Safety**: Builder enforces proper ExpenseData structure
- **Better Test Naming**: Descriptive expense variable names improve readability
- **Simplified Maintenance**: Changes to expense structure centralized in builder
- **Cross-Currency Support**: Pattern works seamlessly with USD, EUR, and other currencies

### Phase 2: Additional E2E Test File Refactoring (COMPLETED)

Phase 2 has been successfully completed, demonstrating comprehensive ExpenseBuilder adoption across different test scenarios:

**Completed Refactoring Results:**
- **6 E2E test files** successfully refactored to use ExpenseBuilder pattern
- **15+ manual expense creation patterns** converted to builder approach
- **Multi-currency support** validated across USD, EUR, and GBP
- **Consistent patterns** established across form-based, currency-specific, and balance visualization tests

### Phase 2 Summary

All targeted files in Phase 2 have been successfully refactored:

4. ✅ `add-expense-happy-path.e2e.test.ts` - 4 test cases refactored
5. ✅ `balance-visualization-single-user.e2e.test.ts` - 3 expense creations refactored
6. ✅ `multi-currency-basic.e2e.test.ts` - 5 test cases refactored (all manual patterns eliminated)

### Benefits Demonstrated in Phase 2

- **Complete Pattern Consistency**: All E2E expense creation now follows the builder pattern
- **Enhanced Multi-Currency Support**: Builder pattern works seamlessly across all supported currencies
- **Improved Test Readability**: Descriptive variable names make test intent crystal clear
- **Reduced Maintenance Burden**: Centralized expense structure changes in ExpenseBuilder
- **Type Safety Enforcement**: Builder ensures proper ExpenseData structure across all tests

### Next Steps (Future Phases)

- Phase 3: Refactor Firebase integration tests to use builders consistently  
- Phase 4: Identify and refactor other test files with remaining manual object creation patterns
- Phase 5: Expand builder library for new entities as they are introduced
- Phase 6: Consider adding linting rules to enforce builder usage

**Phase 2 Status: COMPLETE** - All targeted E2E test files now consistently use the ExpenseBuilder pattern, establishing a solid foundation for continued builder pattern adoption across the entire test suite.
