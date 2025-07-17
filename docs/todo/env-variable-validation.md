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

## Detailed Implementation Plan (2025-07-17)

After analyzing the current `firebase/functions/src/config.ts` file, I can see that:

1. **Current state**: The file has basic validation but no schema-based validation
2. **Environment detection**: Uses `FUNCTIONS_EMULATOR` to detect emulator vs production
3. **Required env vars**: Different variables are required for production vs development

### Step 1: Add zod dependency
- Check if zod is already installed in `firebase/functions/package.json`
- If not, add it as a dependency

### Step 2: Create environment schema
Create a zod schema that validates:
- **Production required**: `GCLOUD_PROJECT`, `CLIENT_API_KEY`, `CLIENT_AUTH_DOMAIN`, `CLIENT_STORAGE_BUCKET`, `CLIENT_MESSAGING_SENDER_ID`, `CLIENT_APP_ID`
- **Production optional**: `CLIENT_MEASUREMENT_ID`
- **Development required**: `FIREBASE_AUTH_EMULATOR_HOST` (when in emulator)
- **Development optional**: `DEV_FORM_EMAIL`, `DEV_FORM_PASSWORD`
- **Always available**: `FUNCTIONS_EMULATOR` (provided by Firebase)

### Step 3: Implement validation
- Replace the current ad-hoc validation with zod schema validation
- Maintain the same fail-fast behavior for invalid configuration
- Keep the same error messages for consistency

### Step 4: Update exports
- Ensure the validated environment variables are properly typed
- Remove any direct `process.env` access after validation

### Benefits of this approach:
1. **Type safety**: Zod provides compile-time and runtime type checking
2. **Clear errors**: Better error messages when validation fails
3. **Documentation**: Schema serves as documentation for required variables
4. **Consistency**: Single source of truth for environment validation

### Minimal implementation:
This can be completed in a single commit since it's a focused refactoring of existing validation logic.