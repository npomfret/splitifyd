# Unsuitable In-Memory Rate Limiter

## Problem
- **Location**: `firebase/functions/src/auth/middleware.ts`
- **Description**: The `InMemoryRateLimiter` is not suitable for a serverless, distributed environment like Firebase Functions. Each function instance will have its own separate memory, meaning the rate limit will not be enforced correctly across all instances. A user could potentially hit the rate limit on one instance and then immediately make successful requests to other instances.
- **Current vs Expected**:
  - **Current**: A simple, instance-specific in-memory rate limiter.
  - **Expected**: A distributed rate limiting solution that uses a shared state store, like Firestore or Redis, to track requests across all function instances.

## Solution
Implement a distributed rate limiter using Firestore to store request timestamps.

1.  **Create a Firestore Collection**: Designate a collection (e.g., `rate-limit-entries`) to store rate limiting data. Each document could represent a user, and it would store an array of recent request timestamps.
2.  **Refactor `InMemoryRateLimiter`**: Create a new `FirestoreRateLimiter` class.
3.  **Implement `isAllowed`**: The `isAllowed` method would:
    a.  Wrap the logic in a Firestore transaction to ensure atomic reads and writes.
    b.  Read the user's rate limit document.
    c.  Filter out old timestamps.
    d.  If the number of recent timestamps is below the limit, add the new timestamp and allow the request.
    e.  Otherwise, deny the request.

Example `FirestoreRateLimiter`:

```typescript
// In a new file, e.g., firebase/functions/src/services/firestoreRateLimiter.ts
import * as admin from 'firebase-admin';

class FirestoreRateLimiter {
  private readonly collection = admin.firestore().collection('rate-limit-entries');
  // ...

  async isAllowed(userId: string): Promise<boolean> {
    const docRef = this.collection.doc(userId);
    
    return admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      const timestamps = doc.exists ? (doc.data()?.timestamps || []) : [];
      const recentTimestamps = timestamps.filter(time => time > windowStart);
      
      if (recentTimestamps.length >= this.maxRequests) {
        return false;
      }
      
      recentTimestamps.push(now);
      transaction.set(docRef, { timestamps: recentTimestamps });
      return true;
    });
  }
}
```

## Impact
- **Type**: Behavior change (rate limiting will now work correctly).
- **Risk**: Medium (introduces new Firestore read/write operations on every authenticated request, which has cost and performance implications).
- **Complexity**: Moderate
- **Benefit**: High value (fixes a fundamental flaw in the current rate limiting implementation).

## Implementation Notes
- This change will incur additional Firestore costs. The cost is likely to be small but should be considered.
- A cleanup mechanism (e.g., a scheduled function) might be needed to periodically delete old rate limit documents to manage Firestore costs and data size.
- The implementation should be carefully benchmarked to ensure it doesn't add significant latency to requests.
