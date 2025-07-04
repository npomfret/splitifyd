# Technical Configuration & Security Guide

## Security Configuration

### Firebase Configuration Management
- **Environment Variables Required**: All Firebase configuration MUST be stored in environment variables on the server
- **No Hardcoded Values**: There are NO hardcoded API keys or configuration values in the codebase
- **Dynamic Loading**: Frontend fetches configuration from `/config` endpoint at startup
- **Configuration Flow**: Backend environment variables → `/config` endpoint → Frontend dynamic loading

### Required Environment Variables
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

### Frontend-Backend Configuration Flow
1. **Frontend loads** → Detects environment (local vs production)
2. **Frontend calls** `/api/config` endpoint (no auth required)
3. **Backend returns** Firebase configuration from environment variables
4. **Frontend initializes** Firebase SDK with received config
5. **Frontend makes** authenticated API calls with proper CORS headers

This flow ensures:
- No hardcoded configuration in frontend
- Same frontend code works in all environments
- Configuration changes don't require code changes
- CORS is properly handled at each step

### Firebase Console Security Setup
1. **API Key Restrictions** (Google Cloud Console):
   - Production: `https://your-domain.com/*`
   - Firebase hosting: `https://your-project.web.app/*`
   - Development: `http://localhost:*`

2. **Firebase Security Rules**: Configure Firestore, Authentication, and Storage rules

3. **App Check**: Enable for production to verify requests come from your app

### Built-in Security Features
- **CORS Configuration**: Limits allowed origins (DO NOT BREAK CORS CONFIG)
- **Rate Limiting**: Prevents abuse with memory-based limiting (10 requests/minute per user)
- **Request Validation**: Input validation and sanitization
- **Structured Logging**: Security monitoring and auditing
- **Health Check Endpoints**: For monitoring

## CORS Configuration

### Overview
CORS (Cross-Origin Resource Sharing) allows the frontend to communicate with the backend API across different origins. The configuration is **environment-aware** and automatically adjusts between development and production.

### How CORS Works in This Application

#### 1. **Backend CORS Middleware** (`firebase/functions/src/middleware/cors.ts`)
The backend uses the `cors` npm package with dynamic configuration:

**Production Mode**:
- Only allows requests from official Firebase hosting domains
- Whitelist: `https://{projectId}.web.app` and `https://{projectId}.firebaseapp.com`
- Rejects all other origins with error

**Development Mode**:
- Allows ALL origins (`origin: true`) for easier testing
- No need to maintain localhost port lists
- Automatically works with any local development server

#### 2. **Environment Detection**
The system detects environment using `process.env.FUNCTIONS_EMULATOR`:
- If `FUNCTIONS_EMULATOR === 'true'` → Development mode
- Otherwise → Production mode

#### 3. **CORS Headers Applied**
```
Access-Control-Allow-Origin: [dynamic based on request origin]
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Correlation-Id
Access-Control-Expose-Headers: X-Correlation-Id
Access-Control-Max-Age: 86400 (24 hours for preflight caching)
```

### Common CORS Issues and Solutions

#### Issue 1: "Access to fetch at 'X' from origin 'Y' has been blocked by CORS policy"
**Causes**:
- In production: Your domain is not in the allowed origins list
- Credentials not included in fetch request
- Preflight request failing

**Solutions**:
1. For production, ensure your domain matches Firebase hosting patterns
2. Always include credentials in fetch requests:
   ```javascript
   fetch(url, {
     credentials: 'include',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`
     }
   })
   ```

#### Issue 2: CORS working locally but not in production
**Cause**: Production has strict origin validation while development allows all origins

**Solution**: Deploy to official Firebase hosting domains, or modify `getCorsOptions()` in `cors.ts` to add your custom domain

#### Issue 3: OPTIONS preflight requests failing
**Cause**: Preflight requests not handled properly

**Solution**: The middleware automatically handles OPTIONS requests. Ensure no authentication is required for OPTIONS.

### Critical Implementation Details

1. **Middleware Order Matters**: CORS middleware must be applied before body parsing and authentication
2. **Function Configuration**: The main export uses `invoker: 'public'` to allow unauthenticated CORS preflight requests
3. **No Hardcoded Origins**: Production origins are dynamically constructed using `CONFIG.projectId`

### Testing CORS
1. **Local Testing**: Start emulators and access from any localhost port
2. **Production Testing**: Use the test script at `firebase/functions/src/tests/api-endpoints.test.ts`
3. **Browser DevTools**: Check Network tab for CORS headers in response
4. **Validation Script**: Run `node firebase/functions/scripts/validate-cors.js` (Note: needs update for new architecture)

### DO NOT BREAK CORS - Key Rules
1. **Never remove** the `cors` middleware from the middleware stack
2. **Never change** the `invoker: 'public'` setting on the main function export
3. **Never add** authentication to OPTIONS requests
4. **Always test** both local and production after CORS changes
5. **Keep it simple**: The current setup works - avoid complex modifications

## Runtime Configuration

### Local Development
- **Detection**: Frontend detects local environment automatically based on hostname
- **Emulator Integration**: Fetches config from local Functions emulator
- **Firebase Auth**: Automatically connects to Auth emulator
- **Startup**: `cd firebase && npm run dev`
- **Frontend URL Detection**: 
  - If hostname is `localhost` or `127.0.0.1` → Local mode
  - API URL: `http://localhost:5001/splitifyd/us-central1/api/[endpoint]`
  - Config endpoint: `http://localhost:5001/splitifyd/us-central1/api/config`

