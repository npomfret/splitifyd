# Improve Test Readability with the Builder Pattern

**Author:** Gemini
**Date:** 2025-07-18
**Status:** Proposed

## Abstract

This document proposes a refactoring of our test suites to incorporate the Builder pattern for creating complex domain objects. This change will significantly improve test readability, reduce boilerplate code, and make our tests more maintainable.

## Problem

Currently, many of our tests, especially integration and performance tests, involve the manual creation of large, complex objects like `Expense`, `Group`, and `User`. This has several drawbacks:

*   **Poor Readability:** It's difficult to discern which object properties are relevant to a specific test case.
*   **High Maintenance:** A change in an object's structure requires updating every test that manually creates it.
*   **Code Duplication:** Similar object creation logic is repeated across multiple tests.

For example, in `business-logic.test.ts`, a test for a small expense amount looks like this:

```typescript
test('should handle very small amounts with proper precision', async () => {
  const expenseData = {
    groupId: testGroup.id,
    description: 'Small Amount Test',
    amount: 0.01, // 1 cent
    paidBy: users[0].uid,
    splitType: 'equal',
    participants: [users[0].uid, users[1].uid],
    date: new Date().toISOString(),
    category: 'food',
  };
  // ...
});
```

In this test, the only truly relevant field is `amount`. The rest is noise that obscures the test's intent.

## Proposal

I propose we introduce a Builder for each of our core domain models (`User`, `Group`, `Expense`). These builders will provide sensible defaults and a fluent interface for customization.

### Example: `ExpenseBuilder`

Here's a conceptual example of what an `ExpenseBuilder` might look like:

```typescript
class ExpenseBuilder {
  private expense: Partial<Expense> = {
    description: 'Default Expense',
    amount: 100,
    paidBy: 'default-user-id',
    splitType: 'equal',
    participants: ['default-user-id-1', 'default-user-id-2'],
    date: new Date().toISOString(),
    category: 'other',
  };

  withAmount(amount: number): this {
    this.expense.amount = amount;
    return this;
  }

  withDescription(description: string): this {
    this.expense.description = description;
    return this;
  }

  // ... other methods for customization

  build(): Expense {
    // Logic to construct the final, valid Expense object
    return this.expense as Expense;
  }
}
```

With this builder, the previous test becomes much clearer:

```typescript
test('should handle very small amounts with proper precision', async () => {
  const expense = new ExpenseBuilder()
    .withAmount(0.01)
    .build();

  // ...
});
```

This immediately highlights that the `amount` is the key variable in this test.

## Affected Tests

The following test files would benefit most from this refactoring:

*   `firebase/functions/__tests__/integration/business-logic.test.ts`
*   `firebase/functions/__tests__/integration/api.test.ts`
*   `firebase/functions/__tests__/integration/data-validation.test.ts`
*   `firebase/functions/__tests__/integration/user-management.test.ts`
*   `firebase/functions/__tests__/performance/performance-balance.test.ts`
*   `firebase/functions/__tests__/performance/performance-complex.test.ts`
*   `firebase/functions/__tests__/performance/performance-load.test.ts`
*   `firebase/functions/__tests__/debtSimplifier.test.ts`

## Implementation Plan

### Phase 1: Infrastructure Setup
1. **Create a `builders` directory** within `firebase/functions/__tests__/support` to house our new builder classes.
2. **Create index.ts** for clean imports from the builders directory.

### Phase 2: Builder Implementation
3. **Implement `UserBuilder`** - Provides fluent interface for test user creation with sensible defaults.
4. **Implement `GroupBuilder`** - Provides fluent interface for test group creation with default members.
5. **Implement `ExpenseBuilder`** - Provides fluent interface for test expense creation with configurable splits.

### Phase 3: Test Refactoring (Small Commits)
6. **Refactor business-logic.test.ts** - Start with the most complex test file to validate builder patterns.
7. **Submit pull request** for the builders infrastructure and first refactored test file.

### Detailed Implementation Analysis

After examining the codebase, I've identified the following patterns and requirements:

**Current Test Structure:**
- Tests use `ApiDriver` class for HTTP operations
- User objects: `{ uid, email, token, displayName }`
- Group objects: `{ id, name, members[] }`
- Expense objects: `{ id, groupId, description, amount, paidBy, splitType, participants[], splits[], date, category, receiptUrl? }`

**Builder Design Decisions:**
- Builders will integrate with existing `ApiDriver` for actual API calls
- Default values will be realistic test data (not production-like)
- Fluent interface with method chaining
- Each builder will have a `build()` method that returns the constructed object
- For API-dependent builders (Group, Expense), provide both object creation and API integration

**Implementation Approach:**
- Keep builders simple and focused on test readability
- Use TypeScript interfaces from existing code
- Provide factory methods for common test scenarios
- Ensure builders work with existing test patterns

**Benefits Expected:**
- Reduced boilerplate in test files from ~10 lines to ~3 lines per object
- Clearer test intent by highlighting only relevant properties
- Easier maintenance when object structures change
- Consistent test data across all test files

## Benefits

*   **Improved Readability:** Tests will be more concise and easier to understand.
*   **Reduced Maintenance:** Changes to domain objects will only require updates to the builders.
*   **Increased Developer Velocity:** Writing new tests will be faster and less error-prone.

This refactoring represents a significant improvement to our testing infrastructure and will pay dividends in the long run.
