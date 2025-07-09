# Inconsistent Validation Implementation

## Problem
- **Location**: `firebase/functions/src/expenses/validation.ts`
- **Description**: This file uses manual, imperative validation (a series of `if` statements) to validate the expense creation and update payloads. However, other parts of the application, like `auth/validation.ts`, use the Joi library for declarative and more robust schema-based validation. This inconsistency makes the code harder to read, maintain, and extend.
- **Current vs Expected**:
  - **Current**: Manual validation logic for expenses.
  - **Expected**: Use Joi to define expense schemas, consistent with the rest of the project.

## Solution
Refactor `firebase/functions/src/expenses/validation.ts` to use Joi for validation.

1.  **Define Joi Schemas**: Create `createExpenseSchema` and `updateExpenseSchema` using Joi.
2.  **Refactor Validation Functions**: Replace the manual checks in `validateCreateExpense` and `validateUpdateExpense` with `schema.validate()`.
3.  **Error Handling**: Use the error object from Joi's validation result to provide detailed error messages, similar to how it's done in `auth/validation.ts`.

Example of a Joi schema for expense creation:

```typescript
// In firebase/functions/src/expenses/validation.ts
import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';

const EXPENSE_CATEGORIES = [...];

const expenseSplitSchema = Joi.object({
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  percentage: Joi.number().min(0).max(100).optional()
});

const createExpenseSchema = Joi.object({
  groupId: Joi.string().required(),
  paidBy: Joi.string().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().valid(...EXPENSE_CATEGORIES).required(),
  date: Joi.date().iso().required(),
  splitType: Joi.string().valid('equal', 'exact', 'percentage').required(),
  participants: Joi.array().items(Joi.string()).min(1).required(),
  splits: Joi.array().items(expenseSplitSchema).optional(),
  receiptUrl: Joi.string().uri().optional()
});

export const validateCreateExpense = (body: any): CreateExpenseRequest => {
  const { error, value } = createExpenseSchema.validate(body, { abortEarly: false });
  if (error) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', error.details);
  }
  // Additional logic for split validation can be added here
  return value;
};
```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: Medium impact (improves code quality, consistency, and maintainability).

## Implementation Notes
- This change will make the expense validation logic much cleaner and more aligned with project conventions.
- The custom logic for validating split totals based on `splitType` will still be needed but can be done more cleanly after the main schema validation passes.
