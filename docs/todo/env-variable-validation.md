# Lack of Environment Variable Validation

## Problem
- **Location**: `firebase/functions/src/config.ts`
- **Description**: The code accesses environment variables directly from `process.env` without proper validation. This can lead to runtime errors if an environment variable is missing or has an unexpected type or format.
- **Current vs Expected**: Currently, there is minimal validation of environment variables. The application should use a library like `zod` to define a schema for environment variables and validate them at startup.

## Solution
- **Approach**: Use `zod` to define a schema for all expected environment variables. This schema should specify the type of each variable (e.g., string, number, enum) and any other constraints (e.g., min/max length, format). The application should then parse and validate `process.env` against this schema at startup, failing fast if any validation errors occur.
- **Code Sample**:
  ```typescript
  import { z } from 'zod';

  const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PROJECT_ID: z.string().min(1),
    CLIENT_API_KEY: z.string().min(1),
    EMULATOR_AUTH_PORT: z.coerce.number().int().positive().optional(),
    // ... other variables
  });

  try {
    const env = envSchema.parse(process.env);
    // Use `env` for configuration
  } catch (error) {
    console.error('Invalid environment variables:', error.errors);
    process.exit(1);
  }
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: High value (improves robustness, type safety, and developer experience)

## Implementation Notes
This change will make the application more resilient to configuration errors and provide clear, actionable error messages when environment variables are missing or invalid. It also serves as a form of documentation for the required environment variables.