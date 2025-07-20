# Backend Issue: Distributed Rate Limiting

## Issue Description

The current in-memory rate limiter is not effective in a distributed serverless environment like Firebase Functions.

## Recommendation

Implement a Firestore-Based Rate Limiter. Replace the in-memory solution with a distributed rate limiter that uses Firestore to store request timestamps. This will ensure that rate limits are enforced correctly across all function instances. Use Firestore Transactions to implement the rate-limiting logic within a Firestore transaction to ensure atomic read/write operations, preventing race conditions.

## Implementation Suggestions

This is a backend (Firebase Functions) issue.

1.  **Firestore Collection for Rate Limiting:**
    *   Create a new Firestore collection (e.g., `rateLimits`) to store rate limit data. Each document in this collection could represent a user or an IP address, and contain timestamps of their recent requests.

2.  **Rate Limiting Logic (Firebase Function Middleware):**
    *   Develop a Firebase Function middleware that checks and updates the rate limit for incoming requests.
    *   **Approach:**
        *   On each request, retrieve the user's (or IP's) rate limit document from Firestore.
        *   Within a Firestore transaction, check if the number of requests within the defined time window exceeds the limit.
        *   If the limit is exceeded, reject the request with a `429 Too Many Requests` status.
        *   If not, add the current request timestamp to the document and prune old timestamps.

    ```typescript
    // Example: firebase/functions/src/middleware/rateLimiter.ts
    import { Request, Response, NextFunction } from 'express';
    import { getFirestore } from 'firebase-admin/firestore';

    const db = getFirestore();
    const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
    const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute

    export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.uid; // Assuming user ID is available from auth middleware
      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const userRef = db.collection('rateLimits').doc(userId);

      try {
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const now = Date.now();
          let requests: number[] = userDoc.exists ? userDoc.data()?.requests || [] : [];

          // Remove old requests outside the window
          requests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);

          if (requests.length >= MAX_REQUESTS_PER_WINDOW) {
            throw new Error('Too Many Requests');
          }

          requests.push(now);
          transaction.set(userRef, { requests });
        });
        next();
      } catch (error: any) {
        if (error.message === 'Too Many Requests') {
          res.status(429).send('Too Many Requests');
        } else {
          console.error('Rate limiter error:', error);
          res.status(500).send('Internal Server Error');
        }
      }
    };
    ```

3.  **Apply Middleware to Functions:**
    *   Integrate this `rateLimiter` middleware into your Firebase Functions, especially for endpoints that are prone to abuse or high traffic.

**Next Steps:**
1.  Implement the Firestore-based rate limiting middleware.
2.  Apply it to relevant Firebase Functions.
3.  Monitor its effectiveness and adjust `RATE_LIMIT_WINDOW_MS` and `MAX_REQUESTS_PER_WINDOW` as needed.
