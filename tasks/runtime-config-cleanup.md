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

### 2. Introduce Shared Config Loader (partially complete)

**Create `firebase/shared/config.ts`:**
- Located in `firebase/shared/` (peer to `functions/` and `scripts/`)
- Exposes `getRuntimeConfig()` and `getInstanceEnvironment()` wrappers over existing Zod schema
- Single authoritative source for runtime env validation
- Can be imported cleanly by both functions and scripts without bootstrap ordering issues

**Update consuming code:**
- `start-with-data.ts`
- `firebase-init.ts`
- Policy seeders
- Delete-data scripts
- Vitest global setup (`firebase/functions/vitest.global-setup.ts`)
- Replace manual `.env` parsing with centralized loader

### 3. Clarify BUILD_MODE vs INSTANCE_MODE Responsibilities

**Documentation updates:** (pending)
- `docs/guides/building.md`: `BUILD_MODE` strictly controls emitted artifacts (conditional-build, deploy)
- `docs/guides/firebase.md`: `INSTANCE_MODE` selects emulator/prod runtime behavior
- Add examples showing they are orthogonal concerns

**Add guardrails:**
- Log active modes at script startup
- Prevent scripts from inferring build behavior based on `.env` content

### 4. File Structure After Cleanup (target state)

```
firebase/
├── instances.json              # Port mappings (committed)
├── shared/
│   └── config.ts               # NEW: Shared runtime config loader
├── functions/
│   ├── .env.instance1          # MODIFIED: Runtime vars only
│   ├── .env.instance2          # MODIFIED: Runtime vars only
│   ├── .env.instance3          # MODIFIED: Runtime vars only
│   ├── .env.instance4          # MODIFIED: Runtime vars only
│   └── src/
│       ├── client-config.ts    # MODIFIED: Uses shared/config.ts
│       └── firebase.ts         # NO CHANGE: Already minimal
├── scripts/
│   ├── generate-firebase-config.ts  # MODIFIED: Reads instances.json
│   └── switch-instance.ts           # MODIFIED: Uses instances.json
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
