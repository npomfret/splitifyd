# Unhandled Promise Rejections in start-with-data.js

## Problem
- **Location**: `firebase/scripts/start-with-data.js`
- **Description**: The script uses `setTimeout` with `async` functions, which can lead to unhandled promise rejections if any of the promises within the `async` function fail. This can cause the script to terminate unexpectedly or behave unpredictably.
- **Current vs Expected**: Currently, there is no explicit handling for promise rejections within the `setTimeout` callback. The script should have a top-level `.catch()` block to handle any potential errors.

## Solution
- **Approach**: Wrap the `async` function inside the `setTimeout` with a `.catch()` block to log any errors that occur. This will prevent unhandled promise rejections and provide better error reporting.
- **Code Sample**:
  ```javascript
  setTimeout(async () => {
    // ... script logic ...
  }.catch(error => {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }), 5000);
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves robustness and error handling of the script)

## Implementation Notes
This change will make the script more resilient to errors and prevent it from crashing due to unhandled promise rejections.

## Implementation Plan

### Analysis
After examining `firebase/scripts/start-with-data.ts`:
- ✅ Issue confirmed: `setTimeout` with async function on line 94-142 has no top-level error handling
- ✅ Current code has local try/catch around test data generation (lines 135-141)
- ✅ But any errors in the async function outside the test data generation would be unhandled
- ✅ The file is TypeScript (.ts), not JavaScript (.js) as mentioned in the task description

### Current Risk Areas (lines that could throw unhandled errors):
1. `checkApiReady()` calls (line 121) - could throw if http request fails unexpectedly
2. `generateTestData()` is already wrapped in try/catch (lines 135-141) ✅
3. Any async/await operations in the while loops could throw
4. The async function itself could have uncaught promise rejections

### Solution
Wrap the entire async function with a `.catch()` handler to ensure all promise rejections are caught and logged properly.

### Implementation Steps
1. Wrap the async function in the setTimeout with a `.catch()` handler
2. Ensure the catch handler logs the error and exits gracefully
3. Follow the project's error handling patterns (fail fast, clear error messages)
4. Test with both successful and error scenarios

### Code Change
```typescript
setTimeout(async () => {
  // ... existing async function code ...
}).catch(error => {
  console.error('❌ An unexpected error occurred during emulator startup:', error);
  process.exit(1);
}), 5000);
```

### Single Commit Strategy
This is a simple, focused change that:
1. Addresses a specific error handling gap
2. Improves robustness without changing functionality
3. Follows project patterns for error handling
4. Can be tested immediately
