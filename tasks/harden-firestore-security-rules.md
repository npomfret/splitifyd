# Firebase Security Hardening - Phase 2

**Status**: Phase 1 Complete  | Phase 2 Planning
**Date**: January 2025
**Priority**: Phase 1 achieved 100% validation coverage. Phase 2 focuses on application-layer security gaps.

---

## Phase 1 Summary (Completed September 2025)

 **100% Firestore validation coverage**
 **Production-ready security rules**
 **Transaction validation**
 **Zero direct writes**
 **Comprehensive monitoring**

**Risk reduced from HIGH í LOW** for data layer security.

**See archive section at bottom for Phase 1 details.**

---

## Phase 2: Application-Layer Security Improvements

### Overview

Phase 1 hardened the **data layer** (Firestore validation and security rules).
Phase 2 addresses **application-layer security gaps** identified in January 2025 security audit.

**Risk Assessment**: Current application-layer risk is **MEDIUM** due to:
- No rate limiting (DoS/brute force vulnerability)
- Test endpoints exposed in production
- Information disclosure in health endpoint
- Email enumeration vectors
- Sensitive data potentially logged
- User data duplication issues

---

## High Priority Issues

### 1. Rate Limiting † CRITICAL

**Issue**: No rate limiting implemented - vulnerable to brute force, credential stuffing, and DoS attacks.

**Attack Vectors**:
- Brute force attacks on `/register` endpoint
- Credential stuffing attacks
- API resource exhaustion
- Authentication endpoint abuse

**Current State**:
- Zero rate limiting middleware
- All endpoints accept unlimited requests
- No IP-based throttling
- No user-based request limits

**Recommendation**: Implement rate limiting using `express-rate-limit`

**Files to Modify**:
1. Create `firebase/functions/src/middleware/rate-limiter.ts`
2. Update `firebase/functions/src/index.ts` to apply rate limiters

**Implementation**:

```typescript
// NEW FILE: firebase/functions/src/middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force and credential stuffing attacks
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per IP per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all requests
});

/**
 * Standard rate limiter for general API endpoints
 * Prevents resource exhaustion and DoS attacks
 */
export const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per IP per minute
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Relaxed rate limiter for authenticated endpoints
 * More permissive for logged-in users
 */
export const authenticatedRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute for authenticated users
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
});
```

**Apply in index.ts**:

```typescript
import { authRateLimiter, apiRateLimiter, authenticatedRateLimiter } from './middleware/rate-limiter';

// Auth endpoints - strict rate limiting
app.post('/register', authRateLimiter, asyncHandler(register));

// General API endpoints - moderate rate limiting
app.use('/api', apiRateLimiter);

// Authenticated endpoints - relaxed rate limiting
app.use('/groups', authenticate, authenticatedRateLimiter, ...);
app.use('/expenses', authenticate, authenticatedRateLimiter, ...);
```

**Dependencies**: Add `express-rate-limit` to package.json

**Testing**:
- Unit tests for rate limiter configuration
- Integration tests for enforcement
- Load tests to verify limits don't impact normal usage

**Effort**: Medium (4-6 hours)
**Impact**: High (prevents DoS and brute force attacks)

---

### 2. Test Endpoints Exposed in Production † CRITICAL

**Issue**: Test endpoints accessible in production without environment guards

**Vulnerable Endpoints**:
- `POST /test-pool/borrow` (line 314)
- `POST /test-pool/return` (line 315)
- `POST /test/user/clear-policy-acceptances` (line 319)
- `POST /test/user/promote-to-admin` (line 320)

**Risk**:
- Privilege escalation via `/test/user/promote-to-admin`
- Test user pool manipulation
- Policy acceptance bypass

**Current State**:
```typescript
// firebase/functions/src/index.ts:314-320
app.post('/test-pool/borrow', asyncHandler(borrowTestUser));
app.post('/test-pool/return', asyncHandler(returnTestUser));
app.post('/test/user/clear-policy-acceptances', asyncHandler(testClearPolicyAcceptances));
app.post('/test/user/promote-to-admin', asyncHandler(testPromoteToAdmin));
```

**Recommendation**: Add environment guards

**Implementation**:

