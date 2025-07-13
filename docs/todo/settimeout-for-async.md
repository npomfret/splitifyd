# Use of `setTimeout` for Async Operations

## Problem
- **Location**: `firebase/functions/src/index.ts`
- **Description**: The code uses `setTimeout` to delay the execution of an `async` function that tests the Auth emulator connection. This is not an ideal way to handle async operations, as it can lead to unpredictable behavior and make the code harder to reason about. It also doesn't guarantee that the emulator is actually ready when the check is performed.
- **Current vs Expected**: Currently, a fixed timeout is used. A better approach would be to use a more robust polling mechanism with exponential backoff to check if the emulator is ready before proceeding.

## Solution
- **Approach**: Replace the `setTimeout` with a polling function that repeatedly tries to connect to the Auth emulator until it succeeds or a timeout is reached. This function should use exponential backoff to avoid overwhelming the emulator with requests.
- **Code Sample**:
  ```typescript
  async function waitForEmulator(testFn: () => Promise<any>, maxRetries = 5, initialDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await testFn();
        logger.info('Emulator connection successful.');
        return;
      } catch (error) {
        const delay = initialDelay * Math.pow(2, i);
        logger.warn(`Emulator connection failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    logger.error('Emulator connection failed after multiple retries.');
  }

  // In index.ts
  if (!CONFIG.isProduction && process.env.FUNCTIONS_EMULATOR === 'true') {
    waitForEmulator(() => admin.auth().listUsers(1));
  }
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: Medium impact (improves the reliability of the emulator connection check)

## Implementation Notes
This change will make the emulator startup process more robust and prevent the application from trying to connect to the emulator before it's ready.