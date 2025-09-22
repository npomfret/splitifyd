# CRITICAL TASK: Harden Firestore Security & Data Integrity

## 1. Overview

This document covers two critical, related security issues. The first is the lack of strict, production-grade Firestore security rules. The second, discovered during a deep-dive audit, is a systemic lack of data validation before Firestore write operations, creating a significant risk of data corruption.

This report details the status of both issues and provides a comprehensive remediation plan.

---

## 2. Part 1: Production Security Rules

### 2.1. The Problem: Lack of Defense-in-Depth

The current Firestore rules (`firestore.rules`) are intentionally permissive (`allow read, write: if request.auth != null;`) to simplify local development. This is not safe for production, as it places all security enforcement on the backend logic and removes the database's own layer of defense.

### 2.2. Current Status (As of September 2025)

**Status: Not Started**

An audit of the current configuration confirms this task has not been implemented.

1.  **No Production Rules File:** The `firebase/` directory does not contain the recommended `firestore.prod.rules` file.
2.  **`firebase.json` Not Updated:** The configuration file has not been updated with a `targets` block to specify different rules for production.

**Conclusion:** The project is currently configured to use permissive, development-only security rules in all environments. This needs to be remediated urgently.

### 2.3. The Solution: Environment-Specific Rules

1.  **Create `firestore.prod.rules`:** This file must contain strict rules that mirror the backend authorization logic (e.g., only group members can read group data, only expense participants can read expense data, etc.).
2.  **Update `firebase.json`:** Add a `targets` block to the `firestore` configuration to point to the new production rules file for production deployments.
3.  **Update Deployment Workflow:** The production CI/CD pipeline must be updated to deploy the production-specific rules (`firebase deploy --only firestore:rules:prod`).

---

## 3. Part 2: Data Integrity & Write Validation

### 3.1. The Problem: Unguarded Firestore Writes

A deep-dive audit of the entire codebase revealed that **Firestore write operations are not consistently validated against data schemas.** This creates a high risk of data corruption, as malformed or incomplete data can be written to the database, both from the API and from internal developer actions.

### 3.2. Key Findings

#### Finding 1: Architectural Flaw in `FirestoreWriter`

The `FirestoreWriter` service is the ideal place to enforce data validation. While it correctly uses Zod schemas for `create` methods, it **fails to perform any validation for `update` methods**. Methods like `updateUser` and `updateGroup` blindly accept a partial `updates` object and write it to the database. This is a major vulnerability.

#### Finding 2: Widespread Bypassing of the Encapsulation Layer

Multiple services and utilities bypass the `FirestoreWriter` entirely and call `getFirestore().collection(...).update()` or `.set()` directly. These direct writes have no schema validation.

**Unguarded Write Operations Found In:**

- **`services/GroupMemberService.ts`**: Performs direct `.update()` calls to update group timestamps.
- **`services/UserPolicyService.ts`**: Directly updates user documents and creates its own batches.
- **`services/PolicyService.ts`**: Still contains a private `policiesCollection` and calls `.update()` and `.set()` on it directly.
- **`scheduled/cleanup.ts`**: Uses `getFirestore()` to create batches and add metrics directly.
- **`test-pool/TestUserPoolService.ts`**: Contains numerous direct `.set()` and `.update()` calls.
- **`user-management/assign-theme-color.ts`**: Uses a direct `transaction.set()` call.
- **`utils/optimistic-locking.ts`**: Contains direct `transaction.update()` calls.

### 3.3. The Solution: Enforce Schema Validation on All Writes

1.  **Harden the `FirestoreWriter` (Highest Priority):**
    - Modify every `update` method in `IFirestoreWriter` and `FirestoreWriter.ts`.
    - These methods must fetch the existing document, merge the requested updates with the existing data, and then validate the _entire resulting object_ against the relevant Zod schema (e.g., `UserDocumentSchema`, `GroupDocumentSchema`) before performing the write.
    - The `updateUserNotification` method's special case for `FieldValue` operations must be re-evaluated and made safe.

2.  **Eliminate All Direct Writes:**
    - Systematically refactor every file identified in this audit.
    - Replace all direct `.set()`, `.update()`, and `.add()` calls with the appropriate (and newly hardened) method from the `FirestoreWriter` service.
    - Ensure all services and functions receive the `FirestoreWriter` via dependency injection.

---

## 4. Part 3: HTTP Request Limiting & Rate Limiting

### 4.1. The Problem: Unlimited Request Volume & Size

The current system lacks comprehensive protection against HTTP-based attacks including:

- **Denial of Service (DoS)** - No rate limiting on API endpoints
- **Resource exhaustion** - No request size limits beyond basic middleware
- **Abuse of expensive operations** - No throttling on computationally expensive endpoints
- **Data extraction attacks** - No limits on bulk data retrieval

### 4.2. Recommended HTTP Request Limiting Strategies

#### 4.2.1. Rate Limiting by User/IP

