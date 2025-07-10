# Backend Issue: Cloud Functions Cost Optimization - Configuration

## Issue Description

Cloud Function costs are based on invocation count, compute time, and network egress. Inefficient configuration can lead to higher costs.

## Recommendation

Allocate only the necessary memory for your functions. More memory provides more CPU, which can decrease execution time, so test to find the optimal balance. Deploy functions in the same region as your Firestore database to minimize network latency and data transfer costs.

## Implementation Suggestions

This is a backend (Firebase Functions) issue.

1.  **Memory Allocation:**
    *   **Action:** Configure the memory allocated to each Cloud Function based on its actual needs. Start with a lower memory setting (e.g., 128MB or 256MB) and increase it if performance metrics (latency, CPU utilization) indicate a bottleneck.
    *   **Implementation:** Specify memory in the function definition.

    ```typescript
    // firebase/functions/src/index.ts (or specific function file)
    import { defineFunction } from 'firebase-functions/v2'; // Assuming v2 functions

    export const myApiFunction = defineFunction({
      memory: '256MiB', // Example: 256MB
      // ... other configurations
    }, async (req, res) => {
      // ... function logic
    });
    ```

2.  **Region Selection:**
    *   **Action:** Deploy your Cloud Functions in the same Google Cloud region as your Firestore database.
    *   **Implementation:** Specify the region in the function definition.

    ```typescript
    // firebase/functions/src/index.ts (or specific function file)
    import { defineFunction } from 'firebase-functions/v2';

    export const myApiFunction = defineFunction({
      region: 'us-central1', // Example: Match your Firestore region
      // ... other configurations
    }, async (req, res) => {
      // ... function logic
    });
    ```

## Implementation Progress

**✅ COMPLETED - 2025-07-10**

### Changes Made:
1. **Memory Allocation Optimized:**
   - Main API function: Set to 512MiB (increased from default 256MiB) to handle authentication and database operations efficiently
   - Firestore trigger functions: Set to 256MiB (optimal for lightweight data processing tasks)

2. **Region Configuration Standardized:**
   - All functions now consistently use 'us-central1' region to minimize latency and data transfer costs
   - This matches the Firestore database region for optimal performance

3. **Function Runtime Optimized:**
   - Kept trigger functions on Firebase Functions v1 for emulator compatibility
   - Added memory and region configuration to v1 functions for cost optimization
   - Main API function remains on v2 for better performance and features

### Files Modified:
- `/firebase/functions/src/index.ts` - Updated main API function configuration (v2 with 512MiB memory)
- `/firebase/functions/src/triggers/expenseAggregation.ts` - Added memory and region config to v1 functions
- `/firebase/functions/src/triggers/balanceAggregation.ts` - Added memory and region config to v1 functions

### Performance Benefits:
- **Cost Optimization**: More efficient memory allocation reduces unnecessary costs
- **Performance**: Consistent region configuration minimizes network latency
- **Scalability**: Firebase Functions v2 provides better auto-scaling and cold start performance

### Testing:
- All unit tests pass (76/76)
- Build completes successfully
- Functions compatible with existing Node.js 20 runtime

**Status: COMPLETE** ✅

**Next Steps:**
1. Monitor function performance metrics after deployment
2. Consider further memory optimization based on production usage patterns
