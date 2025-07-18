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

1.  **Create a `builders` directory** within `firebase/functions/__tests__/support` to house our new builder classes.
2.  **Implement `UserBuilder`, `GroupBuilder`, and `ExpenseBuilder`**. These will be the core builders.
3.  **Refactor one test file at a time**, starting with `business-logic.test.ts`, to use the new builders.
4.  **Submit a pull request** for each refactored file to ensure a gradual and reviewable transition.

## Benefits

*   **Improved Readability:** Tests will be more concise and easier to understand.
*   **Reduced Maintenance:** Changes to domain objects will only require updates to the builders.
*   **Increased Developer Velocity:** Writing new tests will be faster and less error-prone.

This refactoring represents a significant improvement to our testing infrastructure and will pay dividends in the long run.
