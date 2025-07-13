# Modernize Environment Variable Loading

## Problem
- **Location**: `firebase/functions/src/config.ts`
- **Description**: The use of `require('dotenv').config()` is a legacy approach for loading environment variables in a TypeScript project. It's better to use a more modern and type-safe method.
- **Current vs Expected**: Currently, the project uses `require('dotenv').config()`. It should use a library like `zod` to validate and parse environment variables, providing type safety and clear error messages.

## Solution
- **Approach**: 
  1. Remove the `require('dotenv').config()` call.
  2. Use `zod` to define a schema for the environment variables.
  3. Parse and validate the environment variables at application startup.
  4. This will provide type safety and ensure that all required environment variables are present and correctly formatted.
- **Code Sample**:
  ```typescript
  import { z } from 'zod';

  const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PROJECT_ID: z.string(),
    CLIENT_API_KEY: z.string(),
    // ... other environment variables
  });

  const env = envSchema.parse(process.env);

  // Now use `env.NODE_ENV`, `env.PROJECT_ID`, etc.
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: High value (improves type safety, robustness, and maintainability)

## Implementation Notes
This change will require adding the `zod` library as a dependency. It will also involve refactoring the `firebase/functions/src/config.ts` file to use the new environment variable parsing logic. This is a good opportunity to centralize all environment variable access and validation in one place.