### Production Environment
- **Environment Variables**: Set in hosting platform (Firebase Functions, Cloud Run, etc.)
- **Domain Authorization**: Add domain to Firebase Auth authorized domains
- **API Restrictions**: Configure in Google Cloud Console
- **Security Rules**: Review and tighten for production
- **Frontend URL Detection**:
  - Any hostname other than localhost/127.0.0.1 → Production mode
  - API URL: `https://[current-domain]/api/[endpoint]`
  - Config endpoint: `https://[current-domain]/api/config`
  - Uses relative URLs to work with any domain

### Runtime Requirements
- **Node.js**: Latest version
- **TypeScript**: Latest version
- **Firebase Functions**: Runtime environment
- **Firebase Emulator Suite**: For local development

## Build Configuration

### Build Process
- **Commands**: `cd <sub-project> && npm run build`
- **Verification**: Always run after changes
- **Testing**: `cd <sub-project> && npm test`
- **Error Handling**: Fix any build errors before proceeding

### Project Structure
- **Mono-repo**: Both client (webapp) and server (firebase) are sub-projects
- **Build Targets**: Each sub-project has independent build process
- **Dependencies**: Manage per sub-project

### Build-time Considerations
- **Structural Changes**: Consider build-time and runtime impacts
- **Firebase Compatibility**: Must work in both emulator and production
- **Type Safety**: TypeScript strict mode enabled
- **Modern Standards**: ES modules, latest APIs

## Testing Configuration

### Test Commands
- **Unit Tests**: `cd <sub-project> && npm test`
- **Integration Tests**: Use Firebase emulator suite
- **Manual Testing**: Simple HTML interface for API testing

### Test Environment
- **Emulator Suite**: Firebase emulators for local testing
- **Mocking**: Mock Firestore for unit tests
- **Coverage**: Test authentication, validation, CRUD operations, error handling

### Test Structure
```
functions/
├── __tests__/
│   ├── documents.test.ts
│   └── auth.test.ts
└── src/
```

## Development Workflow

### Pre-Development Setup
1. **Environment Setup**: Copy `.env.example` to `.env` in `firebase/functions`
2. **Configuration**: Add Firebase configuration values
3. **Directory Verification**: Ensure correct directory before commands

### Development Process
1. **Start Services**: `cd firebase && npm run dev`
2. **Make Changes**: Edit code with proper validation
3. **Build**: `cd <sub-project> && npm run build`
4. **Test**: `cd <sub-project> && npm test`
5. **Fix Errors**: Address any build or test failures
6. **Git Status**: Check `git status --porcelain` for untracked files
7. **Add Files**: Add new files to git or .gitignore

### Critical Development Rules
- **Fail Fast**: Validate early, throw on invalid state
- **Exception Handling**: Let exceptions bubble up - crash on broken state
- **Simple Solutions**: Prefer simple solutions over clever abstractions
- **Production Ready**: Every line of code is production-ready
- **Dependency Management**: Avoid dependencies when simple code suffices

## Security Best Practices

### Input Validation
- **Early Validation**: Validate all inputs at entry points
- **Sanitization**: Sanitize user input before processing
- **Size Limits**: Enforce size limits (max 1MB per document)
- **Type Checking**: Use TypeScript for type safety

