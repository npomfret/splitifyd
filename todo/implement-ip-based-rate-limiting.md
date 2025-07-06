# Implement Proper IP-Based Rate Limiting

**Problem**: The `rateLimitByIP` middleware in `firebase/functions/src/middleware/validation.ts` is currently a placeholder and does not implement any actual rate limiting logic. It only extracts the IP address and attaches it to the request headers. This leaves unauthenticated endpoints (e.g., `/login`, `/register`, `/config`, `/health`) vulnerable to abuse, brute-force attacks, and denial-of-service (DoS) attacks, as there's no mechanism to control the rate of incoming requests from a single IP address.

**File**: `firebase/functions/src/middleware/validation.ts`

**Suggested Solution**:
1. **Implement a Distributed Rate Limiter**: Replace the placeholder with a robust, distributed rate limiting solution. Given Firebase Cloud Functions' stateless nature, an in-memory solution is insufficient. Good options include:
    - **Redis**: A dedicated Redis instance can serve as a centralized store for rate limit counters.
    - **Firestore-based solution**: Implement a rate limiter using Firestore documents to store and increment counters, ensuring state is shared across function instances.
2. **Configure Rate Limits**: Define appropriate rate limits for unauthenticated endpoints (e.g., 10 requests per minute per IP for login attempts, higher for static config fetches). These limits should be configurable.
3. **Return `429 Too Many Requests`**: When a client exceeds the rate limit, the middleware should immediately return an `HTTP_STATUS.TOO_MANY_REQUESTS` (429) response, optionally including `Retry-After` headers.

**Behavior Change**: This is a behavior change. Unauthenticated endpoints will now be rate-limited. While this is a security improvement, it might affect the user experience for legitimate users who make too many requests in a short period. Clear error messages should be provided.

**Risk**: Medium. This change requires implementing a new distributed rate limiting solution, which can be complex and needs careful consideration of concurrency and consistency. Incorrect implementation could lead to false positives or negatives.

**Complexity**: High. This change requires implementing a new distributed rate limiting solution, which can be a significant undertaking, especially if a new external service like Redis is introduced.

**Benefit**: High. This change will significantly improve the security and reliability of the application by protecting unauthenticated endpoints from abuse, brute-force attacks, and denial-of-service attempts, enhancing the overall resilience of the system.