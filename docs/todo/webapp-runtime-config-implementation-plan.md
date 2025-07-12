# Webapp Runtime Configuration - Implementation Plan

This document provides detailed implementation steps for the webapp runtime configuration re-architecture.

## Overview

Transform the webapp configuration from a dual build-time/runtime approach to a pure runtime configuration system, while maintaining the existing firebase.json template generation for emulator port management.

## Phase 1: Preparation and Analysis (No Code Changes)

### 1.1 Configuration Audit

Create a comprehensive list of all configuration parameters:

**Task**: Create `docs/config-audit.md` documenting:
- All environment variables in `.env.instance*` files
- All build-time injected variables in webapp
- All runtime configuration fetched via `/api/config`
- Configuration used in tests
- Production-specific configuration

**Commands**:
```bash
# Find all env variable usage
grep -r "process.env" webapp/src
grep -r "declare const" webapp/src
grep -r "import.*env-loader" webapp/src

# Document current config endpoint response
curl http://localhost:5000/api/config | jq
```

### 1.2 Create Configuration Schema

**Task**: Define TypeScript interfaces for configuration

Create `shared/types/config.types.ts`:
```typescript
interface AppConfiguration {
  firebase: FirebaseConfig;
  api: ApiConfig;
  features: FeatureFlags;
  environment: EnvironmentConfig;
}

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

interface FeatureFlags {
  [key: string]: boolean;
}

interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isEmulator: boolean;
  warningBanner?: string;
  emulatorPorts?: {
    auth?: number;
    firestore?: number;
    functions?: number;
    hosting?: number;
  };
}
```

### 1.3 Test Coverage Assessment

**Task**: Ensure adequate test coverage for configuration code

```bash
# Check current test coverage
npm test -- --coverage firebase/functions/src/utils/config.ts
npm test -- --coverage webapp/src/js/config

# Document missing tests in docs/config-test-gaps.md
```

### 1.4 Create Migration Checklist

**Task**: Create `docs/config-migration-checklist.md` with:
- [ ] All developers notified of upcoming changes
- [ ] Backup of current configuration files
- [ ] List of CI/CD changes needed
- [ ] Rollback plan documented
- [ ] Success metrics defined

## Phase 2: Enhance Configuration Endpoint

### 2.1 Expand Config Response

**Location**: `firebase/functions/src/utils/config.ts`

**Current getFirebaseConfigResponse()**:
```typescript
export function getFirebaseConfigResponse() {
  const config = getConfig();
  return {
    firebaseConfig: config.firebaseConfig,
    formDefaults: getFormDefaults(),
    warningBanner: config.warningBanner,
  };
}
```

**Enhanced version**:
```typescript
export function getFirebaseConfigResponse(): AppConfiguration {
  const config = getConfig();
  const env = getEnvironment();
  
  return {
    firebase: config.firebaseConfig,
    api: {
      baseUrl: getApiBaseUrl(),
      timeout: 30000,
      retryAttempts: 3,
    },
    features: {
      // Add feature flags as needed
    },
    environment: {
      isDevelopment: env.isDevelopment,
      isProduction: env.isProduction,
      isEmulator: env.isEmulator,
      warningBanner: config.warningBanner,
      emulatorPorts: env.isEmulator ? {
        auth: getEmulatorPort('FIREBASE_AUTH_EMULATOR_HOST'),
        firestore: getEmulatorPort('FIRESTORE_EMULATOR_HOST'),
        functions: getEmulatorPort('FIREBASE_FUNCTIONS_EMULATOR_HOST'),
        hosting: getEmulatorPort('FIREBASE_HOSTING_EMULATOR_HOST'),
      } : undefined,
    },
    formDefaults: getFormDefaults(), // Maintain backward compatibility
  };
}
```

### 2.2 Add Configuration Validation

**Location**: `firebase/functions/src/middleware/validation.ts`

