# Task: Refactor PerformanceMetricsCollector for Bounded Memory Usage

## 1. Overview

The current implementation of `PerformanceMetricsCollector` causes a memory leak in long-running environments like the Firebase Emulator. This leads to performance gradually degrading over time as the service uses more memory and CPU for background processing.

The root causes are:
1.  The primary `metrics` map, which stores all operation names, is never cleared and grows indefinitely.
2.  The arrays holding individual metrics for each operation, while capped, use an inefficient `push`/`shift` pattern for management.

This task is to refactor the collector to use bounded, memory-efficient data structures, as suggested by the user.

## 2. Proposed Solution

We will implement two key changes to make the collector memory-safe.

### 2.1. Implement a Bounded Circular Array for Metrics

Instead of using `Array.push()` and `Array.shift()` to manage the list of the last 1000 metrics, we will adopt a more efficient circular buffer pattern. This avoids the performance cost of re-indexing the array on every `shift()` operation.

The data structure for each operation will be modified to hold a fixed-size array and a cursor:

```typescript
// The new structure for each entry in the metrics map
interface OperationMetricBuffer {
    metrics: OperationMetric[];
    cursor: number;
    maxSize: number;
}
```

The `recordMetric` method will be updated to add new metrics by overwriting the oldest entry using the cursor, which wraps around when it reaches the end of the array. This is more performant and has a constant memory footprint.

### 2.2. Prune Stale Operations from the Main Metrics Map

This is the most critical change to fix the primary memory leak. The main `metrics` map must be pruned periodically to remove entries for operations that are no longer occurring.

The `generatePeriodicReport` function will be updated to perform this cleanup:

1.  After a report is generated, the function will iterate through the `metrics` map.
2.  It will check the timestamp of the most recent metric for each operation.
3.  If an operation has not recorded any new metrics in a defined period (e.g., the last 3 reporting intervals), it will be removed from the `metrics` map entirely.

This ensures that the collector's memory footprint does not grow indefinitely with one-off or infrequent operation names.

## 3. Implementation Steps

1.  **Refactor `recordMetric`:**
    *   Update the `metrics` map to store `OperationMetricBuffer` objects.
    *   Change the `recordMetric` logic to use the circular buffer pattern (calculating index from a cursor and overwriting old data).

2.  **Update Aggregation Logic:**
    *   Modify `getOperationStats` and other reporting functions to correctly read from the circular `metrics` array, accounting for the moving cursor and the possibility that the buffer is not yet full.

3.  **Implement Pruning Logic:**
    *   In `generatePeriodicReport`, add the logic to identify and remove stale entries from the main `metrics` map.

4.  **Add a Manual Clear Function:**
    *   Ensure the existing `clearMetrics()` function is robust and can be called from tests to reset the state of the collector, ensuring test isolation.

## 4. Benefits

-   **Fixes Memory Leak:** The collector will now have a bounded memory footprint, eliminating the performance degradation over time in the emulator.
-   **Improves Performance:** The circular buffer is more performant for managing the fixed-size collection of recent metrics than the previous `push`/`shift` approach.
-   **Improves Stability:** Makes the local development environment more stable and predictable for long sessions.
