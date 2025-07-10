# API Data Validation and Hardening Plan

**Status:** Proposed

## Objective

This document outlines a plan to implement a robust, schema-driven validation layer for all incoming data to our API. The primary goal is to ensure data integrity, enhance security, and prevent invalid or malicious data from being processed and stored in our database.

## Guiding Principles

- **Default Deny:** All incoming data will be rejected by default unless it strictly conforms to a predefined schema.
- **Single Source of Truth:** We will use a single, authoritative schema for each data model, and this schema will be the basis for both validation and TypeScript type generation.
- **Fail Fast:** Validation will occur at the earliest possible stage, typically in middleware, before the request hits the main business logic.
- **Immutability:** The validation process will produce a new, validated and typed data object, leaving the original request body untouched.

## Proposed Library: Zod

After researching several options, we propose using **Zod**. It is a modern, TypeScript-first schema declaration and validation library with several key advantages:

- **Excellent TypeScript Integration:** Zod schemas can be used to infer TypeScript types, eliminating the need to maintain separate type definitions and validation rules.
- **Expressive and Powerful:** It provides a rich, fluent API for defining complex validation rules.
- **Lightweight and Performant:** It has no dependencies and is highly optimized.
- **Active Community:** Zod is widely adopted and has a vibrant community, ensuring good support and a rich ecosystem of integrations.

## Implementation Plan

### Phase 1: Define Core Schemas

1.  **Install Zod:** Add Zod as a dependency to the `firebase/functions` project.
2.  **Create Schema Files:** For each of our core data models (e.g., `User`, `Group`, `Expense`), we will create a corresponding Zod schema definition file in `firebase/functions/src/models/`.
3.  **Define Schemas:** Define the schemas with appropriate validation rules (e.g., string lengths, numeric ranges, email format).

### Phase 2: Create Validation Middleware

1.  **Develop Middleware:** Create a generic validation middleware in `firebase/functions/src/middleware/validation.ts`.
2.  **Functionality:** This middleware will:
    -   Accept a Zod schema as an argument.
    -   Execute `schema.safeParse(req.body)` on the incoming request body.
    -   If validation fails, it will immediately respond with a `400 Bad Request` and a structured JSON error detailing the validation issues.
    -   If validation succeeds, it will attach the validated (and typed) data to the request object (e.g., `res.locals.validatedData`) and call `next()`.

### Phase 3: Integrate Middleware into API Routes

1.  **Apply Middleware:** Systematically apply the new validation middleware to all API routes that accept a request body (i.e., POST, PUT, and PATCH endpoints).
2.  **Prioritization:** We will start with the most critical and data-sensitive endpoints, such as user registration and expense creation, and progressively roll it out to all other routes.

### Phase 4: Refactor Business Logic

1.  **Use Validated Data:** Refactor the service-layer functions and route handlers to use the validated data from `res.locals.validatedData`.
2.  **Leverage Inferred Types:** Use the inferred TypeScript types from our Zod schemas to ensure full type safety throughout the application, from the API boundary to the database. This will allow us to remove many now-redundant manual checks and type assertions.

## Example: Creating a New Expense

**1. Expense Schema (`firebase/functions/src/models/expense.ts`):**

```typescript
import { z } from 'zod';

export const createExpenseSchema = z.object({
  description: z.string().min(1).max(100),
  amount: z.number().positive(),
  groupId: z.string().uuid(),
  paidBy: z.string().uuid(),
  participants: z.array(z.string().uuid()).min(1),
});

export type CreateExpenseDTO = z.infer<typeof createExpenseSchema>;
```

**2. Validation Middleware (`firebase/functions/src/middleware/validation.ts`):**

```typescript
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validate = (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }

  res.locals.validatedData = result.data;
  return next();
};
```

**3. Route Integration (`firebase/functions/src/expenses/routes.ts`):**

```typescript
import { Router } from 'express';
import { validate } from '../middleware/validation';
import { createExpenseSchema } from '../models/expense';
import { createExpenseHandler } from './handlers';

const router = Router();

router.post('/', validate(createExpenseSchema), createExpenseHandler);

export default router;
```

## Next Steps

- [ ] Gain approval for this plan.
- [ ] Implement a proof-of-concept on a single, non-critical endpoint.
- [ ] Create tickets for the phased rollout described above.