```javascript
// Implement in middleware or Cloud Functions
const rateLimits = {
    // Per authenticated user per minute
    authenticated: {
        'POST /groups': 10, // Group creation
        'POST /expenses': 50, // Expense creation
        'POST /settlements': 20, // Settlement creation
        'PUT /groups/*': 30, // Group updates
        'DELETE /*': 10, // Any delete operations
    },

    // Per IP address per minute (for unauthenticated)
    unauthenticated: {
        'POST /auth/*': 5, // Authentication attempts
        'GET /health': 60, // Health checks
    },

    // Global limits per IP per minute
    global: 200,
};
```

#### 4.2.2. Request Size Limits

```javascript
const requestSizeLimits = {
    // Prevent large payloads
    'POST /expenses': '10KB', // Reasonable for expense data
    'PUT /expenses/*': '10KB', // Expense updates
    'POST /groups': '5KB', // Group creation
    'PUT /groups/*': '5KB', // Group updates
    'PUT /users/profile': '50KB', // Profile with potential image data

    // Global fallback
    '*': '1KB', // Most operations should be small
};
```

#### 4.2.3. Computational Throttling

```javascript
// Expensive operations need special handling
const computationalLimits = {
    // Operations that query large datasets
    'GET /groups/*/expenses': { rate: 10, window: '1m' }, // Group expense lists
    'GET /users/*/groups': { rate: 20, window: '1m' }, // User's groups
    'GET /groups/*/balances': { rate: 5, window: '1m' }, // Balance calculations

    // Bulk operations
    'POST /groups/*/expenses/bulk': { rate: 2, window: '5m' },
    'DELETE /groups/*': { rate: 1, window: '10m' }, // Group deletion is expensive
};
```

### 4.3. Implementation Recommendations

#### 4.3.1. Firebase Functions Approach

```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

const rateLimiter = new RateLimiterMemory({
    keySchema: 'ip',
    points: 100, // Requests
    duration: 60, // Per 60 seconds
});

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const key = req.ip || 'unknown';
        await rateLimiter.consume(key);
        next();
    } catch (rejRes) {
        res.status(429).json({
            error: 'Too Many Requests',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000),
        });
    }
};
```

#### 4.3.2. Request Size Validation

```typescript
export const validateRequestSize = (maxSize: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const contentLength = req.get('content-length');
        const maxBytes = parseSize(maxSize); // e.g., '10KB' -> 10240

        if (contentLength && parseInt(contentLength) > maxBytes) {
            return res.status(413).json({
                error: 'Request Entity Too Large',
                maxSize: maxSize,
            });
        }
        next();
    };
};
```

#### 4.3.3. Cloud Armor Integration (GCP)

```yaml
# For production deployments
securityPolicy:
    rules:
        - priority: 1000
          match:
              versionedExpr: SRC_IPS_V1
              config:
                  srcIpRanges: ['*']
          action: 'rate_based_ban'
          rateLimitOptions:
              conformAction: 'allow'
              exceedAction: 'deny_429'
              enforceOnKey: 'IP'
              rateLimitThreshold:
                  count: 1000
                  intervalSec: 60
```

### 4.4. Monitoring & Alerting

#### 4.4.1. Key Metrics to Track

- **Request rate per endpoint** - Identify abuse patterns
- **Request size distribution** - Detect unusually large payloads
- **Rate limit violations** - Track blocked requests
- **Response time percentiles** - Identify performance degradation
- **Error rates by status code** - Monitor 429 (rate limited) responses

#### 4.4.2. Alert Conditions

```typescript
const alertThresholds = {
    // Unusual traffic patterns
    requestSpike: 'requests > 5x normal for 5+ minutes',
    largePayout: 'request size > 100KB',

    // Security concerns
    rateLimitViolations: '> 100 rate limit hits from single IP in 1 minute',
    suspiciousPatterns: 'Sequential expensive operations from same user',

    // Performance impact
    responseTime: '95th percentile > 2 seconds for 5+ minutes',
    errorRate: '> 5% error rate for 10+ minutes',
};
```

### 4.5. Expense-Specific Protections

Given our discussion about unrealistic expense descriptions:

#### 4.5.1. Content Validation

```typescript
const expenseValidation = {
    description: {
        maxLength: 500, // Reasonable for detailed receipts
        pattern: /^[^<>{}]*$/, // Prevent HTML/script injection
    },

    amount: {
        min: 0.01, // No negative or zero expenses
        max: 10000, // Reasonable maximum per expense
        precision: 2, // Standard currency precision
    },

    participants: {
        maxCount: 50, // Reasonable group size limit
    },
};
```

#### 4.5.2. Behavioral Limits

```typescript
const expenseLimits = {
    creation: {
        perUser: { rate: 100, window: '1h' }, // Max 100 expenses per hour
        perGroup: { rate: 500, window: '1h' }, // Max 500 expenses per group per hour
    },

    updates: {
        perExpense: { rate: 10, window: '5m' }, // Prevent rapid-fire updates
    },

    deletion: {
        perUser: { rate: 20, window: '10m' }, // Limit bulk deletions
    },
};
```

