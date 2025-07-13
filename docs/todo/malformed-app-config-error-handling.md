# Missing Error Handling for Malformed app-config.json

## Problem
- **Location**: `firebase/functions/src/config.ts`
- **Description**: The code that reads `app-config.json` uses `JSON.parse` within a `try...catch` block, but the `catch` block only logs the error and then proceeds with default values. If the `app-config.json` file is present but malformed, this could lead to the application running with an unexpected configuration without a clear failure.
- **Current vs Expected**: Currently, a malformed `app-config.json` results in a logged error and fallback to default config. The application should fail fast in this scenario, as a malformed configuration file is a critical error.

## Solution
- **Approach**: Modify the `catch` block to re-throw the error after logging it, or exit the process. This will prevent the application from starting with a potentially invalid configuration.
- **Code Sample**:
  ```typescript
  try {
    // ... reading and parsing app-config.json ...
  } catch (error) {
    console.error('Error loading app-config.json:', error);
    // Re-throw the error to prevent the application from starting with a bad config
    throw new Error('Failed to load app-config.json. Please check the file for syntax errors.');
  }
  ```

## Impact
- **Type**: Behavior change
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves robustness and prevents silent failures)

## Implementation Notes
Failing fast in this scenario is preferable to running with a default configuration that might not match the developer's intent, especially in a production environment.