```typescript
import { z } from 'zod';

const ConfigResponseSchema = z.object({
  firebase: z.object({
    apiKey: z.string(),
    authDomain: z.string(),
    projectId: z.string(),
    storageBucket: z.string(),
    messagingSenderId: z.string(),
    appId: z.string(),
    measurementId: z.string().optional(),
  }),
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().positive(),
    retryAttempts: z.number().int().positive(),
  }),
  features: z.record(z.boolean()),
  environment: z.object({
    isDevelopment: z.boolean(),
    isProduction: z.boolean(),
    isEmulator: z.boolean(),
    warningBanner: z.string().optional(),
    emulatorPorts: z.object({
      auth: z.number().optional(),
      firestore: z.number().optional(),
      functions: z.number().optional(),
      hosting: z.number().optional(),
    }).optional(),
  }),
});

export function validateConfigResponse(config: unknown): AppConfiguration {
  return ConfigResponseSchema.parse(config);
}
```

### 2.3 Add Caching Headers

**Location**: `firebase/functions/src/index.ts`

Update the `/api/config` endpoint:
```typescript
app.get('/api/config', getPublicRateLimiter(), (req, res) => {
  const config = getFirebaseConfigResponse();
  
  // Cache for 5 minutes in development, 1 hour in production
  const maxAge = config.environment.isDevelopment ? 300 : 3600;
  res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
  
  res.json(config);
});
```

### 2.4 Add Comprehensive Tests

**Location**: `firebase/functions/src/utils/config.test.ts`

```typescript
describe('Enhanced Config Response', () => {
  test('should include all required fields', () => {
    const config = getFirebaseConfigResponse();
    expect(config).toHaveProperty('firebase');
    expect(config).toHaveProperty('api');
    expect(config).toHaveProperty('features');
    expect(config).toHaveProperty('environment');
  });

  test('should detect emulator environment', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    const config = getFirebaseConfigResponse();
    expect(config.environment.isEmulator).toBe(true);
    expect(config.environment.emulatorPorts?.auth).toBe(9099);
  });

  test('should validate configuration schema', () => {
    const config = getFirebaseConfigResponse();
    expect(() => validateConfigResponse(config)).not.toThrow();
  });
});
```

## Phase 3: Webapp Configuration Simplification

### 3.1 Update Firebase Config Manager

**Location**: `webapp/src/js/firebase-config-manager.ts`

Remove build-time configuration merging and add better error handling:

