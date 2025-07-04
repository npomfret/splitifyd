# Splitifyd Configuration Guide

This comprehensive guide covers technical configuration, security, and CORS setup for the Splitifyd application.

## Overview

Splitifyd uses a dynamic, environment-aware configuration system that:
- Works seamlessly in local development and production
- Fetches Firebase configuration from backend endpoints
- Handles CORS automatically based on environment
- Requires no code changes between environments

**Tech Stack**: Node.js (latest), TypeScript (latest), Firebase Functions, Firebase Emulator Suite
**Structure**: Mono-repo with client (webapp) and server (firebase) sub-projects

## Security & Configuration Management

### Environment Variables (Required)
All Firebase configuration MUST be stored in environment variables on the server with NO hardcoded values in the codebase.

```bash
# Firebase Client Configuration (firebase/functions/.env)
CLIENT_API_KEY=your-api-key
CLIENT_AUTH_DOMAIN=your-project-id.firebaseapp.com
CLIENT_STORAGE_BUCKET=your-project-id.firebasestorage.app
CLIENT_MESSAGING_SENDER_ID=your-sender-id
CLIENT_APP_ID=your-app-id
CLIENT_MEASUREMENT_ID=your-measurement-id  # Optional
PROJECT_ID=splitifyd  # Optional, defaults to 'splitifyd'
```

### Configuration Flow
1. **Frontend loads** → Detects environment (local vs production)
2. **Frontend calls** `/api/config` endpoint (no auth required)
3. **Backend returns** Firebase configuration from environment variables
4. **Frontend initializes** Firebase SDK with received config
5. **Frontend makes** authenticated API calls with proper CORS headers

### Firebase Web API Key Background
Firebase Web API keys are public identifiers protected by Firebase Security Rules, domain restrictions, and app restrictions - NOT secret keys.

### Firebase Console Security Setup
1. **API Key Restrictions** (Google Cloud Console):
   - Production: `https://your-domain.com/*`
   - Firebase hosting: `https://your-project.web.app/*`
   - Development: `http://localhost:*`
2. **Firebase Security Rules**: Configure Firestore, Authentication, and Storage rules
3. **App Check**: Enable for production to verify requests come from your app

## CORS Configuration

### Environment Detection & Dynamic Configuration
- **Local**: `localhost` or `127.0.0.1` hostname → Development mode (allows ALL origins)
- **Production**: Any other hostname → Production mode (strict whitelist)
- **Detection Method**: `process.env.FUNCTIONS_EMULATOR === 'true'`

### CORS Implementation (`firebase/functions/src/middleware/cors.ts`)
**Production Mode**: Only `https://{projectId}.web.app` and `https://{projectId}.firebaseapp.com`
**Development Mode**: All origins allowed (`origin: true`)

### CORS Headers Applied
```
Access-Control-Allow-Origin: [dynamic based on request origin]
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Correlation-Id
Access-Control-Expose-Headers: X-Correlation-Id
Access-Control-Max-Age: 86400 (24 hours for preflight caching)
```

### Critical CORS Rules (DO NOT BREAK)
1. **Never remove** the `cors` middleware from the middleware stack
2. **Never change** the `invoker: 'public'` setting on the main function export
3. **Never add** authentication to OPTIONS requests
4. **Always test** both local and production after CORS changes
5. **Middleware order matters**: CORS before body parsing and authentication

## URL Construction

### Local Development
```javascript
// Config: http://localhost:5001/splitifyd/us-central1/api/config
// API: http://localhost:5001/splitifyd/us-central1/api/[endpoint]
```

### Production
```javascript
// Config: https://[your-domain]/api/config
// API: https://[your-domain]/api/[endpoint]
```

### Dynamic URL Usage (Always Required)
```javascript
// Wrong - hardcoded
const url = 'https://api-po437q3l5q-uc.a.run.app/endpoint';

// Correct - dynamic
const apiUrl = await config.getApiUrl();
const url = `${apiUrl}/endpoint`;
```

## Commands & Development Workflow

### Essential Commands
- Start local services: `cd firebase && npm run dev`
- Build: `cd <sub-project> && npm run build`
- Test: `cd <sub-project> && npm test`
- Check git status: `git status --porcelain`
- Deploy to prod: `cd firebase && npm run deploy:prod`

### Development Process
1. **Environment Setup**: Copy `.env.example` to `.env` in `firebase/functions`
2. **Start Services**: `cd firebase && npm run dev`
3. **Make Changes**: Edit code with proper validation
4. **Build & Test**: Run both in each affected sub-project
5. **Fix Errors**: Address any build or test failures
6. **Git Management**: Check status, add new files to git or .gitignore

### Firebase Local Development
- **Console**: http://127.0.0.1:4000
- **Logs**: http://localhost:4000/logs
- **Auth Issues**: `firebase login --reauth`
- **Emulator**: Typically already running via `npm run dev`