```typescript
// firebase/functions/src/index.ts
import { getConfig } from './client-config';

// Only register test endpoints in non-production environments
if (!getConfig().isProduction) {
    // Test pool endpoints (emulator only, no auth required)
    app.post('/test-pool/borrow', asyncHandler(borrowTestUser));
    app.post('/test-pool/return', asyncHandler(returnTestUser));

    // Test user endpoints (dev only, requires auth)
    app.post('/test/user/clear-policy-acceptances', asyncHandler(testClearPolicyAcceptances));
    app.post('/test/user/promote-to-admin', asyncHandler(testPromoteToAdmin));
} else {
    // Return 404 for test endpoints in production
    app.all('/test-pool/*', (req, res) => {
        logger.warn('Test endpoint accessed in production', { path: req.path, ip: req.ip });
        res.status(404).json({ error: 'Not found' });
    });
    app.all('/test/user/*', (req, res) => {
        logger.warn('Test endpoint accessed in production', { path: req.path, ip: req.ip });
        res.status(404).json({ error: 'Not found' });
    });
}
```

**Testing**:
- Verify endpoints work in dev/emulator
- Verify endpoints return 404 in production
- Add integration tests for both environments

**Effort**: Low (1-2 hours)
**Impact**: High (prevents privilege escalation)

---

### 3. User Email Duplication - Data Consistency Issue † HIGH

**Issue**: Email and displayName are stored in both Firebase Auth (authoritative) and Firestore (denormalized copy), creating data consistency risk.

**Discovery**: Line 393 in `UserService2.ts` has a TODO comment:
```typescript
email: userRegistration.email, // todo: this looks like a security issue
```

**Architecture Analysis**:

**Firebase Auth stores** (authoritative):
- email
- password hash
- emailVerified
- displayName
- photoURL

**Firestore `users` collection stores** (duplicated):
- email L (unnecessary duplicate)
- displayName L (unnecessary duplicate)
- role, themeColor, preferences, policy acceptances  (correct usage)

**Problems**:
1. **Data consistency risk**: User changes email in Firebase Auth í Firestore becomes stale
2. **Violates single source of truth**: Email should only exist in Firebase Auth
3. **No queries use email**: Confirmed zero Firestore queries on email field
4. **Schema marked optional**: `user.ts:27` says "Email might be in Auth only" - acknowledging it shouldn't be duplicated
5. **Inconsistent with existing patterns**: Commit `3f16093a` removed similar denormalizations for this exact reason

**Historical Context**:
- Commit `3f16093a` (July 2025): "remove user denormalization patterns from Firebase functions"
- That commit eliminated denormalized user data throughout the codebase
- Email/displayName in Firestore were overlooked

**Current Data Flow**:
```typescript
// All user fetching goes through Firebase Auth FIRST
const userRecord = await this.authService.getUser(userId); // Auth is source of truth
const userData = await this.firestoreReader.getUser(userId); // Enrichment only

// Returns composite with Auth fields taking precedence
return {
    uid: userRecord.uid,
    email: userRecord.email,        // ê From Auth (correct)
    displayName: userRecord.displayName, // ê From Auth (correct)
    role: userData?.role,            // ê From Firestore (correct)
    themeColor: userData?.themeColor, // ê From Firestore (correct)
    // ...
};
```

**Recommendation**: Remove email and displayName from Firestore entirely

**Files to Modify**:
1. `firebase/functions/src/services/UserService2.ts` - Remove from write operations
2. `firebase/functions/src/schemas/user.ts` - Remove from schema
3. `firebase/functions/src/services/firestore/IFirestoreWriter.ts` - Update interface types

**Implementation**:

**Step 1: Remove from user creation**
```typescript
// firebase/functions/src/services/UserService2.ts:389-404
// BEFORE:
const userDoc: Omit<RegisteredUser, 'id' | 'uid' | 'emailVerified'> = {
    email: userRegistration.email, // L REMOVE
    displayName: userRegistration.displayName, // L REMOVE
    photoURL: userRecord.photoURL,
    role: SystemUserRoles.SYSTEM_USER,
    createdAt: now,
    updatedAt: now,
    acceptedPolicies: currentPolicyVersions,
    themeColor: { ... },
};

// AFTER:
const userDoc: Omit<RegisteredUser, 'id' | 'uid' | 'emailVerified' | 'email' | 'displayName'> = {
    // email and displayName stored ONLY in Firebase Auth
    photoURL: userRecord.photoURL,
    role: SystemUserRoles.SYSTEM_USER,
    createdAt: now,
    updatedAt: now,
    acceptedPolicies: currentPolicyVersions,
    themeColor: { ... },
};
```

