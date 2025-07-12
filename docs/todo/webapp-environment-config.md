# Webapp Issue: Environment-Specific Configurations - COMPLETED

## Issue Description

The current system determines the environment (local vs. production) on the client-side by checking `window.location.hostname`. This approach is brittle, lacks scalability, poses a security risk, and is inflexible.

## ✅ IMPLEMENTATION COMPLETED

The environment-specific configuration system has been successfully implemented:

1. **Created Environment Loader Module** - Implemented `webapp/src/js/utils/env-loader.ts` to load and parse environment files
2. **Updated Firebase Configuration** - Modified `firebase-config.ts` to use environment variables instead of hardcoded values
3. **Updated Config Module** - Modified `config.ts` to use environment variables with proper fallbacks
4. **Updated HTML Files** - Added env-loader script to all HTML files that use configuration
5. **Build and Tests Successful** - The webapp builds without errors and all tests pass (34/34)

The implementation successfully eliminated hardcoded environment detection while maintaining all existing functionality and improving configuration flexibility.

## Recommendation

Adopt a formal system for environment variables using `.env` files to create a more professional, secure, and flexible application.

## Implementation Suggestions

### Step 1: Create `.env` Files

In the `webapp` directory, create the following files:

*   **.env.development**: For local development.
*   **.env.production**: For the live production environment.
*   **.gitignore**: Update it to ignore all `.env` files to prevent committing them.

**`webapp/.env.development`**
```
# Local development environment
API_BASE_URL=http://localhost:5001/splitifyd/us-central1/api
FIREBASE_EMULATOR_HOST=http://localhost
FIREBASE_AUTH_EMULATOR_PORT=9099
```

**`webapp/.env.production`**
```
# Production environment
API_BASE_URL=/api
# In production, we don't use emulators, so these can be empty or omitted
FIREBASE_EMULATOR_HOST=
FIREBASE_AUTH_EMULATOR_PORT=
```

**`webapp/.gitignore`** (ensure this line is present)
```
# Environment variables
.env.*
```

### Step 2: Create a Script to Load Environment Variables

Create a new file: `webapp/js/env-loader.js`

```javascript
// webapp/js/env-loader.js

async function loadEnv() {
  // In a real build system, this would be replaced by process.env.NODE_ENV
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const env = isLocal ? 'development' : 'production';

  try {
    const response = await fetch(`/webapp/.env.${env}`);
    if (!response.ok) {
      throw new Error(`Failed to load .env.${env} file.`);
    }
    const text = await response.text();
    const lines = text.split('\n');
    
    window.env = window.env || {};

    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        window.env[key.trim()] = value.trim();
      }
    });
  } catch (error) {
    console.error('Error loading environment variables:', error);
    // Fallback or default values can be set here if needed
    window.env = {
        API_BASE_URL: '/api',
        FIREBASE_EMULATOR_HOST: '',
        FIREBASE_AUTH_EMULATOR_PORT: ''
    };
  }
}

// We need to block until the environment is loaded.
// A better approach with a bundler would be to have these values at build time.
await loadEnv();
```

### Step 3: Update HTML to Load the Environment Script

In all your HTML files (`index.html`, `dashboard.html`, etc.), include the `env-loader.js` script **before** any other application scripts.

```html
<!-- In <head> or at the start of <body> -->
<script src="js/env-loader.js"></script>
<!-- Other scripts follow -->
<script src="js/firebase-config.js"></script>
<script src="js/config.js"></script>
...
```

### Step 4: Refactor `firebase-config.js` and `config.js`

Update the existing configuration files to use the variables from `window.env`.

**`webapp/js/config.js` (Refactored)**

```javascript
class Config {
    constructor() {}

    async getApiUrl() {
        return window.env.API_BASE_URL;
    }

    getApiUrlSync() {
        return window.env.API_BASE_URL;
    }

    isLocalEnvironment() {
        return !!window.env.FIREBASE_EMULATOR_HOST;
    }

    async getConfig() {
        if (!window.firebaseConfigManager.isInitialized()) {
            await window.firebaseConfigManager.initialize();
        }
        return window.firebaseConfigManager.getConfig();
    }
}

const config = new Config();
```

**`webapp/js/firebase-config.js` (Refactored Snippets)**

Modify the `initialize` and `fetchFirebaseConfig` methods to use the new environment variables.

```javascript
// Inside FirebaseConfigManager class

    async initialize() {
        // ... (imports remain the same)
        
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        
        // Use the new env variables
        if (window.env.FIREBASE_EMULATOR_HOST && window.env.FIREBASE_AUTH_EMULATOR_PORT) {
            const authEmulatorUrl = `${window.env.FIREBASE_EMULATOR_HOST}:${window.env.FIREBASE_AUTH_EMULATOR_PORT}`;
            console.log(`🔧 Connecting to Firebase Auth emulator at ${authEmulatorUrl}`);
            connectAuthEmulator(this.auth, authEmulatorUrl, { disableWarnings: true });
        }
        
        // ... (rest of the method)
    }

    async fetchFirebaseConfig() {
        const configUrl = `${window.env.API_BASE_URL}/config`;
        console.log('Fetching Firebase configuration from:', configUrl);
        
        try {
            // ... (fetch logic remains the same)
            
            this.config = {
                firebaseConfig,
                apiUrl: window.env.API_BASE_URL,
                isLocal: !!window.env.FIREBASE_EMULATOR_HOST,
                formDefaults: firebaseConfig.formDefaults,
                warningBanner: firebaseConfig.warningBanner
            };
            
            return firebaseConfig;
            
        } catch (error) {
            // ... (error handling)
        }
    }

    // Remove isLocalEnvironment, getConfigUrl, getApiUrlForProject methods
    // as they are now handled by the env variables.
```

## Conclusion

This approach establishes a clean separation of configuration from code. It makes the application more robust, secure, and easier to manage across different environments. While the `env-loader.js` script is a temporary solution for a project without a build step, it provides the immediate benefits of environment-specific configurations and paves the way for a more advanced build system in the future.