### Authentication & Authorization
- **Firebase Auth**: Token verification middleware
- **User Isolation**: Firestore rules enforce user-specific access
- **Session Management**: Proper token handling and cleanup
- **Rate Limiting**: Prevent abuse with request limiting

### XSS Prevention
- **Output Sanitization**: Sanitize all user output
- **Content Security Policy**: Implement CSP headers
- **Safe DOM Manipulation**: Use textContent over innerHTML
- **Input Validation**: Validate and escape user inputs

### Monitoring & Incident Response
- **Audit Logging**: Track security events and access patterns
- **Usage Monitoring**: Monitor API usage and detect anomalies
- **Failed Attempts**: Track authentication failures
- **Incident Response**: Procedures for security incidents

## Performance Considerations

### Runtime Performance
- **Memory Management**: Proper cleanup of event listeners and resources
- **Lazy Loading**: Dynamic imports for code splitting
- **Debouncing**: Debounce expensive operations
- **Caching**: Implement appropriate caching strategies

### Build Performance
- **Tree Shaking**: Remove unused code
- **Code Splitting**: Split code into logical chunks
- **Module Bundling**: Optimize bundle sizes
- **Asset Optimization**: Compress and optimize assets

## Error Handling Strategy

### Philosophy
- **Fail Fast**: Validate early and fail on invalid state
- **Bubble Up**: Let exceptions bubble up rather than catching and logging
- **Meaningful Errors**: Provide clear, actionable error messages
- **Consistent Responses**: Standardized error response format

### Implementation
- **No Try/Catch/Log**: Avoid catching exceptions just to log them
- **Validation**: Validate inputs and throw meaningful errors
- **Error Middleware**: Centralized error handling
- **Status Codes**: Proper HTTP status codes for different error types

## Deployment Configuration

### Local Deployment
- **Emulator**: `firebase emulators:start` from `/firebase` directory
- **Console**: http://127.0.0.1:4000
- **Logs**: http://localhost:4000/logs

### Production Deployment
- **Command**: `cd firebase && npm run deploy:prod`
- **Prerequisites**: Environment variables configured
- **Validation**: API key restrictions configured
- **Monitoring**: Set up monitoring and alerting

### Authentication Issues
- **Reauth**: `firebase login --reauth` if auth errors occur
- **Documentation**: Read Firebase docs before making changes
- **Testing**: Test in emulator before production deployment

## CORS Troubleshooting Guide

### Quick Diagnosis Steps
1. **Check Browser Console**: Look for CORS error messages
2. **Check Network Tab**: Inspect request/response headers
3. **Check Environment**: Verify if you're in local or production mode
4. **Check Fetch Code**: Ensure `credentials: 'include'` is set

### Common Error Messages and Fixes

#### "No 'Access-Control-Allow-Origin' header is present"
- **Local**: Ensure emulators are running (`cd firebase && npm run dev`)
- **Production**: Check that your domain is served from Firebase hosting
- **Custom Domain**: Add to allowed origins in `cors.ts`

#### "CORS policy: The request client is not a secure context"
- **Cause**: HTTPS required in production
- **Fix**: Use HTTPS for production deployments

#### "CORS policy: Credentials flag is true, but Access-Control-Allow-Credentials is not"
- **Cause**: Backend not configured for credentials
- **Fix**: This should not happen with current setup - check middleware order

### Debugging Commands
```bash
# Test CORS headers locally
curl -I -X OPTIONS http://localhost:5001/splitifyd/us-central1/api/config \
  -H "Origin: http://localhost:5002" \
  -H "Access-Control-Request-Method: GET"

# Test actual request
curl http://localhost:5001/splitifyd/us-central1/api/config \
  -H "Origin: http://localhost:5002"
```

### Emergency Fixes
If CORS is completely broken:
1. **DO NOT** modify the `invoker: 'public'` setting
2. **DO NOT** remove CORS middleware
3. **DO** check if middleware order changed in `utils/middleware.ts`
4. **DO** verify environment detection is working
5. **DO** test with the provided test script first

### Firebase Hosting and CORS
Firebase hosting uses URL rewrites to route `/api/*` requests to Cloud Functions:
- **Rewrite Rule**: `/api/**` → Cloud Function `api`
- **URL Stripping**: The backend strips `/api` prefix from requests
- **Same Origin**: When deployed to Firebase hosting, API calls appear same-origin
- **CORS Still Needed**: For local development and cross-domain requests

This means:
- Production on Firebase hosting: Often no CORS errors (same origin)
- Local development: CORS headers required
- Custom domains: May need CORS configuration