**Step 2: Remove from profile updates**
```typescript
// firebase/functions/src/services/UserService2.ts:184-225
async updateProfile(userId: string, requestBody: unknown, language: string = 'en'): Promise<RegisteredUser> {
    const validatedData = validateUpdateUserProfile(requestBody, language);

    // Build update object for Firebase Auth ONLY
    const authUpdateData: UpdateRequest = {};
    if (validatedData.displayName !== undefined) {
        authUpdateData.displayName = validatedData.displayName;
    }
    if (validatedData.photoURL !== undefined) {
        authUpdateData.photoURL = validatedData.photoURL === null ? null : validatedData.photoURL;
    }

    // Update Firebase Auth (source of truth for email/displayName)
    await this.authService.updateUser(userId, authUpdateData);

    // Build update object for Firestore (app-specific fields ONLY)
    const firestoreUpdate: any = {};
    // L REMOVE displayName update from Firestore
    // L REMOVE photoURL update from Firestore
    if (validatedData.preferredLanguage !== undefined) {
        firestoreUpdate.preferredLanguage = validatedData.preferredLanguage;
    }

    // Only update Firestore if there are app-specific fields to update
    if (Object.keys(firestoreUpdate).length > 0) {
        await this.firestoreWriter.updateUser(userId, firestoreUpdate);
    }

    return await this.getUser(userId);
}
```

**Step 3: Update schema**
```typescript
// firebase/functions/src/schemas/user.ts:25-42
const BaseUserSchema = z.object({
    // L REMOVE: email: z.string().email().optional(),
    // L REMOVE: displayName: z.string().optional(),
    themeColor: z.union([
        z.string(),
        UserThemeColorSchema,
    ]).optional(),
    preferredLanguage: z.string().optional(),
    role: z.nativeEnum(SystemUserRoles).optional(),
    acceptedPolicies: z.record(z.string(), z.string()).optional(),
    termsAcceptedAt: FirestoreTimestampSchema.optional(),
    cookiePolicyAcceptedAt: FirestoreTimestampSchema.optional(),
    passwordChangedAt: FirestoreTimestampSchema.optional(),
    photoURL: z.string().nullable().optional(), // L REMOVE (managed by Auth)
}).merge(OptionalAuditFieldsSchema);
```

**Step 4: Update interface type**
```typescript
// firebase/functions/src/services/firestore/IFirestoreWriter.ts:66
/**
 * Create a new user document
 * @param userId - The user ID (from Firebase Auth) - becomes the document ID
 * @param userData - The user data to write (app-specific fields only, excluding email/displayName which are stored in Firebase Auth)
 * @returns Write result with document ID
 */
createUser(
    userId: string,
    userData: Omit<RegisteredUser, 'id' | 'uid' | 'emailVerified' | 'email' | 'displayName' | 'photoURL'>
): Promise<WriteResult>;
```

**Migration Strategy**:
- **No migration required** - email field is optional and not queried
- Existing documents with email field will be ignored
- New documents won't include email
- Eventually old documents will be updated and email will be removed naturally

**Benefits**:
 Single source of truth (Firebase Auth owns email/displayName)
 No stale data (user changes propagate immediately)
 Simpler security model (Firestore only stores app-specific data)
 Consistent with existing pattern (matches commit `3f16093a`)
 Reduced storage (less data duplication)
 Clearer separation of concerns (Auth vs App data)

**Testing**:
- Verify user registration still works
- Verify profile updates work (Auth fields vs Firestore fields)
- Verify user fetching returns correct email/displayName from Auth
- Add integration tests for data consistency

**Effort**: Medium (4-6 hours including tests)
**Impact**: High (eliminates data consistency bugs, simplifies architecture)

---

## Medium Priority Issues

### 4. Information Disclosure in /health Endpoint

**Issue**: `/health` endpoint exposes sensitive system information without authentication

**Exposed Information** (lines 157-281 in index.ts):
- All environment variables (line 257) - includes secrets
- Complete file system structure and permissions (line 276-279)
- Memory usage details
- Process uptime and PID
- Node.js version
- Current working directory

**Risk**:
- Attackers can map infrastructure
- Environment variables may contain secrets
- File system info aids in finding vulnerabilities