## Built-in Security Features
- **CORS Configuration**: Environment-aware origin limiting
- **Rate Limiting**: Memory-based limiting (10 requests/minute per user)
- **Request Validation**: Input validation and sanitization
- **Structured Logging**: Security monitoring and auditing
- **Authentication**: Firebase Auth token verification middleware
- **User Isolation**: Firestore rules enforce user-specific access

## Testing

### Test Suite
**Location**: `webapp/test-config.html`

**Local Testing**:
```bash
cd firebase && npm run dev
open http://localhost:5002/test-config.html
```

**Production Testing**: Deploy and navigate to `https://[your-domain]/test-config.html`

**Coverage**: Firebase config fetching, initialization, API URL construction, CORS headers, preflight requests, environment detection

### CORS Testing Commands
```bash
# Test CORS headers
curl -I -X OPTIONS http://localhost:5001/splitifyd/us-central1/api/config \
  -H "Origin: http://localhost:5002" \
  -H "Access-Control-Request-Method: GET"

# Test actual request
curl http://localhost:5001/splitifyd/us-central1/api/config \
  -H "Origin: http://localhost:5002"
```

## Common Issues & Solutions

### CORS Errors
**"Access to fetch blocked by CORS policy"**:
1. Ensure domain matches Firebase hosting patterns (production)
2. Include credentials in fetch requests:
   ```javascript
   fetch(url, {
     credentials: 'include',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`
     }
   })
   ```

**"No 'Access-Control-Allow-Origin' header"**:
- **Local**: Ensure emulators running (`cd firebase && npm run dev`)
- **Production**: Check domain served from Firebase hosting
- **Custom Domain**: Add to allowed origins in `cors.ts`

**"Request client is not a secure context"**: Use HTTPS for production

### Config Fetch Failures
- Check Firebase emulators running (local)
- Verify `/config` endpoint accessible
- Check browser console for specific errors
- Ensure no firewall/proxy blocking requests

### Emergency CORS Fixes
1. **DO NOT** modify `invoker: 'public'` setting
2. **DO NOT** remove CORS middleware
3. **DO** check middleware order in `utils/middleware.ts`
4. **DO** verify environment detection working

## Error Handling Strategy

### Philosophy
- **Fail Fast**: Validate early, throw on invalid state
- **Bubble Up**: Let exceptions bubble up - crash on broken state
- **No Try/Catch/Log**: Avoid catching exceptions just to log them
- **Meaningful Errors**: Clear, actionable error messages

### Implementation
- Input validation at entry points
- Centralized error handling middleware
- Proper HTTP status codes
- Standardized error response format

## Security Best Practices

### Input & Output
- Early validation and sanitization
- Size limits (max 1MB per document)
- TypeScript strict mode for type safety
- Sanitize user output, use textContent over innerHTML

### Authentication & Monitoring
- Firebase Auth token verification
- Session management and cleanup
- Audit logging for security events
- Track authentication failures
- Monitor API usage for anomalies

### XSS Prevention
- Content Security Policy headers
- Input validation and escaping
- Safe DOM manipulation practices

## Debugging

### Enable Verbose Logging
```javascript
console.log('Config URL:', window.firebaseConfigManager.getConfigUrl());
console.log('API URL:', window.firebaseConfigManager.getApiUrl());
console.log('Is Local:', window.firebaseConfigManager.isLocalEnvironment());
```

### Browser DevTools Debugging
1. Open Developer Tools → Network tab
2. Look for `/config` request
3. Check response headers for CORS
4. Verify response contains Firebase config

### Common Error Messages
- **"Failed to fetch Firebase config"**: Backend not running/accessible, CORS blocking, network issues
- **"Firebase initialization failed"**: Invalid config, missing fields, SDK loading issues
- **"CORS Error: Network request blocked"**: Origin not whitelisted, preflight failing, missing headers

## Deployment

### Local
- **Emulator**: `firebase emulators:start` from `/firebase` directory
- **Console**: http://127.0.0.1:4000
- **Logs**: http://localhost:4000/logs

### Production
- **Command**: `cd firebase && npm run deploy:prod`
- **Prerequisites**: Environment variables configured, API key restrictions set
- **Monitoring**: Set up monitoring and alerting

## Best Practices Summary

✅ **Configuration**: Never hardcode URLs, always use dynamic system
✅ **Testing**: Test both local and production environments
✅ **CORS**: Check headers in browser dev tools, handle async properly
✅ **Security**: No secrets in frontend, HTTPS in production, proper validation
✅ **Development**: Cache configuration, fail fast, bubble up exceptions
✅ **Deployment**: Same code works all environments, no code changes needed

## Security Questions

For security concerns:
1. Review Firebase security documentation
2. Check Google Cloud security best practices  
3. Consider hiring security consultant for production
4. Refer to this guide for technical implementation details