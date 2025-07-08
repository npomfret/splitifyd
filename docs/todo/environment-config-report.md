# Rationale and Implementation Guide for Environment-Specific Configurations

## 1. Rationale: Why We Need Environment-Specific Configurations

The current system determines the environment (local vs. production) on the client-side by checking `window.location.hostname`. While functional, this approach has several drawbacks:

*   **Brittleness:** It tightly couples the frontend code to network details. If the local development domain changes or a staging environment is introduced, the code must be updated.
*   **Lack of Scalability:** It only accounts for two states: "local" and "not local" (production). This makes it difficult to add other environments like `staging`, `testing`, or `feature-specific` backends without adding more conditional logic.
*   **Security Risk:** Hardcoding or deriving production values on the client-side increases the risk of misconfiguration. A mistake could lead to a development build accidentally pointing to production services, potentially corrupting production data.
*   **Inflexibility:** It makes it hard to test the production-built frontend against a local backend, a common scenario for debugging.

By adopting a formal system for environment variables, we can create a more professional, secure, and flexible application.

### Benefits of an Environment-Based Approach:

1.  **Decoupling:** The frontend code becomes environment-agnostic. The same code artifact can be pointed to different backends simply by changing the environment configuration.
2.  **Security:** Sensitive information like API keys or specific project IDs for a production environment are not part of the committed source code. They are injected at build or deploy time.
3.  **Scalability:** It's trivial to add new environments (`staging`, `qa`, etc.) by simply creating a new configuration file for them.
4.  **Developer Experience:** Developers can easily switch between different backend environments without modifying the core application code.

## 2. Implementation Guide

We will use a common pattern with `.env` files to manage environment variables.

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

Since the project doesn't have a build step that would typically handle `.env` files (like Vite or Webpack), we will create a small script that loads these variables and makes them available to the application at runtime.

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

Now, update the existing configuration files to use the variables from `window.env`.

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

## 3. Conclusion

This approach establishes a clean separation of configuration from code. It makes the application more robust, secure, and easier to manage across different environments. While the `env-loader.js` script is a temporary solution for a project without a build step, it provides the immediate benefits of environment-specific configurations and paves the way for a more advanced build system in the future.
