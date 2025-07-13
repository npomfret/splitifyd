# Simplify Configuration Logic

## Problem
- **Location**: `firebase/functions/src/config.ts`
- **Description**: The logic for determining the current environment (production, development, test) and loading configuration is complex and spread across multiple variables and functions. This makes the code difficult to understand and maintain.
- **Current vs Expected**: Currently, the environment is determined by checking multiple environment variables (`NODE_ENV`, `FUNCTIONS_EMULATOR`, `K_SERVICE`). This should be simplified to a single, clear source of truth.

## Solution
- **Approach**: Refactor the configuration loading logic to be more straightforward. The environment should be determined from a single environment variable, such as `NODE_ENV`. The rest of the configuration should be derived from this single source of truth.
- **Code Sample**:
  ```typescript
  const getNodeEnv = () => {
    const env = process.env.NODE_ENV;
    if (env === 'production' || env === 'development' || env === 'test') {
      return env;
    }
    return 'development';
  };

  export const CONFIG = {
    environment: getNodeEnv(),
    isProduction: getNodeEnv() === 'production',
    isDevelopment: getNodeEnv() === 'development',
    isTest: getNodeEnv() === 'test',
    // ... other config
  };
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: Medium impact (improves readability and maintainability)

## Implementation Notes
This change will make the configuration logic much easier to follow. It's a good opportunity to review all the configuration values and ensure they are derived from the environment in a consistent way.