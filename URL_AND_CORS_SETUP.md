# URL and CORS Configuration Setup

This document explains how Splitifyd handles URLs and CORS configuration to work seamlessly in both local development (Firebase emulator) and production environments without any code modifications.

## Overview

The application uses a dynamic configuration system that:
- Detects the current environment (local vs production)
- Fetches Firebase configuration from the backend
- Constructs API URLs based on the current environment
- Handles CORS properly for all environments

## Architecture

### 1. Configuration Flow

```
Browser → firebase-config.js → Backend /config endpoint → Firebase initialization
                ↓
            config.js → API URL construction
                ↓
            api.js/auth.js → API calls with proper URLs
```

### 2. Key Components

#### firebase-config.js
- Manages Firebase SDK initialization
- Fetches configuration from backend
- Provides centralized API URL management
- Handles auth emulator connection for local development

#### config.js
- Wraps firebase-config.js functionality
- Provides async and sync methods for API URL retrieval
- Maintains backward compatibility

#### Backend config.ts
- Provides dynamic CORS configuration
- Returns appropriate Firebase config based on environment
- Uses PROJECT_ID environment variable (defaults to 'splitifyd')

## Environment Detection

The system detects the environment based on `window.location.hostname`:
- Local: `localhost` or `127.0.0.1`
- Production: Any other hostname

## URL Construction

### Local Development
```javascript
// Config endpoint
http://localhost:5001/splitifyd/us-central1/api/config

// API endpoints
http://localhost:5001/splitifyd/us-central1/api/[endpoint]
```

### Production
```javascript
// Config endpoint
https://[your-domain]/api/config

// API endpoints
https://[your-domain]/api/[endpoint]
```

## CORS Configuration

### Backend CORS Settings (config.ts)

```typescript
corsOptions: {
  origin: ENV_IS_PRODUCTION 
    ? [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
    : [
        `http://localhost:3000`, 
        `http://localhost:5000`, 
        `http://localhost:5002`,
        `http://127.0.0.1:5000`,
        `http://127.0.0.1:5002`
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}
```

### Key CORS Features
- Credentials allowed for authentication
- Preflight requests handled automatically
- Dynamic origin based on environment
- All standard HTTP methods supported

## Testing

### Test Suite Location
`webapp/test-config.html`

### Running Tests

1. **Local Development**:
   ```bash
   # Start Firebase emulators
   cd firebase && npm run dev
   
   # Open test page
   open http://localhost:5002/test-config.html
   ```

2. **Production**:
   Deploy and navigate to `https://[your-domain]/test-config.html`

### Test Coverage
- Firebase config fetching
- Firebase initialization
- API URL construction
- CORS headers validation
- CORS preflight requests
- Environment detection

## Common Issues and Solutions

### Issue: Hardcoded URLs
**Problem**: URLs like `https://api-po437q3l5q-uc.a.run.app` break when deployed to different environments.

**Solution**: Always use the dynamic configuration system:
```javascript
// Wrong
const url = 'https://api-po437q3l5q-uc.a.run.app/endpoint';

// Correct
const apiUrl = await config.getApiUrl();
const url = `${apiUrl}/endpoint`;
```

### Issue: CORS Errors
**Problem**: "Access-Control-Allow-Origin" errors in browser console.

**Solutions**:
1. Ensure the frontend domain is added to CORS origins in backend config.ts
2. Check that credentials are included in fetch requests
3. Verify the backend is returning proper CORS headers

### Issue: Config Fetch Fails
**Problem**: Unable to fetch Firebase configuration from backend.

**Solutions**:
1. Check if Firebase emulators are running (for local development)
2. Verify the `/config` endpoint is accessible
3. Check browser console for specific error messages
4. Ensure no firewall/proxy is blocking the request

### Issue: Wrong Project ID
**Problem**: `.firebaserc` contains incorrect project ID.

**Solution**: Update `.firebaserc` to use correct project ID:
```json
{
  "projects": {
    "default": "splitifyd"
  }
}
```

## Security Considerations

1. **No Secrets in Frontend**: The Firebase config returned by `/config` contains only public configuration
2. **Authentication Required**: All API endpoints (except /config and /health) require authentication
3. **CORS Protection**: Only whitelisted origins can access the API
4. **HTTPS in Production**: Always use HTTPS for production deployments

## Development Workflow

1. **Start Emulators**:
   ```bash
   cd firebase && npm run dev
   ```

2. **Verify Configuration**:
   - Open http://localhost:5002/test-config.html
   - All tests should pass

3. **Make Changes**:
   - Update code as needed
   - Configuration changes automatically detected

4. **Deploy to Production**:
   ```bash
   firebase deploy
   ```

## Best Practices

1. **Never hardcode URLs** - Always use the configuration system
2. **Test in both environments** - Verify local and production behavior
3. **Check CORS headers** - Use browser dev tools Network tab
4. **Handle async properly** - Configuration loading is asynchronous
5. **Cache configuration** - The system caches config to avoid repeated fetches

## Debugging

### Enable Verbose Logging
Add to your code:
```javascript
console.log('Config URL:', window.firebaseConfigManager.getConfigUrl());
console.log('API URL:', window.firebaseConfigManager.getApiUrl());
console.log('Is Local:', window.firebaseConfigManager.isLocalEnvironment());
```

### Check Network Requests
1. Open browser Developer Tools
2. Go to Network tab
3. Look for `/config` request
4. Check response headers for CORS
5. Verify response contains Firebase config

### Common Error Messages

**"Failed to fetch Firebase config"**
- Backend not running or not accessible
- CORS blocking the request
- Network connectivity issues

**"Firebase initialization failed"**
- Invalid Firebase configuration
- Missing required config fields
- Firebase SDK loading issues

**"CORS Error: Network request blocked"**
- Origin not whitelisted in backend
- Preflight request failing
- Missing CORS headers from backend

## Summary

This configuration system ensures that:
- ✅ No hardcoded URLs in the codebase
- ✅ Same code works in all environments
- ✅ CORS is properly configured
- ✅ Firebase auth works with emulators locally
- ✅ Configuration is fetched dynamically
- ✅ API URLs adapt to the current environment

By following this setup, the application can be deployed to any Firebase project or domain without code changes.