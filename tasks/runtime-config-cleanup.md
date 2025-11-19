# Runtime vs Build/Test Config Cleanup

## Context

This is a **greenfield cleanup** - no migration needed, no users to disrupt. Goal is clean separation of concerns and maintainability.

## Findings

1. **Runtime config surface is tiny but buried inside the `.env.instanceX` templates.**
   - `client-config.ts` is the single consumer that validates and caches `INSTANCE_MODE`, Firebase client keys, dev form defaults, and warning banners (`firebase/functions/src/client-config.ts:20-220`).
   - `firebase.ts` only needs `INSTANCE_MODE`, `GCLOUD_PROJECT`, and the emulator host variables when running locally or under tests (`firebase/functions/src/firebase.ts:8-146`).
   - **Logging variables** (`LOG_LEVEL`, `STRUCTURED_LOGGING`, `INCLUDE_STACK_TRACE`, `VERBOSE_LOGGING`) exist in `.env.instance*` files but are **not included in the `envSchema`** - they are dead code and should be removed.

2. **Emulator port numbers live in `.env` only to regenerate `firebase.json`, but every other tool immediately shells back to `firebase.json`.**
   - `scripts/switch-instance.ts` copies `.env.instanceX` to `.env` and then runs `generate-firebase-config.ts`, which reads the same `.env` to stamp ports into `firebase/firebase.json` (`firebase/scripts/switch-instance.ts:26-100`).
   - All other scripts/tests call helpers in `@billsplit-wl/test-support` that re-read those ports from `firebase/firebase.json` (`packages/test-support/src/firebase-emulator-config.ts:1-220`). This round-trip makes `.env` look more complicated than it really is.

3. **Scripts scatter their own environment bootstrapping.**
   - `start-with-data.ts`, `firebase-init.ts`, policy seeders, and delete-data scripts each load `.env`, assert `INSTANCE_MODE`, and manually wire `FIREBASE_*_EMULATOR_HOST` vars before calling shared helpers (`firebase/scripts/start-with-data.ts:86-205`, `firebase/scripts/firebase-init.ts:7-112`).
   - Tests do something similar in Vitest global setup (`firebase/functions/vitest.global-setup.ts:1-50`). There is no single authoritative loader, so accidental drifts are common.

4. **Build/test knobs (`BUILD_MODE`) are handled by wrapper scripts, but docs/tools still conflate them with runtime state.**
   - `scripts/test-wrapper.js` forces `BUILD_MODE=test` for integration suites, and deploy helpers set `BUILD_MODE=production` before staging artifacts (`scripts/test-wrapper.js:32-119`, `firebase/scripts/prepare-functions-deploy.js:11-140`).
   - Because the same `.env` files also contain emulator metadata, it appears as if build/test behavior depends on them, creating confusion.

## High-Level Plan

### 1. Separate Runtime Keys from Emulator Metadata ✅ COMPLETE

**Maintain `firebase/instances.json`:** ✅
- Maps `dev1`…`dev4` (and `prod`) to their port assignments (prod now uses `-1` placeholders)
- Port configuration remains explicit and user-editable
- Structure validation enforced via `firebase/functions/src/__tests__/unit/config/instances-config.test.ts`

**Instance Mode Types:**

| Instance Mode | Type | Description |
|--------------|------|-------------|
| `dev1` | firebase-emulator | Development instance 1 (ports 6001-6006) |
| `dev2` | firebase-emulator | Development instance 2 (ports 7001-7006) |
| `dev3` | firebase-emulator | Development instance 3 (ports 8001-8006) |
| `dev4` | firebase-emulator | Development instance 4 (ports 9001-9006) |
| `prod` | firebase-actual | Production Firebase project |
| `test` | firebase-emulator | Test environment (configured by test setup) |

**Update `firebase/scripts/generate-firebase-config.ts`:** ✅
- Reads from `instances.json` for port assignments
- Keeps existing validation and error handling