---

## 5. Implementation Plan

### Status: **IMPLEMENTATION STARTED** (September 2025)

The implementation has been broken down into **smaller, independently committable steps** that won't break the application. The approach prioritizes safety and allows for gradual deployment.

### **Phase 1: Schema Validation for FirestoreWriter Updates** ✅ **PRIORITY 1**
*Goal: Add validation without breaking existing functionality*

**Step 1.1: Add validation helper methods to FirestoreWriter**
- ✅ **Status: Ready to implement**
- Create private helper methods for fetching and merging document data
- Add schema validation utilities that handle FieldValue operations
- No breaking changes - just adding new methods

**Step 1.2: Enhance update methods with validation (backwards compatible)**
- ✅ **Status: Ready to implement**
- Update `updateUser()` to fetch, merge, validate, then write
- Update `updateGroup()` to fetch, merge, validate, then write
- Update `updateExpense()` to fetch, merge, validate, then write
- Update `updateSettlement()` to fetch, merge, validate, then write
- Keep existing behavior for FieldValue operations
- Add comprehensive error logging

**Step 1.3: Add validation tests**
- Add unit tests for all enhanced update methods
- Verify validation works correctly
- Verify FieldValue operations still work

### **Phase 2: HTTP Request Limiting** ✅ **PRIORITY 2**
*Goal: Add rate limiting without breaking existing functionality*

**Step 2.1: Create rate limiting infrastructure**
- Add rate-limiter-flexible package
- Create rate limiting middleware module
- Create request size validation middleware
- Configure but don't apply yet

**Step 2.2: Apply rate limiting progressively**
- Start with non-critical endpoints (health checks)
- Add to authentication endpoints
- Gradually roll out to data endpoints
- Monitor and adjust limits based on usage

**Step 2.3: Add monitoring and metrics**
- Log rate limit violations
- Track request patterns
- Set up alerting thresholds

### **Phase 3: Production Firestore Security Rules** ⚠️ **PRIORITY 3**
*Goal: Create production rules without affecting development*

**Step 3.1: Create production security rules file**
- Create `firestore.prod.rules` with strict rules
- Mirror backend authorization logic
- Test rules in Firebase emulator

**Step 3.2: Update deployment configuration**
- Modify `firebase.template.json` for environment-specific rules
- Update CI/CD pipeline to deploy production rules
- Keep development rules permissive

**Step 3.3: Add rules testing**
- Create comprehensive test suite for security rules
- Verify all access patterns work correctly
- Document rule requirements

### **Phase 4: Eliminate Direct Firestore Writes** ⚠️ **PRIORITY 4**
*Goal: Replace direct writes with FirestoreWriter calls*

**Step 4.1: Audit and list all direct write locations**
- ✅ **Status: COMPLETED** - Audit found direct writes are minimal:
  - `services/GroupService.ts` (transaction writes)
  - `test/policy-handlers.ts` (test code)
  - `__tests__/integration/groups-management-consolidated.test.ts` (test code)

**Step 4.2: Migrate service-level direct writes**
- Update GroupService transaction writes
- Update any remaining service direct writes
- Ensure all use FirestoreWriter methods

**Step 4.3: Migrate test and utility direct writes**
- Update test helpers to use FirestoreWriter
- Update utility functions
- Clean up any remaining direct writes

### **Implementation Order & Safety**

**✅ Safe to implement immediately (no breaking changes):**
- Phase 1 (Steps 1-3): Schema validation enhancements
- Phase 2 (Steps 4-6): HTTP rate limiting
- Phase 3, Step 1: Create production rules file

**⚠️ Requires careful testing:**
- Phase 3, Steps 2-3: Deploy production rules
- Phase 4: Migrate direct writes

### **Key Benefits of This Approach:**
1. ✅ Each step can be committed independently
2. ✅ No breaking changes in early phases
3. ✅ Validation is added progressively
4. ✅ Rate limiting can be tuned without breaking the app
5. ✅ Production rules don't affect development
6. ✅ Direct write migration can be done gradually

### **Audit Update:**
Recent codebase audit (September 2025) revealed that the direct Firestore write issue is **less severe than initially thought**. Most writes already go through FirestoreWriter. Only a few locations need migration:
- Service-level transaction writes (minimal)
- Test code (acceptable for now)
- Utility functions (low risk)

---

## 6. Overall Conclusion

The project currently faces three significant security risks:

1. **Database Security**: Lack of production-grade Firestore security rules
2. **Data Integrity**: Unvalidated write operations bypassing schema enforcement
3. **HTTP Security**: No rate limiting or request size controls

**Implementation Status:** The comprehensive remediation plan is **actively being implemented** using a phased approach that prioritizes safety and allows for gradual deployment.

**Next Action:** Start with Phase 1 (adding schema validation to FirestoreWriter update methods) as it provides immediate data integrity benefits without any breaking changes.
