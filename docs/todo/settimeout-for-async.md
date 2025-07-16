# Use of `setTimeout` for Async Operations

## Problem
- **Location**: `firebase/functions/src/index.ts` (lines 36-48)
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

## Detailed Implementation Plan

### 1. Analysis
After reviewing the current implementation in `firebase/functions/src/index.ts`, I found:
- The `setTimeout` is used on lines 39-47 with a hardcoded 1000ms delay
- It attempts to test the Auth emulator connection by calling `admin.auth().listUsers(1)`
- The current approach doesn't guarantee the emulator is ready and could fail if it takes longer than 1 second to start
- The error is logged but the application continues, which might lead to issues later

### 2. Implementation Steps

#### Step 1: Create a utility function for waiting on emulator
- Create a new function `waitForEmulator` that implements exponential backoff
- Place it above the emulator check code in `index.ts`
- The function should:
  - Accept a test function, max retries (default 5), and initial delay (default 1000ms)
  - Use exponential backoff (delay doubles each retry: 1s, 2s, 4s, 8s, 16s)
  - Log each retry attempt with the current delay
  - Return a Promise that resolves when successful or rejects after max retries

#### Step 2: Replace the setTimeout block
- Remove the existing `setTimeout` block (lines 39-47)
- Replace with a call to `waitForEmulator`
- Since this is initialization code, we should NOT await the promise to avoid blocking app startup
- Instead, handle the promise with `.then()` and `.catch()` to log results

#### Step 3: Improve error handling
- Add more detailed error logging including retry count
- Consider adding the error type to help debug connection issues
- Ensure the app doesn't crash if emulator connection fails (maintain current behavior)

### 3. Code Changes

The implementation will replace lines 36-48 in `index.ts` with:

```typescript
// Test emulator connections when running locally
if (!CONFIG.isProduction && process.env.FUNCTIONS_EMULATOR === 'true') {
  // Helper function to wait for emulator with exponential backoff
  async function waitForEmulator(
    testFn: () => Promise<any>, 
    maxRetries = 5, 
    initialDelay = 1000
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await testFn();
        logger.info('Auth emulator connection successful');
        return;
      } catch (error: any) {
        if (i === maxRetries - 1) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, i);
        logger.info(`Auth emulator not ready, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Test Auth emulator connection without blocking startup
  logger.info('Testing Auth emulator connection');
  waitForEmulator(() => admin.auth().listUsers(1))
    .catch((error: any) => {
      logger.errorWithContext('Auth emulator connection failed after multiple retries', error as Error);
    });
}
```

### 4. Testing Strategy
- Test in local emulator environment
- Verify logs show retry attempts with correct delays
- Test with emulator started before and after the function starts
- Ensure app continues to function even if connection fails

### 5. Risk Assessment
- **Low risk**: This is a non-critical initialization check
- The app will continue to function even if this check fails
- The change only affects local development (emulator mode)
- No production impact since it's guarded by `!CONFIG.isProduction`