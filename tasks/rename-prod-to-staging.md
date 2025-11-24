# Rename "prod" to "staging-1" and Clarify Environment Terminology

## Goal

1. Rename the "prod" instance to "staging-1" (since there is no actual production environment yet)
2. Remove all references to "production" and "prod" when referring to this deployment
3. Clarify environment detection logic to use accurate terminology:
   - `isEmulator` / `isLocalDevelopment` for local Firebase emulator
   - `isDeployed` / `isRemote` for deployed Firebase (not "production")

## Current State Analysis

### Environment Structure
- **4 Development Instances** (Local Emulator): `dev1`, `dev2`, `dev3`, `dev4`
  - Each runs on different port ranges (6001-6006, 7001-7006, 8001-8006, 9001-9006)
  - Used for local development with Firebase Emulator Suite
- **1 "Production" Instance** (Actually Staging): `prod`
  - Currently deployed to Firebase project `splitifyd`
  - Ports set to -1 (not emulator-based)
  - **This is the only "real" Firebase deployment** and should be called "staging-1"

### Key Problems Identified

1. **Misleading naming**: The `prod` instance is not production-ready
2. **Confusing terminology**: Code uses "isProduction" to mean "is deployed to Firebase" (not local emulator)
3. **Type system**: `InstanceName = DevInstanceName | 'prod'` hardcodes "prod"
4. **Environment detection**: Terms like `isProduction` conflate deployment status with environment purpose

## Terminology Standards

### OLD (Incorrect)
- `isProduction` - meant "is deployed to Firebase" (confusing!)
- `isDev` - meant "is local emulator" (ambiguous!)
- `prod` instance name
- `PROD_MAX_*` constants

### NEW (Correct)
- `isEmulator` / `isLocalDevelopment` - running on local Firebase emulator
- `isDeployed` / `isRemote` - deployed to real Firebase (not local)
- `staging-1` instance name
- `STAGING_MAX_*` constants (or use generic `DEPLOYED_MAX_*`)

### Environment Detection Pattern
```typescript
// GOOD: Clear what we're detecting
const isEmulator = !!process.env.FUNCTIONS_EMULATOR;
const isDeployed = !isEmulator;

// BAD: Confuses deployment status with environment purpose
const isProduction = instanceName === 'prod'; // What does this mean?
const isDev = instanceName.startsWith('dev'); // Development or deployed?
```

## Files Requiring Changes

### Phase 1: Type System & Core Infrastructure

#### 1.1 `firebase/functions/src/shared/instance-name.ts`
**Current:**
```typescript
type DevInstanceName = `dev${number}`;
export type InstanceName = DevInstanceName | 'prod';
```

**Change to:**
```typescript
type DevInstanceName = `dev${number}`;
type StagingInstanceName = `staging-${number}`;
export type InstanceName = DevInstanceName | StagingInstanceName;

const DEV_NAME_PATTERN = /^dev[0-9]+$/;
const STAGING_NAME_PATTERN = /^staging-[0-9]+$/;

export function assertValidInstanceName(value: string | undefined): asserts value is InstanceName {
    if (typeof value === 'string' &&
        (DEV_NAME_PATTERN.test(value) || STAGING_NAME_PATTERN.test(value))) {
        return;
    }
    const allowed = 'dev<number>, staging-<number>';
    throw new Error(`INSTANCE_NAME must be one of ${allowed}. Received: ${value ?? 'undefined'}`);
}

export function isStagingInstanceName(name: InstanceName): name is StagingInstanceName {
    return STAGING_NAME_PATTERN.test(name);
}

// Remove getInstanceName() default of 'prod' - change to 'staging-1'
export function getInstanceName(): InstanceName {
    const name = process.env.INSTANCE_NAME;
    if (!name) {
        return 'staging-1';
    }
    assertValidInstanceName(name);
    return name;
}
```

### Phase 2: Configuration Files

#### 2.1 Rename Files
- `firebase/functions/.env.instanceprod` → `.env.instancestaging-1`
- `firebase/functions/.env.prod.example` → `.env.staging-1.example`

