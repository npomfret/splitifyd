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

### 1. Separate Runtime Keys from Emulator Metadata

**Create `firebase/instances.json.example`:**
- Maps `dev1`…`dev4` (and `prod`) to their port assignments
- Port configuration must remain user-configurable (not calculated)
- Structure validation via unit tests

**Update `firebase/scripts/generate-firebase-config.ts`:**
- Read from `instances.json` instead of `.env` for port assignments
- Keep existing validation and error handling

**Clean up `.env.instance*` files:**
- **Remove:** All `EMULATOR_*_PORT` variables (move to `instances.json`)
- **Remove:** Dead logging variables (`LOG_LEVEL`, `STRUCTURED_LOGGING`, `INCLUDE_STACK_TRACE`, `VERBOSE_LOGGING`)
- **Keep:** Runtime-only variables:
  - `INSTANCE_MODE`
  - Firebase client keys (`CLIENT_API_KEY`, `CLIENT_AUTH_DOMAIN`, etc.)
  - `DEV_FORM_EMAIL` / `DEV_FORM_PASSWORD`
  - `WARNING_BANNER`

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

### 2. Introduce Shared Config Loader

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

**Documentation updates:**
- `docs/guides/building.md`: `BUILD_MODE` strictly controls emitted artifacts (conditional-build, deploy)
- `docs/guides/firebase.md`: `INSTANCE_MODE` selects emulator/prod runtime behavior
- Add examples showing they are orthogonal concerns

**Add guardrails:**
- Log active modes at script startup
- Prevent scripts from inferring build behavior based on `.env` content

### 4. File Structure After Cleanup

```
firebase/
├── instances.json.example      # NEW: Port mappings template
├── instances.json              # NEW: Actual port config (gitignored)
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
- Validate `instances.json` structure matches expected schema
- Validate all `.env.instance*` files contain only runtime variables
- Ensure no port variables leak into `.env` files
- Test `getRuntimeConfig()` returns correct values for each instance

**Integration smoke test:**
- `switch-instance.ts 1 && tsx scripts/start-with-data.ts`
- Verify connects to correct ports
- Verify all emulators start successfully