**Current State**:
```typescript
app.get('/health', async (req, res) => {
    res.json({
        env: process.env, // L ALL environment variables exposed
        filesystem: {    // L File system structure exposed
            currentDirectory: currentDir,
            files: /* all files with permissions */
        },
        memory: { /* detailed memory usage */ },
        // ...
    });
});
```

**Recommendation**: Split into public and admin-only health endpoints

**Implementation**:

```typescript
// Public health check - minimal info, no authentication required
app.get('/health', async (req: express.Request, res: express.Response) => {
    const checks: Record<string, { status: 'healthy' | 'unhealthy' }> = {};

    // Firestore health check
    const appBuilder = getAppBuilder();
    const firestoreWriter = appBuilder.buildFirestoreWriter();
    const firestoreHealthCheck = await firestoreWriter.performHealthCheck();

    checks.firestore = {
        status: firestoreHealthCheck.success ? 'healthy' : 'unhealthy',
    };

    // Auth health check (basic)
    try {
        await appBuilder.buildAuthService().listUsers({ maxResults: 1 });
        checks.auth = { status: 'healthy' };
    } catch (error) {
        checks.auth = { status: 'unhealthy' };
    }

    const overallStatus = Object.values(checks).every(c => c.status === 'healthy')
        ? 'healthy' : 'unhealthy';

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
        status: overallStatus,
        checks,
        timestamp: new Date().toISOString(),
    });
});

// Detailed health endpoint - requires admin authentication
app.get('/health/detailed', authenticateAdmin, async (req, res) => {
    // Sanitize environment variables - remove secrets
    const sensitiveKeys = ['SECRET', 'KEY', 'PASSWORD', 'TOKEN', 'API_KEY', 'PRIVATE'];
    const sanitizedEnv = Object.keys(process.env)
        .filter(key => !sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive)))
        .reduce((obj, key) => ({ ...obj, [key]: process.env[key] }), {});

    // ... include detailed system info with sanitized data
    res.json({
        env: sanitizedEnv, //  Sanitized environment variables
        build: { /* build info */ },
        runtime: { /* uptime, etc */ },
        memory: { /* memory usage */ },
        // L REMOVE filesystem info - security risk
    });
});
```

**Effort**: Low (2-3 hours)
**Impact**: Medium (reduces attack surface)

---

### 5. Email Enumeration Vulnerability

**Issue**: Registration endpoint may reveal whether an email exists based on error messages and response timing.

**Attack Vector**:
- Attacker can enumerate valid user emails
- Different error messages for "email exists" vs "invalid data"
- Response timing differences reveal email existence

**Current State**:
- `auth/email-already-exists` error reveals email is registered
- Fast response for existing emails vs slow response for validation

**Recommendation**: Return generic error messages and implement timing-safe responses

**Implementation**:

```typescript
// firebase/functions/src/services/UserService2.ts
async createUserDirect(userRegistration: UserRegistration): Promise<RegisteredUser> {
    try {
        // Check if user exists (timing-safe)
        const startTime = Date.now();
        const existingUser = await this.authService.getUserByEmail(userRegistration.email);

        if (existingUser) {
            // Add random delay to prevent timing attacks
            const processingTime = Date.now() - startTime;
            const minProcessingTime = 100; // Minimum 100ms
            if (processingTime < minProcessingTime) {
                await new Promise(resolve =>
                    setTimeout(resolve, minProcessingTime - processingTime + Math.random() * 100)
                );
            }

            // Generic error message - don't reveal email exists
            throw Errors.INVALID_INPUT('Registration failed. Please verify your information and try again.');
        }

        // Continue with user creation...
        const userRecord = await this.authService.createUser({ ... });
        // ...
    } catch (error) {
        // Don't expose specific error codes
        if (error?.code === AuthErrors.EMAIL_EXISTS) {
            throw Errors.INVALID_INPUT('Registration failed. Please verify your information and try again.');
        }
        throw error;
    }
}
```