#### 2.2 `firebase/instances.json`
```json
{
  "dev1": { "instanceName": "dev1", "ports": { ... } },
  "dev2": { "instanceName": "dev2", "ports": { ... } },
  "dev3": { "instanceName": "dev3", "ports": { ... } },
  "dev4": { "instanceName": "dev4", "ports": { ... } },
  "staging-1": {
    "instanceName": "staging-1",
    "ports": {
      "ui": -1,
      "auth": -1,
      "functions": -1,
      "firestore": -1,
      "hosting": -1,
      "storage": -1
    }
  }
}
```

#### 2.3 Update .env file contents
In `.env.instancestaging-1`:
- Change `INSTANCE_NAME=prod` to `INSTANCE_NAME=staging-1`
- Update comments: "PRODUCTION" → "STAGING ENVIRONMENT"
- Update header: "# STAGING ENVIRONMENT VARIABLES FOR FIREBASE FUNCTIONS"

### Phase 3: Core Logic - Environment Detection

#### 3.1 `firebase/functions/src/client-config.ts`

**Lines to change:**
- Line 20: Default from `'prod'` to `'staging-1'`
- Line 97: Replace `const isProduction = name === 'prod';` with:
  ```typescript
  const isDeployed = isStagingInstanceName(name);
  ```
- Lines 100-107: Update variable from `isProduction` to `isDeployed`
- Line 116-117: Replace `DOCUMENT_CONFIG.PROD_MAX_STRING_LENGTH` with `DOCUMENT_CONFIG.DEPLOYED_MAX_STRING_LENGTH`
- Line 125: Replace `toDisplayName(isProduction ? '' : 'test')` with `toDisplayName(isDeployed ? '' : 'test')`
- Lines 143, 156: Replace `if (config.isProduction)` with `if (isDeployed)`
- Lines 197, 210, 214, 238: Replace all `config.isProduction` with appropriate deployment check

**Interface changes:**
```typescript
interface ClientConfig {
    instanceName: InstanceName;
    isDeployed: boolean; // Was: isProduction
    // ... rest unchanged
}
```

#### 3.2 `firebase/shared/scripts-config.ts`

**Changes:**
- Line 61, 66: Default from `'prod'` to `'staging-1'`
- Line 170: Replace `const isProduction = name === 'prod';` with:
  ```typescript
  const isDeployed = isStagingInstanceName(name);
  ```

**Interface changes:**
```typescript
export interface ScriptEnvironment {
    isEmulator: boolean;
    isDeployed: boolean; // Was: isProduction
    environment: 'EMULATOR' | 'DEPLOYED'; // Was: 'PRODUCTION'
    instanceName: InstanceName;
}
```

Return statement:
```typescript
return {
    isEmulator,
    isDeployed,
    environment: isEmulator ? 'EMULATOR' : 'DEPLOYED',
    instanceName: name,
};
```

#### 3.3 `firebase/functions/src/firebase.ts`

Search for `isProduction` or similar flags. Replace with:
```typescript
export function isEmulator(): boolean {
    return !!process.env.FUNCTIONS_EMULATOR;
}

export function isDeployed(): boolean {
    return !isEmulator();
}
```

#### 3.4 Other files with environment detection

**Files to review:**
- `firebase/functions/src/ApplicationFactory.ts`
- `firebase/functions/src/utils/middleware.ts`
- `firebase/functions/src/merge/ServiceConfig.ts`
- `firebase/functions/src/index.ts`
- `firebase/scripts/firebase-init.ts`

**Pattern to find and replace:**
```typescript
// OLD
const isProduction = instanceName === 'prod';
if (isProduction) { /* deployed behavior */ }

// NEW
const isDeployed = isStagingInstanceName(instanceName);
if (isDeployed) { /* deployed behavior */ }
```

### Phase 4: Scripts

