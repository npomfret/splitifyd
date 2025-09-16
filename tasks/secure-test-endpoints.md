# Secure Test Endpoints for Policy Management

## Overview

During implementation of policy acceptance testing, new test endpoints were added that allow manipulation of policies and user policy acceptances. While these endpoints are intended for development/testing only, they need additional security restrictions to prevent misuse.

## Current Implementation

### New Test Endpoints

1. **Policy Update Endpoint**: `/policies/:id/update` (POST)
    - Location: `firebase/functions/src/test/policy-handlers.ts:16`
    - Purpose: Update policy content and publish new versions
    - Current Security: None (bypasses authentication entirely)
    - Used by: E2E tests via `ApiDriver.updateSpecificPolicy()`

2. **Clear Policy Acceptances**: `/test/user/clear-policy-acceptances` (POST)
    - Location: `firebase/functions/src/test/policy-handlers.ts:59`
    - Purpose: Reset user's policy acceptances for testing
    - Current Security:
        - ✅ Production check (`config.isProduction`)
        - ✅ Requires Bearer token authentication
        - ✅ Validates Firebase ID token

### Security Concerns

#### Policy Update Endpoint (`/policies/:id/update`)

- **HIGH RISK**: No authentication or authorization checks
- **Impact**: Anyone can modify policy content in dev environments
- **Attack Vectors**:
    - Malicious policy content injection
    - Disruption of development workflows
    - Potential data corruption if misconfigured

#### Clear Policy Acceptances Endpoint

- **MEDIUM RISK**: Properly authenticated but powerful
- **Impact**: Can reset any user's policy acceptances
- **Attack Vectors**:
    - Legitimate users resetting other users' acceptances
    - Bulk policy acceptance manipulation

## Recommended Security Improvements

### 1. Environment Restrictions (Both Endpoints)

```typescript
// Add to both endpoint handlers
const config = getConfig();
if (config.isProduction) {
    res.status(403).json({
        error: {
            code: 'FORBIDDEN',
            message: 'Test endpoints not available in production',
        },
    });
    return;
}
```

### 2. Authentication for Policy Update Endpoint

```typescript
// Add authentication to testUpdatePolicy handler
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
        error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization token required for test endpoints',
        },
    });
    return;
}

const token = authHeader.substring(7);
try {
    const auth = getAuth();
    await auth.verifyIdToken(token);
} catch (error) {
    res.status(401).json({
        error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token for test endpoint',
        },
    });
    return;
}
```

### 3. Admin Role Check (Optional Enhancement)

Consider adding admin role verification for policy updates:

```typescript
// After token verification
const decodedToken = await auth.verifyIdToken(token);
const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
const userData = userDoc.data();

if (!userData?.isAdmin && !userData?.isTestUser) {
    res.status(403).json({
        error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin or test user privileges required',
        },
    });
    return;
}
```

### 4. Rate Limiting (Future Enhancement)

Add rate limiting to prevent abuse:

- Max 10 policy updates per user per hour
- Max 5 policy acceptance resets per user per hour

### 5. Audit Logging Enhancement

Improve logging to track test endpoint usage:

```typescript
logger.info('Test endpoint accessed', {
    endpoint: req.path,
    userId: decodedToken.uid,
    userEmail: decodedToken.email,
    policyId: id,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip,
});
```

## Implementation Priority

### Phase 1: Critical Security (Immediate)

- [ ] Add production environment checks to policy update endpoint
- [ ] Add authentication to policy update endpoint
- [ ] Test that E2E tests still work with authentication

### Phase 2: Enhanced Security (Next Sprint)

- [ ] Implement admin role checks
- [ ] Add rate limiting middleware
- [ ] Enhance audit logging

### Phase 3: Monitoring (Future)

- [ ] Set up alerts for test endpoint usage in production-like environments
- [ ] Create dashboard for test endpoint usage metrics

## Testing Requirements

After implementing security improvements:

1. **E2E Test Compatibility**: Ensure `ApiDriver.updateSpecificPolicy()` can authenticate
2. **Negative Testing**: Test that endpoints properly reject unauthorized requests
3. **Environment Testing**: Verify production checks work correctly

## Files to Modify

1. `firebase/functions/src/test/policy-handlers.ts` - Add authentication and environment checks
2. `packages/test-support/src/ApiDriver.ts` - Update to handle authentication headers
3. `firebase/functions/src/index.ts` - Consider middleware for consistent test endpoint security

## Related Considerations

- **Development Experience**: Balance security with ease of testing
- **CI/CD Pipeline**: Ensure test endpoints work in automated testing environments
- **Documentation**: Update API documentation to reflect security requirements

## Risk Assessment

**Current Risk Level**: HIGH for policy update endpoint, MEDIUM for policy acceptance clearing
**Post-Implementation Risk Level**: LOW with proper authentication and environment checks

This task should be completed before the policy acceptance feature goes to production.