**Clean up `.env.instance*` files:** ✅
- **Removed:** All `EMULATOR_*_PORT` variables (moved to `instances.json`)
- **Removed:** Dead logging variables (`LOG_LEVEL`, `STRUCTURED_LOGGING`, `INCLUDE_STACK_TRACE`, `VERBOSE_LOGGING`)
- **Kept:** Runtime-only variables:
  - `INSTANCE_MODE`
  - Firebase client keys (`CLIENT_API_KEY`, `CLIENT_AUTH_DOMAIN`, etc.)
  - `DEV_FORM_EMAIL` / `DEV_FORM_PASSWORD`
  - `WARNING_BANNER`

**Key Architectural Improvements:**

**Storage Dependency Injection:** ✅
- Added `IStorage` as third parameter to `ComponentBuilder` constructor
- Follows same pattern as `IFirestoreDatabase` and `IAuthService`
- Production: `ComponentBuilder.createComponentBuilder()` wraps real Firebase Storage
- Tests: Pass `StubStorage` directly to constructor
- **NO test-specific code paths** - same API for production and tests

**Eliminated Test Hacks:** ✅
- Removed `HandlerRegistryOptions.themeArtifactStorage` from `ApplicationFactory`
- Removed test-specific options parameter from `createHandlerRegistry()`
- AppDriver no longer manually creates `CloudThemeArtifactStorage`
- All dependencies flow through `ComponentBuilder.buildThemeArtifactStorage()`

**Environment Variable Isolation:** ✅
- `CloudThemeArtifactStorage` constructor accepts `storageEmulatorHost` parameter
- Default reads from `process.env.FIREBASE_STORAGE_EMULATOR_HOST` in production
- Tests inject explicit `null` (production URLs) or `'localhost:9199'` (emulator URLs)
- **Zero `process.env` manipulation in unit tests**

**Files Updated:**
- `ComponentBuilder.ts` - Added storage parameter and `buildThemeArtifactStorage()` method
- `CloudThemeArtifactStorage.ts` - Constructor injection for emulator host
- `ThemeArtifactStorage.ts` - Factory supports config object with storage + emulatorHost
- `ApplicationFactory.ts` - Removed `HandlerRegistryOptions`, uses builder pattern
- `AppDriver.ts` - Clean DI, no special test paths
- `ComponentBuilderSingleton.ts` - Added `getStorage()` call
- All middleware files - Updated to pass storage to builder
- `seed-policies.ts` - Updated script to include storage parameter
- 15+ test files - All pass `StubStorage` to `ComponentBuilder`

**Simplified `.env.instance1` after cleanup:**
```bash
# Runtime configuration
INSTANCE_MODE=dev1

# Firebase client keys
CLIENT_API_KEY=...
CLIENT_AUTH_DOMAIN=...
CLIENT_STORAGE_BUCKET=...
CLIENT_MESSAGING_SENDER_ID=...
CLIENT_APP_ID=...
CLIENT_MEASUREMENT_ID=...

# Dev helpers
DEV_FORM_EMAIL=test1@test.com
DEV_FORM_PASSWORD=passwordpass
WARNING_BANNER=instance-1
```

### 2. Introduce Shared Config Loader ✅ COMPLETE

**Created `firebase/shared/scripts-config.ts`:** ✅
- Located in `firebase/shared/` (peer to `functions/` and `scripts/`)
- Exposes `loadRuntimeConfig()`, `getRuntimeConfig()`, and `getInstanceEnvironment()` functions
- Uses Zod schema for runtime environment validation
- Single authoritative source for runtime env validation in scripts
- Separate from `client-config.ts` which handles Firebase Functions runtime config

**Key Functions:**
- `loadEnvFile(path?)` - Loads .env file from firebase/functions (optional path)
- `loadRuntimeConfig(path?)` - Loads and validates runtime config (combines loadEnvFile + getRuntimeConfig)
- `getRuntimeConfig()` - Validates process.env against runtime schema
- `getInstanceEnvironment()` - Returns environment info (isEmulator, isProduction, etc.)
- `requireInstanceMode()` - Validates and returns INSTANCE_MODE