#### 4.1 `firebase/scripts/switch-instance.ts`
- Line 19: Replace `instance !== 'prod'` with `!/^(staging-[0-9]+|[0-9]+)$/.test(instance)`
- Line 20-22: Update error message examples to include `staging-1`
- Line 35: Replace:
  ```typescript
  const expectedName = instance === 'prod' ? 'prod' : `dev${instance}`;
  ```
  With:
  ```typescript
  const expectedName = /^staging-/.test(instance) ? instance : `dev${instance}`;
  ```
- Line 42-44: Replace `instance === 'prod'` check
- Line 62: Replace `const isProduction = instanceName === 'prod';` with:
  ```typescript
  const isDeployed = isStagingInstanceName(instanceName);
  ```
- Line 75-86: Update variable name and messages from `isProduction` to `isDeployed`

#### 4.2 `firebase/scripts/deploy-from-fresh-checkout.ts`
- Line 11: `envTemplateName = '.env.instancestaging-1'`
- Line 35: Replace `(rawMode === undefined || rawMode === 'prod')` with `(rawMode === undefined || rawMode === 'staging-1')`
- Line 66: `INSTANCE_NAME: 'staging-1'`
- Update all comments mentioning "production" to say "staging" or "deployed environment"

#### 4.3 `firebase/scripts/prepare-functions-deploy.js`
- Line 13: `INSTANCE_NAME: 'staging-1'`
- Line 53: Script name if it changes
- Line 63: `.env.staging-1.example`
- Update comments

#### 4.4 `firebase/scripts/generate-firebase-config.ts`
- Line 23: Replace `const isProduction = instanceName === 'prod';` with:
  ```typescript
  const isDeployed = isStagingInstanceName(instanceName);
  ```
- Update usage throughout

#### 4.5 `firebase/scripts/delete-data.ts`
- Line 173: Replace check for `'prod'` with staging check
- Update error message

#### 4.6 `firebase/scripts/sync-tenant-configs.ts`
- Replace string flag "production" with "staging" or "deployed"
- Line 158: Update console message

#### 4.7 Other scripts to review:
- `firebase/scripts/list-users.ts`
- `firebase/scripts/seed-policies.ts`
- `firebase/scripts/promote-user-to-admin.ts`
- `firebase/scripts/setup-storage-bucket.ts`
- `firebase/scripts/validate-users.ts`

### Phase 5: Package.json Scripts

#### 5.1 `firebase/package.json`

**Replace script names and content:**
```json
{
  "deploy": "echo 'Use deploy:staging-1 for staging deployment'",
  "deploy:all": "npx tsx scripts/deploy-from-fresh-checkout.ts all",
  "deploy:staging-1:inner": "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account-key.json\" bash -c 'FUNCTIONS_SOURCE=.firebase/deploy/functions FUNCTIONS_PREDEPLOY=\"echo Build completed by prepare-functions-deploy.js\" tsx scripts/switch-instance.ts staging-1 && node scripts/prepare-functions-deploy.js && firebase deploy --only functions,firestore:rules,hosting && rm -f functions/.env'",
  "deploy:functions:inner": "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account-key.json\" bash -c 'FUNCTIONS_SOURCE=.firebase/deploy/functions FUNCTIONS_PREDEPLOY=\"echo Build completed by prepare-functions-deploy.js\" tsx scripts/switch-instance.ts staging-1 && node scripts/prepare-functions-deploy.js && firebase deploy --only functions && rm -f functions/.env'",
  "deploy:hosting:inner": "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account-key.json\" bash -c 'tsx scripts/switch-instance.ts staging-1 && firebase deploy --only hosting && rm -f functions/.env'",
  "deploy:rules:inner": "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account-key.json\" bash -c 'tsx scripts/switch-instance.ts staging-1 && firebase deploy --only firestore:rules && rm -f functions/.env'",
  "deploy:indexes:inner": "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account-key.json\" bash -c 'tsx scripts/switch-instance.ts staging-1 && firebase deploy --only firestore:indexes --force && rm -f functions/.env'",
  "postdeploy:sync-tenant": "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account-key.json\" bash -c 'tsx scripts/sync-tenant-configs.ts staging --default-only && rm -f functions/.env'",
  "seed-policies:staging-1": "tsx scripts/switch-instance.ts staging-1 && tsx scripts/seed-policies.ts staging && rm functions/.env"
}
```

