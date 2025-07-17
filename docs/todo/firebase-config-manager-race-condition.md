# Potential Race Conditions in firebase-config-manager.ts

## Problem
- **Location**: `webapp/src/js/firebase-config-manager.ts`
- **Description**: The `FirebaseConfigManager` class has a potential race condition in its `getConfig` method. If `getConfig` is called multiple times in quick succession, it could result in multiple network requests to fetch the configuration, as `this.configPromise` is only set after the first call.
- **Current vs Expected**: Currently, the implementation is not fully robust against concurrent calls. It should be updated to ensure that the configuration is only fetched once.

## Solution
- **Approach**: Refactor the `getConfig` method to be more robust against race conditions. This can be achieved by immediately assigning the promise to `this.configPromise` before awaiting it.
- **Code Sample**:
  ```typescript
  class FirebaseConfigManager {
    private configPromise: Promise<AppConfiguration> | null = null;

    getConfig(): Promise<AppConfiguration> {
      if (!this.configPromise) {
        this.configPromise = this.fetchConfig();
      }
      return this.configPromise;
    }

    private async fetchConfig(): Promise<AppConfiguration> {
      // ... fetch logic ...
    }
  }
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves robustness and prevents unnecessary network requests)

## Implementation Plan

### Step 1: Fix the race condition
- Remove the intermediate `config` property caching since it's redundant with `configPromise`
- Ensure `configPromise` is assigned immediately when starting the fetch operation
- The promise itself will serve as both the lock and the cache

### Step 2: Verify behavior  
- Test concurrent calls to ensure only one network request is made
- Verify that subsequent calls return the cached promise result
- Ensure error handling still works correctly with retries

### Step 3: Update convenience methods
- Ensure `getFormDefaults()` and `getWarningBanner()` continue to work correctly
- They already call `getConfig()` so no changes should be needed

## Implementation Notes
This change will make the `FirebaseConfigManager` more efficient and prevent potential issues related to multiple configuration fetches. The fix is minimal but important for preventing unnecessary network requests in high-concurrency scenarios.