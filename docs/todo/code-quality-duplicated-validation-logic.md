# Duplicated Validation Logic

## Problem
- **Location**: `firebase/functions/src/auth/validation.ts` and `firebase/functions/src/users/validation.ts`
- **Description**: The Joi schema for `displayName` is duplicated in both the registration validation and the user creation validation. This violates the DRY (Don't Repeat Yourself) principle and means that any change to the display name validation rules must be made in two places.
- **Current vs Expected**:
  - **Current**: The same Joi validation logic for `displayName` is defined in two separate files.
  - **Expected**: The `displayName` validation schema should be defined in a single, shared location and imported where needed.

## Solution
1.  **Create a Shared Validation Schema**: Create a new file, for example `firebase/functions/src/users/validationSchemas.ts`, to store common Joi schemas.
2.  **Define the `displayName` schema**: Move the `displayName` Joi object to this new file and export it.

```typescript
// In a new file, e.g., firebase/functions/src/users/validationSchemas.ts
import * as Joi from 'joi';
import { VALIDATION_LIMITS } from '../constants';

export const displayNameSchema = Joi.string()
    .min(2)
    .max(VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH)
    .pattern(/^[a-zA-Z0-9\s\-_.]+$/)
    .required()
    .messages({
      'string.min': 'Display name must be at least 2 characters',
      'string.max': 'Display name cannot exceed 50 characters',
      'string.pattern.base': 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
      'string.empty': 'Display name is required',
      'any.required': 'Display name is required'
    });
```

3.  **Import and Use the Shared Schema**: Import `displayNameSchema` in `firebase/functions/src/auth/validation.ts` and `firebase/functions/src/users/validation.ts` and use it in the respective schemas.

```typescript
// In firebase/functions/src/auth/validation.ts
import { displayNameSchema } from '../users/validationSchemas'; // Adjust path as needed

const registerSchema = Joi.object({
  email: ...,
  password: ...,
  displayName: displayNameSchema,
});
```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves maintainability and reduces code duplication).

## Implementation Notes
- This is a straightforward refactoring that will make the validation logic easier to manage.
- A new file is suggested, but the schema could also be placed in another existing, logical location if preferred.