**Updated consuming code:** ✅
- `firebase-init.ts` - Uses `loadRuntimeConfig()` and `getInstanceEnvironment()`
- `start-with-data.ts` - Uses `loadRuntimeConfig()` for validation
- `seed-policies.ts` - Uses `loadRuntimeConfig()` instead of manual dotenv
- `delete-data.ts` - Uses `loadRuntimeConfig()` and `getInstanceEnvironment()`
- `generate-firebase-config.ts` - Uses `loadRuntimeConfig()` for instance mode
- `switch-instance.ts` - Uses `loadEnvFile()` and `requireInstanceMode()`
- `validate-users.ts` - Uses `loadRuntimeConfig()`
- `generate-test-data.ts` - Uses `loadRuntimeConfig()`

**Benefits:**
- Eliminated 8 instances of manual `dotenv.config()` calls
- Centralized environment validation logic
- Consistent error messages across all scripts
- Single source of truth for runtime config schema
- Easier to maintain and extend

### 3. Eliminate BUILD_MODE - Use INSTANCE_MODE as Single Source of Truth ⚙️ IN PROGRESS

**Decision: Eliminate BUILD_MODE entirely**

After analysis, we found that BUILD_MODE is redundant with INSTANCE_MODE:

| INSTANCE_MODE | Compilation Strategy | Rationale |
|---------------|---------------------|-----------|
| `dev1-4` | tsx wrappers (no compile) | Fast iteration during local development |
| `test` | Full compile (tsc + esbuild) | Integration tests need production-like behavior |
| `prod` | Full compile (tsc + esbuild) | Production deployment requires compiled artifacts |

**This is a perfect 1:1 mapping** - we can derive compilation behavior directly from INSTANCE_MODE.

**Problems with BUILD_MODE:**
- ❌ Creates confusion - developers see two environment concepts (BUILD_MODE + INSTANCE_MODE)
- ❌ Requires manual setting in test runners and deployment scripts
- ❌ Not a true "mode" - it's derived from what instance you're working with
- ❌ Adds cognitive overhead - developers must understand both variables

**Benefits of Elimination:**
- ✅ **Single source of truth**: INSTANCE_MODE is the only environment variable developers interact with
- ✅ **Zero manual touchpoints**: `npm run switch-instance dev1` sets up everything
- ✅ **Simpler mental model**: One variable controls both runtime behavior AND compilation strategy
- ✅ **Fewer environment variables**: BUILD_MODE completely removed from codebase

**Developer Experience After Change:**

```bash
# Local development
npm run switch-instance dev1  # Sets INSTANCE_MODE=dev1 in .env
npm run dev                    # Automatically uses tsx (no compilation)

# Running tests
npm test                       # vitest.config.ts sets INSTANCE_MODE=test
                              # Tests automatically compile via INSTANCE_MODE

# Production deployment
# Fresh checkout sets INSTANCE_MODE=prod → automatic compilation
```

**Implementation Plan:**

**Phase 1: Eliminate BUILD_MODE** ✅ COMPLETE
**Phase 2: Rename INSTANCE_MODE → INSTANCE_NAME** ✅ COMPLETE
**Phase 3: Create .current-instance Architecture** ⚙️ IN PROGRESS

**Phase 1: Eliminate BUILD_MODE** ✅ COMPLETE
1. ✅ **Update `conditional-build.js`**: Read INSTANCE_MODE from .env instead of BUILD_MODE
2. ✅ **Remove BUILD_MODE from all scripts:** test-wrapper.js, prepare-functions-deploy.js, deploy-from-fresh-checkout.ts, run-test.sh
3. ⚙️ **Update documentation:** building.md, firebase.md

**Phase 2: Rename INSTANCE_MODE → INSTANCE_NAME** ⚙️ IN PROGRESS
- Rationale: "dev1", "dev2", "prod", "test" are instance identifiers, not "modes"
- More semantically accurate naming
- Files to rename/update:
  - `instance-mode.ts` → `instance-name.ts`
  - All references in scripts-config.ts, client-config.ts, vitest.config.ts
  - All script files, all documentation

**Phase 3: Introduce .current-instance Marker File** ⚙️ IN PROGRESS
- **Problem**: Instance name stored redundantly (filename `.env.instance1` AND content `INSTANCE_MODE=dev1`)
- **Solution**:
  - Create `firebase/.current-instance` file containing just "dev1" (no prefix)
  - Remove INSTANCE_NAME from `.env.instance*` template content
  - `switch-instance.ts` writes both `.current-instance` AND injects `INSTANCE_NAME` into `.env`
  - Scripts read from `.current-instance` file as source of truth

