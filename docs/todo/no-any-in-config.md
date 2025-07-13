# Use of `any` Type in Configuration

## Problem
- **Location**: `firebase/functions/src/config.ts`
- **Description**: The `appConfig` variable is typed as `any`, which completely bypasses TypeScript's type checking. This can lead to runtime errors and makes the code harder to understand and maintain.
- **Current vs Expected**: Currently, `appConfig` is of type `any`. It should have a well-defined interface or type that describes its shape.

## Solution
- **Approach**: Define an interface or type for the `appConfig` object and use it to type the variable. This will provide type safety and autocompletion, making the code more robust and easier to work with.
- **Code Sample**:
  ```typescript
  interface AppConfig {
    appName: string;
    appDisplayName: string;
    firebaseProjectId: string;
    productionBaseUrl: string;
    apiBaseUrl: string;
  }

  let appConfig: AppConfig;
  try {
    // ... loading and parsing app-config.json ...
    appConfig = JSON.parse(configContent);
  } catch (error) {
    // ... error handling ...
  }
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves type safety and code quality)

## Implementation Notes
This change will make the code more self-documenting and prevent common errors related to incorrect property access.