**Additional Hardening**:
- Log registration attempts with IP address
- Implement rate limiting on registration endpoint (see Issue #1)
- Consider CAPTCHA for registration

**Effort**: Low (2-3 hours)
**Impact**: Medium (protects user privacy)

---

### 6. Sensitive Data in Logs

**Issue**: Logger doesn't sanitize sensitive fields (passwords, tokens, API keys)

**Risk**:
- Credentials leaked in logs
- API keys exposed in error logs
- PII logged without sanitization

**Current State**:
```typescript
// firebase/functions/src/utils/contextual-logger.ts:56-62
if (data) {
    Object.keys(data).forEach((key) => {
        if (key !== 'id' && key !== 'uid' && key !== 'correlationId') {
            logData[key] = data[key]; // L No sanitization
        }
    });
}
```

**Recommendation**: Add log sanitization for sensitive fields

**Implementation**:

```typescript
// firebase/functions/src/utils/contextual-logger.ts

class ContextualLoggerImpl implements ContextualLogger {
    // Sensitive field patterns to redact
    private readonly SENSITIVE_PATTERNS = [
        'password',
        'token',
        'apiKey',
        'api_key',
        'secret',
        'authorization',
        'auth',
        'bearer',
        'credential',
        'privateKey',
        'private_key',
        'sessionId',
        'session_id',
    ];

    /**
     * Recursively sanitize sensitive data before logging
     */
    private sanitizeSensitiveData(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeSensitiveData(item));
        }

        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(data)) {
            const keyLower = key.toLowerCase();

            // Check if key matches sensitive pattern
            if (this.SENSITIVE_PATTERNS.some(pattern => keyLower.includes(pattern))) {
                sanitized[key] = '[REDACTED]';
            } else if (value && typeof value === 'object') {
                sanitized[key] = this.sanitizeSensitiveData(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Build log data with context fields and sanitized additional data
     */
    private buildLogData(context: LogContext, data?: Record<string, any>, includeRequestFields = false): Record<string, any> {
        const logData: Record<string, any> = {};

        // Add ID if provided
        if (data?.id) {
            logData.id = data.id;
        }

        // Add context fields
        if (context.uid) logData.uid = context.uid;
        if (context.correlationId) logData.correlationId = context.correlationId;
        // ... other context fields

        // Sanitize and add additional data fields
        if (data) {
            const sanitizedData = this.sanitizeSensitiveData(data);
            Object.keys(sanitizedData).forEach((key) => {
                if (key !== 'id' && key !== 'uid' && key !== 'correlationId') {
                    logData[key] = sanitizedData[key];
                }
            });
        }

        return logData;
    }

    // ... rest of logger implementation
}
```

**Testing**:
- Unit tests for sanitization logic
- Test various sensitive field patterns
- Verify nested object sanitization

**Effort**: Medium (3-4 hours)
**Impact**: Medium (prevents credential leakage)

---

### 7. Audit Logging for Admin Operations

**Issue**: Admin operations (policy management, user promotion) lack dedicated audit trail

**Missing Audit Trail**:
- Policy creation/updates/deletion
- User role promotions (especially to admin)
- Admin-level configuration changes
- No IP address tracking
- No user agent logging

**Risk**:
- Cannot track who made admin changes
- No forensic trail for security incidents
- Compliance issues (GDPR, SOC2)

**Recommendation**: Create dedicated audit logging service

**Implementation**:

```typescript
// NEW FILE: firebase/functions/src/services/AuditLogger.ts

import { IFirestoreWriter } from './firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../logger';

export interface AuditLogEntry {
    action: string;           // e.g., 'policy.create', 'user.promote'
    userId: string;           // Who performed the action
    targetUserId?: string;    // Who was affected (for user operations)
    targetResourceId?: string; // What was affected (policy ID, etc)
    details: Record<string, any>; // Action-specific details
    ipAddress?: string;       // Client IP address
    userAgent?: string;       // Client user agent
    result: 'success' | 'failure'; // Action outcome
    errorMessage?: string;    // Error details if failed
}

export class AuditLogger {
    constructor(private readonly firestoreWriter: IFirestoreWriter) {}

    async logAdminAction(entry: AuditLogEntry): Promise<void> {
        try {
            const auditDoc = {
                ...entry,
                timestamp: new Date().toISOString(),
                severity: 'admin', // Mark as admin-level action
            };

            // Store in dedicated audit-logs collection
            await this.firestoreWriter.createInTransaction(
                null, // No transaction needed for audit logs
                'audit-logs',
                null,
                auditDoc
            );

            // Also log to application logger for immediate visibility
            logger.info('Admin action logged', {
                action: entry.action,
                userId: entry.userId,
                result: entry.result,
            });
        } catch (error) {
            // Never let audit logging failure break the main operation
            logger.error('Failed to write audit log', error as Error, { entry });
        }
    }

    async logPolicyAction(
        action: 'create' | 'update' | 'publish' | 'delete',
        userId: string,
        policyId: string,
        details: Record<string, any>,
        req: Express.Request
    ): Promise<void> {
        await this.logAdminAction({
            action: `policy.${action}`,
            userId,
            targetResourceId: policyId,
            details,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            result: 'success',
        });
    }

    async logUserPromotion(
        adminUserId: string,
        targetUserId: string,
        newRole: string,
        req: Express.Request
    ): Promise<void> {
        await this.logAdminAction({
            action: 'user.promote',
            userId: adminUserId,
            targetUserId,
            details: { newRole },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            result: 'success',
        });
    }
}
```

**Usage in handlers**:

```typescript
// firebase/functions/src/policies/handlers.ts
export const createPolicy = async (req: AuthenticatedRequest, res: Response) => {
    const auditLogger = getAppBuilder().buildAuditLogger();

    try {
        // ... create policy logic
        const result = await policyService.createPolicy(validatedData);

        // Audit log
        await auditLogger.logPolicyAction(
            'create',
            req.user!.uid,
            result.id,
            { policyData: validatedData },
            req
        );

        res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
        // Log failure
        await auditLogger.logAdminAction({
            action: 'policy.create',
            userId: req.user!.uid,
            details: {},
            result: 'failure',
            errorMessage: error.message,
        });
        throw error;
    }
};
```

**Firestore Security Rules for audit-logs**:

```javascript
// firebase/firestore.rules
match /audit-logs/{logId} {
    // Only server functions can write audit logs
    allow write: if false;

    // Only admins can read audit logs
    allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'system_admin';
}
```

**Effort**: Medium (6-8 hours)
**Impact**: Medium (compliance, forensics, security monitoring)

---

## Low Priority Issues

### 8. Enhanced Security Headers

**Current**: Good security headers already in place
**Enhancement**: Add additional hardening headers

**Files to Modify**: `firebase/functions/src/middleware/security-headers.ts`

**Additional Headers**:

```typescript
export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
    // Existing headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // NEW: Additional security headers
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    const config = getConfig();
    if (config.isProduction) {
        // Add 'preload' to HSTS
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        // Existing CSP...
        res.setHeader('Content-Security-Policy', /* ... */);
    }

    next();
}
```

**Effort**: Low (1 hour)
**Impact**: Low (defense in depth)

---

### 9. Input Sanitization Enhancement

**Current**: Excellent dangerous pattern detection in place
**Status**: Already using `xss` library for sanitization
**Enhancement**: Ensure sanitization is consistently applied

**Verification needed**:
- Confirm `sanitizeString()` is used on all user-generated content before storage
- Audit comment creation, group names, expense descriptions
- Verify output encoding in responses

**Effort**: Low (2-3 hours for audit)
**Impact**: Low (already well-protected)

---

## Implementation Priority

### Phase 2A (Critical - Do First)
1.  Rate Limiting (Issue #1) - Prevents DoS attacks
2.  Test Endpoints Guard (Issue #2) - Prevents privilege escalation
3.  Email Duplication Fix (Issue #3) - Fixes data consistency

**Estimated Effort**: 10-14 hours
**Risk Reduction**: HIGH í MEDIUM

### Phase 2B (Important - Do Second)
4.  Health Endpoint Security (Issue #4) - Reduces information disclosure
5.  Email Enumeration (Issue #5) - Protects user privacy
6.  Log Sanitization (Issue #6) - Prevents credential leakage

**Estimated Effort**: 7-10 hours
**Risk Reduction**: MEDIUM í LOW-MEDIUM

### Phase 2C (Compliance - Do Third)
7.  Audit Logging (Issue #7) - Compliance and forensics

**Estimated Effort**: 6-8 hours
**Risk Reduction**: Compliance improvement

### Phase 2D (Hardening - Optional)
8.  Enhanced Headers (Issue #8) - Defense in depth
9.  Input Sanitization Audit (Issue #9) - Verification

**Estimated Effort**: 3-4 hours
**Risk Reduction**: LOW (already well-protected)

---

## Testing Strategy

### Unit Tests
- Rate limiter configuration
- Log sanitization logic
- Email enumeration timing-safe responses
- Environment guard logic

### Integration Tests
- Rate limiting enforcement
- Test endpoint blocking in production
- User creation without email duplication
- Health endpoint authorization
- Audit log creation

### Security Tests
- Brute force attack simulation (rate limiting)
- Email enumeration attempts
- Log inspection for sensitive data
- Test endpoint access attempts in production

### Load Tests
- Rate limiting doesn't impact normal usage
- Health endpoint performance

---

## Dependencies

**New npm packages required**:
- `express-rate-limit` - For rate limiting middleware

**Version constraints**:
- Compatible with Express 4.x
- Node.js 18+ (current runtime)

---

## Rollback Plan

Each issue can be rolled back independently:

1. **Rate Limiting**: Remove middleware imports, revert route changes
2. **Test Endpoints**: Remove environment guards
3. **Email Duplication**: Revert schema changes, restore email writes
4. **Health Endpoint**: Revert to single endpoint
5. **Other changes**: File-by-file rollback via git

---

## Success Metrics

### Security Metrics
- Zero successful brute force attempts (rate limiting)
- Zero test endpoint access in production
- Zero email enumeration successes
- Zero credentials logged
- 100% admin actions audited

### Performance Metrics
- Rate limiting doesn't increase p99 latency by >10ms
- Health endpoint responds <100ms (public) and <500ms (detailed)

### Quality Metrics
- All new code has >90% test coverage
- Zero regression in existing tests
- All security tests pass

---

## Phase 1 Archive (Completed September 2025)

### What Was Accomplished

#### 1. Schema Validation for All Writes
-  All FirestoreWriter methods validate data using Zod schemas before writing to Firestore
-  Comprehensive schema validation for: Users, Groups, Expenses, Settlements, Comments, Policies, Group Memberships, User Notifications
-  Graceful handling of Firestore FieldValue operations (serverTimestamp, arrayUnion, etc.)

#### 2. Production-Ready Security Rules
-  Database-level access control in `firebase/firestore.rules`
-  Proper group membership checking using `group-memberships` collection (not in-memory arrays)
-  Settlement access restricted to payer/payee only
-  Server-function-only writes enforced for all critical operations
-  User self-management only (no privilege escalation)
-  Comprehensive test coverage (31 security rules tests)

**File**: `firebase/firestore.rules` (unified rules for all environments)

#### 3. Transaction Validation Implementation
-  Selective field validation for transaction operations
-  All transaction methods validated: `createInTransaction()`, `updateInTransaction()`, `bulkDeleteInTransaction()`
-  GroupService migrated to use validated FirestoreWriter methods

#### 4. Direct Write Elimination
-  All direct Firestore writes replaced with FirestoreWriter
-  Test utilities use proper FirestoreWriter methods
-  Zero unvalidated write paths to Firestore

#### 5. Comprehensive Monitoring
-  Validation metrics tracking
-  Bulk operation monitoring
-  Enhanced audit trail for all write operations

### Security Posture Before/After Phase 1

**Before Phase 1:**
- L Transaction methods bypassed all validation
- L Direct Firestore writes in multiple places
- L Simplified security rules for emulator only
- L Admin privilege escalation possible
- L Settlement privacy not enforced
- **Risk Level: HIGH**

**After Phase 1:**
-  100% validation coverage for all writes
-  Zero unvalidated write paths
-  Production-ready security rules
-  Proper access control at database level
-  Comprehensive monitoring and audit logging
- **Risk Level: LOW (data layer)**

### Architecture (Phase 1)

#### Write Path Security
```
Application Layer
    ì
FirestoreWriter (with validation)
    ì (DTO with ISO strings í Timestamp conversion)
Firestore Database
    ì
Security Rules (database-level enforcement)
```

#### Key Components

**FirestoreWriter** (`firebase/functions/src/services/firestore/FirestoreWriter.ts`)
- Centralized write operations
- Zod schema validation
- Selective field validation for transactions
- Automatic timestamp conversion (ISO í Timestamp)
- Comprehensive metrics and logging

**Security Rules** (`firebase/firestore.rules`)
- Production-ready access control
- Group membership via collection lookups
- Server-function-only write enforcement
- Self-management policies

**Validation Strategy**
- Full validation for direct writes (create, update, delete)
- Selective validation for transaction updates (skip FieldValue operations)
- Skip validation only when necessary (with logging)

---

**Document Version**: 2.0
**Last Updated**: January 2025
**Status**: Phase 1 Complete  | Phase 2 Planning
**Next Review**: After Phase 2A completion