**Architecture After Cleanup:**

```
firebase/
├── instances.json              # Instance definitions (port mappings)
├── .current-instance           # Current active instance (e.g., "dev1") - gitignored
├── functions/
│   ├── .env                    # Runtime env (generated, gitignored)
│   ├── .env.instance1          # Template: Firebase keys only, NO INSTANCE_NAME
│   ├── .env.instance2          # Template: Firebase keys only
│   ├── .env.instance3          # Template: Firebase keys only
│   ├── .env.instance4          # Template: Firebase keys only
│   └── ...
└── scripts/
    └── switch-instance.ts      # Writes .current-instance + generates .env
```

**Changes:**

1. ⚙️ **Create `.current-instance` architecture:**
   - Add `firebase/.current-instance` to `.gitignore`
   - Initial file contains "dev1" (default)

2. ⚙️ **Remove INSTANCE_NAME from .env templates:**
   - Remove `INSTANCE_MODE=dev1` line from `.env.instance1`
   - Remove `INSTANCE_MODE=dev2` line from `.env.instance2`
   - Remove `INSTANCE_MODE=dev3` line from `.env.instance3`
   - Remove `INSTANCE_MODE=dev4` line from `.env.instance4`

3. ⚙️ **Update `switch-instance.ts`:**
   - Write instance name to `firebase/.current-instance`
   - Copy `.env.instanceX` to `.env`
   - Append `INSTANCE_NAME=<name>` to generated `.env`

4. ⚙️ **Update `scripts-config.ts`:**
   - Read `firebase/.current-instance` to determine active instance
   - Fall back to `process.env.INSTANCE_NAME` if file missing
   - Rename all INSTANCE_MODE → INSTANCE_NAME

5. ⚙️ **Rename throughout codebase:**
   - `instance-mode.ts` → `instance-name.ts`
   - Update all imports and references
   - `INSTANCE_MODE` → `INSTANCE_NAME` in all files
   - Update deployment scripts to set `INSTANCE_NAME=prod`

6. ⚙️ **Update all documentation:**
   - Replace INSTANCE_MODE → INSTANCE_NAME everywhere
   - Document `.current-instance` file architecture
   - Explain single source of truth design

**Files Being Modified:**
- `firebase/functions/scripts/conditional-build.js` ✅
- `scripts/test-wrapper.js` ✅
- `firebase/scripts/prepare-functions-deploy.js` ✅
- `firebase/scripts/deploy-from-fresh-checkout.ts` ✅
- `firebase/functions/run-test.sh` ✅
- `docs/guides/building.md` ⚙️
- `docs/guides/firebase.md` ⚙️
- `firebase/functions/src/shared/instance-mode.ts` → `instance-name.ts` ⚙️
- `firebase/shared/scripts-config.ts` ⚙️
- `firebase/functions/src/client-config.ts` ⚙️
- `firebase/functions/vitest.config.ts` ⚙️
- `firebase/scripts/switch-instance.ts` ⚙️
- `.env.instance1-4` templates ⚙️
- All script files referencing INSTANCE_MODE ⚙️

### 4. File Structure After Cleanup ✅ COMPLETE

```
firebase/
├── instances.json              # ✅ NEW: Port mappings (committed)
├── shared/
│   └── scripts-config.ts       # ✅ NEW: Shared runtime config loader for scripts
├── functions/
│   ├── .env.instance1          # ✅ MODIFIED: Runtime vars only (4 lines)
│   ├── .env.instance2          # ✅ MODIFIED: Runtime vars only (4 lines)
│   ├── .env.instance3          # ✅ MODIFIED: Runtime vars only (4 lines)
│   ├── .env.instance4          # ✅ MODIFIED: Runtime vars only (4 lines)
│   └── src/
│       ├── client-config.ts    # NO CHANGE: Functions runtime config (separate concern)
│       ├── shared/
│       │   └── instance-mode.ts # NO CHANGE: Type definitions and validators
│       └── firebase.ts         # NO CHANGE: Already minimal
├── scripts/
│   ├── generate-firebase-config.ts  # ✅ MODIFIED: Uses scripts-config.ts
│   ├── switch-instance.ts           # ✅ MODIFIED: Uses scripts-config.ts
│   ├── firebase-init.ts             # ✅ MODIFIED: Uses scripts-config.ts
│   ├── start-with-data.ts           # ✅ MODIFIED: Uses scripts-config.ts
│   ├── seed-policies.ts             # ✅ MODIFIED: Uses scripts-config.ts
│   ├── delete-data.ts               # ✅ MODIFIED: Uses scripts-config.ts
│   ├── validate-users.ts            # ✅ MODIFIED: Uses scripts-config.ts
│   └── generate-test-data.ts        # ✅ MODIFIED: Uses scripts-config.ts
```