```typescript
class FirebaseConfigManager {
  private config: AppConfiguration | null = null;
  private configPromise: Promise<AppConfiguration> | null = null;

  async getConfig(): Promise<AppConfiguration> {
    if (this.config) return this.config;
    
    if (!this.configPromise) {
      this.configPromise = this.fetchConfig();
    }
    
    this.config = await this.configPromise;
    return this.config;
  }

  private async fetchConfig(): Promise<AppConfiguration> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/config', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Config fetch failed: ${response.status}`);
        }

        const config = await response.json();
        return config as AppConfiguration;
      } catch (error) {
        lastError = error as Error;
        console.error(`Config fetch attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    throw new Error(`Failed to fetch config after ${maxRetries} attempts: ${lastError?.message}`);
  }

  clearCache(): void {
    this.config = null;
    this.configPromise = null;
  }
}

export const firebaseConfigManager = new FirebaseConfigManager();
```

### 3.2 Update Firebase Initialization

**Location**: `webapp/src/js/firebase-init.ts`

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { firebaseConfigManager } from './firebase-config-manager';

export async function initializeFirebase() {
  try {
    const config = await firebaseConfigManager.getConfig();
    
    // Initialize Firebase
    const app = initializeApp(config.firebase);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const functions = getFunctions(app);

    // Connect to emulators if in development
    if (config.environment.isEmulator && config.environment.emulatorPorts) {
      const ports = config.environment.emulatorPorts;
      
      if (ports.auth) {
        connectAuthEmulator(auth, `http://localhost:${ports.auth}`);
      }
      if (ports.firestore) {
        connectFirestoreEmulator(db, 'localhost', ports.firestore);
      }
      if (ports.functions) {
        connectFunctionsEmulator(functions, 'localhost', ports.functions);
      }
    }

    // Store API base URL globally
    window.__API_BASE_URL__ = config.api.baseUrl;

    return { app, auth, db, functions };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
}
```

### 3.3 Remove Build-Time Configuration

**Task 1**: Update `webapp/esbuild.config.js`

Remove all environment variable injection:
```javascript
// Remove this section:
// const envPlugin = {
//   name: 'env',
//   setup(build) {
//     build.onResolve({ filter: /^env$/ }, args => ({
//       path: args.path,
//       namespace: 'env-ns',
//     }));
//     build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
//       contents: JSON.stringify(filteredEnv),
//       loader: 'json',
//     }));
//   },
// };
```

**Task 2**: Delete `webapp/src/js/utils/env-loader.ts`

```bash
rm webapp/src/js/utils/env-loader.ts
```

**Task 3**: Update all imports of env-loader

```bash
# Find all files importing env-loader
grep -r "env-loader" webapp/src

# Update each file to use firebaseConfigManager instead
```

### 3.4 Update API Client

**Location**: `webapp/src/js/api/client.ts`

```typescript
import { firebaseConfigManager } from '../firebase-config-manager';

class ApiClient {
  private async getBaseUrl(): Promise<string> {
    const config = await firebaseConfigManager.getConfig();
    return config.api.baseUrl;
  }

  async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
}

export const apiClient = new ApiClient();
```

## Phase 4: Cleanup and Documentation

### 4.1 Remove Obsolete Code

```bash
# Remove env-loader references
find webapp/src -type f -name "*.ts" -o -name "*.js" | xargs grep -l "env-loader" | xargs rm -f

# Clean up unused build configurations
```

### 4.2 Update Documentation

**Task**: Update the following documents:
- `README.md` - Remove build-time configuration references
- `docs/development-setup.md` - Update configuration instructions
- `docs/configuration-guide.md` - Create comprehensive config guide

### 4.3 Update CI/CD

**GitHub Actions**: `.github/workflows/*.yml`
- Remove build-time environment variable injection
- Ensure `/api/config` is accessible during builds

### 4.4 Create Migration Guide

**Location**: `docs/config-migration-guide.md`

```markdown
# Configuration Migration Guide

## What Changed
- Webapp no longer uses build-time environment variables
- All configuration comes from `/api/config` endpoint
- No need to rebuild webapp for config changes

## Migration Steps for Developers
1. Pull latest changes
2. Run `npm run super-clean`
3. Run `npm install`
4. Start dev server as usual with `npm run dev`

## Troubleshooting
- If webapp fails to start: Check `/api/config` endpoint is accessible
- If wrong config loaded: Clear browser cache
- If emulators not connecting: Check firebase.json has correct ports
```

## Phase 5: Validation and Rollout

### 5.1 Test in All Environments

```bash
# Test each instance
npm run switch-instance 1 && npm run dev
# Verify config loads correctly

npm run switch-instance 2 && npm run dev
# Verify config loads correctly

npm run switch-instance 3 && npm run dev
# Verify config loads correctly
```

### 5.2 Performance Testing

```javascript
// Add performance monitoring
const startTime = performance.now();
await firebaseConfigManager.getConfig();
const loadTime = performance.now() - startTime;
console.log(`Config loaded in ${loadTime}ms`);
```

### 5.3 Error Scenario Testing

- Test with config endpoint down
- Test with slow network
- Test with invalid config response
- Test with CORS issues

### 5.4 Production Deployment Checklist

- [ ] All tests passing
- [ ] Config endpoint load tested
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team notified

## Success Metrics

- [ ] Webapp loads config in < 500ms (development)
- [ ] Webapp loads config in < 200ms (production with cache)
- [ ] Zero build-time environment variables in webapp bundle
- [ ] All emulator instances work correctly
- [ ] No increase in error rates
- [ ] Positive developer feedback

## Next Steps

After successful implementation:
1. Consider adding configuration versioning
2. Implement configuration hot-reload for development
3. Add configuration validation UI for admins
4. Explore Firebase Remote Config for feature flags