# CORS and Security Configuration

## Overview

This document explains the simplified CORS and security configuration for the Firebase Functions API.

## CORS Configuration

The CORS configuration is now centralized in `src/middleware/cors.ts`:

### Production Mode
- **Allowed Origins**: Only official Firebase hosting domains
  - `https://{projectId}.web.app`
  - `https://{projectId}.firebaseapp.com`
- **Strict Origin Validation**: Rejects requests from unauthorized origins
- **Preflight Caching**: 24 hours (86400 seconds)

### Development Mode
- **Allowed Origins**: All origins (`origin: true`)
- **Simplified Configuration**: No need to maintain hardcoded localhost ports

## Security Headers

Security headers are applied via `src/middleware/security-headers.ts`:

### Always Applied
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables XSS filtering
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Disables camera, microphone, and geolocation

### Production Only
- `Strict-Transport-Security` - Enforces HTTPS
- `Content-Security-Policy` - Restricts resource loading

## Testing

### Running Endpoint Tests

The test script (`src/tests/api-endpoints.test.ts`) validates:
- CORS headers for all endpoints
- Security headers presence
- Public endpoint accessibility
- Secure endpoint authentication
- Preflight request handling

#### Local Testing
```bash
cd firebase/functions
npm run test:endpoints:local
```

#### Production Testing
```bash
# Update the production URL in the test script first
npm run test:endpoints:prod
```

### What the Tests Validate

1. **CORS Functionality**
   - OPTIONS preflight requests
   - Origin validation
   - Credential support
   - Allowed methods and headers

2. **Security Headers**
   - Presence of required security headers
   - HSTS in production
   - CSP configuration

3. **Authentication**
   - Public endpoints accessible without auth
   - Secure endpoints require valid tokens
   - Proper 401 responses for unauthorized requests

## Best Practices

1. **Environment Detection**
   - Uses `process.env.FUNCTIONS_EMULATOR` for reliable detection
   - No complex environment logic

2. **Origin Validation**
   - Production uses callback-based validation
   - Development allows all origins for ease of testing

3. **Security Headers**
   - Applied before CORS middleware
   - Progressive enhancement (stricter in production)

4. **Error Handling**
   - CORS errors return proper error messages
   - Security violations logged for monitoring

## Migration Notes

If migrating from the old configuration:
1. Remove `corsOptions` from `CONFIG` object
2. Update middleware imports to use new modules
3. Run tests to ensure endpoints work correctly
4. Deploy to staging environment first
5. Monitor for any CORS-related errors

## Troubleshooting

### CORS Issues
- Check browser console for CORS errors
- Verify origin is in allowed list (production)
- Ensure credentials are included in requests
- Check preflight response headers

### Security Header Issues
- Use browser DevTools to inspect response headers
- Verify CSP doesn't block required resources
- Check for mixed content warnings (HTTP/HTTPS)

### Testing Issues
- Ensure emulator is running for local tests
- Update production URL in test script
- Check authentication tokens are valid
- Verify test user creation succeeds