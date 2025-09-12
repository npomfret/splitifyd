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
    'POST /groups': 10,        // Group creation
    'POST /expenses': 50,      // Expense creation
    'POST /settlements': 20,   // Settlement creation
    'PUT /groups/*': 30,       // Group updates
    'DELETE /*': 10,           // Any delete operations
  },
  
  // Per IP address per minute (for unauthenticated)
  unauthenticated: {
    'POST /auth/*': 5,         // Authentication attempts
    'GET /health': 60,         // Health checks
  },
  
  // Global limits per IP per minute
  global: 200
};
```

#### 4.2.2. Request Size Limits
```javascript
const requestSizeLimits = {
  // Prevent large payloads
  'POST /expenses': '10KB',     // Reasonable for expense data
  'PUT /expenses/*': '10KB',    // Expense updates
  'POST /groups': '5KB',        // Group creation
  'PUT /groups/*': '5KB',       // Group updates
  'PUT /users/profile': '50KB', // Profile with potential image data
  
  // Global fallback
  '*': '1KB'  // Most operations should be small
};
```

#### 4.2.3. Computational Throttling
```javascript
// Expensive operations need special handling
const computationalLimits = {
  // Operations that query large datasets
  'GET /groups/*/expenses': { rate: 10, window: '1m' }, // Group expense lists
  'GET /users/*/groups': { rate: 20, window: '1m' },    // User's groups
  'GET /groups/*/balances': { rate: 5, window: '1m' },  // Balance calculations
  
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
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
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
        maxSize: maxSize
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
          srcIpRanges: ["*"]
      action: "rate_based_ban"
      rateLimitOptions:
        conformAction: "allow"
        exceedAction: "deny_429"
        enforceOnKey: "IP"
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
  errorRate: '> 5% error rate for 10+ minutes'
};
```

### 4.5. Expense-Specific Protections

Given our discussion about unrealistic expense descriptions:

#### 4.5.1. Content Validation
```typescript
const expenseValidation = {
  description: {
    maxLength: 500,        // Reasonable for detailed receipts
    pattern: /^[^<>{}]*$/, // Prevent HTML/script injection
  },
  
  amount: {
    min: 0.01,             // No negative or zero expenses
    max: 10000,            // Reasonable maximum per expense
    precision: 2,          // Standard currency precision
  },
  
  participants: {
    maxCount: 50,          // Reasonable group size limit
  }
};
```

#### 4.5.2. Behavioral Limits
```typescript
const expenseLimits = {
  creation: {
    perUser: { rate: 100, window: '1h' },     // Max 100 expenses per hour
    perGroup: { rate: 500, window: '1h' },    // Max 500 expenses per group per hour
  },
  
  updates: {
    perExpense: { rate: 10, window: '5m' },   // Prevent rapid-fire updates
  },
  
  deletion: {
    perUser: { rate: 20, window: '10m' },     // Limit bulk deletions
  }
};
```

---

## 5. Overall Conclusion

The project currently faces three significant security risks:

1. **Database Security**: Lack of production-grade Firestore security rules
2. **Data Integrity**: Unvalidated write operations bypassing schema enforcement  
3. **HTTP Security**: No rate limiting or request size controls

Comprehensive remediation requires:
- **Strict production security rules** for defense-in-depth
- **Schema validation on all writes** for data integrity
- **HTTP request limiting** for DoS protection and resource management

All three security layers are essential for a production-ready system.