### Phase 6: Constants

#### 6.1 Search for PROD_ prefixed constants

**Files to check:**
- `firebase/functions/src/constants.ts` (or wherever DOCUMENT_CONFIG is defined)

**Rename:**
- `PROD_MAX_STRING_LENGTH` → `DEPLOYED_MAX_STRING_LENGTH` (or `STAGING_MAX_STRING_LENGTH`)
- `PROD_MAX_PROPERTY_COUNT` → `DEPLOYED_MAX_PROPERTY_COUNT` (or `STAGING_MAX_PROPERTY_COUNT`)

### Phase 7: Tests

#### 7.1 Update test files

**Files to update:**
- `firebase/functions/src/__tests__/unit/config.test.ts`
- `firebase/functions/src/__tests__/integration/config.test.ts`
- `firebase/functions/src/__tests__/unit/env-config-validation.test.ts`
- `firebase/functions/src/__tests__/unit/config/instances-config.test.ts`

**Changes:**
- Replace assertions checking `instanceName === 'prod'` with staging-1 checks
- Update test fixtures using "prod" to "staging-1"
- Update mock environment variables
- Update test descriptions/comments

### Phase 8: Documentation

#### 8.1 Update documentation files
- `docs/guides/firebase.md`
- `docs/guides/testing.md`
- `docs/firebase-api-surface.md`
- `README.md` (if it mentions environments)
- Any other docs mentioning "production" or "prod" instance

**Replace:**
- "production environment" → "staging environment" or "deployed environment"
- "`prod` instance" → "`staging-1` instance"
- "production vs development" → "deployed vs local emulator"

#### 8.2 Update code comments

**Pattern to find:**
```typescript
// For production...
// In production mode...
// Production configuration...
```

**Replace with:**
```typescript
// For deployed (staging) environment...
// When deployed to Firebase...
// Deployed environment configuration...
```

## Execution Order (CRITICAL!)

1. **Phase 1**: Update type system in `instance-name.ts` - everything depends on this
2. **Phase 2**: Rename physical files and update configuration
3. **Phase 3**: Update core logic files (client-config.ts, scripts-config.ts, firebase.ts)
4. **Phase 4**: Update all scripts
5. **Phase 5**: Update package.json
6. **Phase 6**: Update constants
7. **Phase 7**: Update tests
8. **Phase 8**: Update documentation and comments
9. **Verification**: Run test suite and verify scripts work

## Deployment Strategy

1. **Test locally first**: Run all dev instances and ensure they work ✅
2. **Test switch-instance script**: Verify switching between dev1-4 and staging-1 ✅
3. **Deploy to staging**: Use updated deployment scripts
4. **Monitor**: Check that deployed functions have correct INSTANCE_NAME

## Post-Rename Verification Checklist

- [x] All TypeScript files compile without errors
- [x] `switch-instance.ts dev1` works
- [x] `switch-instance.ts staging-1` works
- [x] Unit tests pass
- [ ] Integration tests pass
- [ ] Deployment script runs (dry-run if possible)
- [x] Documentation is updated
- [x] No references to "prod" remain (except in git history)
- [x] No confusing "isProduction" flags remain (use isEmulator/isDeployed)
- [x] No defaults for environment configuration (INSTANCE_NAME, CLOUD_TASKS_LOCATION, FUNCTIONS_URL)
- [x] All .env files include CLOUD_TASKS_LOCATION and FUNCTIONS_URL
- [ ] Deployed Firebase Functions have INSTANCE_NAME=staging-1

## Future Considerations

When a real production environment is created:
1. Add `production-1` to the InstanceName type
2. Keep clear distinction: `staging-1`, `staging-2`, ... vs `production-1`, `production-2`, ...
3. Environment detection should remain: `isEmulator` vs `isDeployed` (deployment status is separate from environment purpose)