### 5. Validation Strategy

**Unit tests:**
- Validate `instances.json` structure matches expected schema (✅)
- Validate all `.env.instance*` files contain only runtime variables
- Ensure no port variables leak into `.env` files
- Test `getRuntimeConfig()` returns correct values for each instance

**Integration smoke test:**
- `switch-instance.ts 1 && tsx scripts/start-with-data.ts`
- Verify connects to correct ports
- Verify all emulators start successfully

### 6. Symlink `.env` Instead of Copy (new task)

- Update `scripts/switch-instance.ts` (and any helper that writes `.env`) to use a symlink (`.env -> .env.instanceX`) rather than copying the file contents.
- Confirm `dotenv`, Firebase CLI, and deploy scripts behave correctly with the symlink.
- Provide a fallback (e.g., copy) for environments where symlinks aren't permitted, but prefer the symlink for clarity.

---

## Lessons Learned

### Core Principles Reinforced

**1. Dependency Injection Always, No Test-Specific Code Paths**
- ❌ **Wrong**: Optional parameters or special options objects for tests
- ✅ **Right**: Constructor injection with same signature for production and tests
- Example: `ComponentBuilder` constructor takes `IStorage`, tests pass `StubStorage`, production passes wrapped Firebase Storage

**2. Configuration via Constructor Parameters, Not Environment Variables**
- ❌ **Wrong**: Reading `process.env` inside class methods, manipulating env in tests
- ✅ **Right**: Accept config as constructor parameters with sensible defaults
- Example: `CloudThemeArtifactStorage(storage, storageEmulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST)`

**3. Builder Pattern for Complex Object Graphs**
- ❌ **Wrong**: Factories with optional parameters that vary by environment
- ✅ **Right**: Builder that manages all dependencies, consumers call `builder.buildX()`
- Example: `ComponentBuilder.buildThemeArtifactStorage()` constructs with all dependencies

**4. Tests Should Be Explicit About Behavior**
- ❌ **Wrong**: `delete process.env.FIREBASE_STORAGE_EMULATOR_HOST` in tests
- ✅ **Right**: `new CloudThemeArtifactStorage(stubStorage, null)` explicitly tests production URLs
- Benefits: Tests document expected behavior, no side effects on other tests

**5. Eliminate Mocks Through Architecture**
- ❌ **Wrong**: `vi.mock()` to intercept and replace dependencies
- ✅ **Right**: Design for dependency injection, pass real implementations (or stubs)
- Result: Went from 18 lines of mocks to zero by adding one constructor parameter

### Anti-Patterns Eliminated

**Test-Specific Options Objects:**
```typescript
// ❌ Before
interface HandlerRegistryOptions {
    themeArtifactStorage?: ThemeArtifactStorage;  // Only for tests
}
createHandlerRegistry(builder, { themeArtifactStorage: testStorage })
```

**Proper Dependency Injection:**
```typescript
// ✅ After
ComponentBuilder.buildThemeArtifactStorage()  // Same for tests and production
```

**Environment Variable Manipulation:**
```typescript
// ❌ Before
beforeEach(() => {
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
});
```

**Constructor Injection:**
```typescript
// ✅ After
const storage = new CloudThemeArtifactStorage(stubStorage, null);
```

### Impact

- **Code deleted**: ~30 lines of mocks, ~20 lines of env manipulation, test-specific options
- **Code added**: ~15 lines for constructor parameters, builder method
- **Net improvement**: Simpler, more explicit, zero test-specific paths
- **Tests**: Faster (no module mocking), clearer intent, better isolation
