# Runtime vs Build/Test Config Cleanup

## Findings

1. **Runtime config surface is tiny but buried inside the `.env.instanceX` templates.**  
   - `client-config.ts` is the single consumer that validates and caches `INSTANCE_MODE`, Firebase client keys, dev form defaults, and warning banners (`firebase/functions/src/client-config.ts:20-220`).  
   - `firebase.ts` only needs `INSTANCE_MODE`, `GCLOUD_PROJECT`, and the emulator host variables when running locally or under tests (`firebase/functions/src/firebase.ts:8-146`). Everything else in the `.env` templates (log levels, verbose flags, emulator port listings) is unused at runtime.
2. **Emulator port numbers live in `.env` only to regenerate `firebase.json`, but every other tool immediately shells back to `firebase.json`.**  
   - `scripts/switch-instance.ts` copies `.env.instanceX` to `.env` and then runs `generate-firebase-config.ts`, which reads the same `.env` to stamp ports into `firebase/firebase.json` (`firebase/scripts/switch-instance.ts:26-100`).  
   - All other scripts/tests call helpers in `@billsplit-wl/test-support` that re-read those ports from `firebase/firebase.json` (`packages/test-support/src/firebase-emulator-config.ts:1-220`). This round-trip makes `.env` look more complicated than it really is.
3. **Scripts scatter their own environment bootstrapping.**  
   - `start-with-data.ts`, `firebase-init.ts`, policy seeders, and delete-data scripts each load `.env`, assert `INSTANCE_MODE`, and manually wire `FIREBASE_*_EMULATOR_HOST` vars before calling shared helpers (`firebase/scripts/start-with-data.ts:86-205`, `firebase/scripts/firebase-init.ts:7-112`).  
   - Tests do something similar in Vitest global setup (`firebase/functions/vitest.global-setup.ts:1-50`). There is no single authoritative loader, so accidental drifts are common.
4. **Build/test knobs (`BUILD_MODE`) are handled by wrapper scripts, but docs/tools still conflate them with runtime state.**  
   - `scripts/test-wrapper.js` forces `BUILD_MODE=test` for integration suites, and deploy helpers set `BUILD_MODE=production` before staging artifacts (`scripts/test-wrapper.js:32-119`, `firebase/scripts/prepare-functions-deploy.js:11-140`).  
   - Because the same `.env` files also contain emulator metadata, it appears as if build/test behavior depends on them, which keeps confusing folks per the user report.

## High-Level Plan

1. **Separate runtime keys from emulator metadata.**  
   - Create a structured `firebase/instances.json` (or similar) that maps `dev1`…`dev4` to their port assignments. Update `generate-firebase-config.ts` to read from that JSON instead of `.env`, and delete the port entries from all `.env.instance*` files.  
   - Trim `.env.devinstance.example` to just the runtime strings (`INSTANCE_MODE`, form defaults, optional banner) so its intent is obvious.

2. **Introduce a shared config loader for scripts/tests.**  
   - Add a small module (e.g., `firebase/functions/src/shared/env-config.ts`) that exposes `getRuntimeConfig()` and `getInstanceEnvironment()` wrappers over the existing Zod schema. Scripts like `start-with-data.ts`, `firebase-init.ts`, policy seeding, and delete-data can import that instead of re-parsing `.env` manually.  
   - Update Vitest setup plus any TSX scripts to rely on that loader so we have exactly one place where runtime env validation happens.

3. **Clarify BUILD_MODE vs INSTANCE_MODE responsibilities.**  
   - Document in `docs/guides/building.md` + `docs/guides/firebase.md` that `BUILD_MODE` strictly controls emitted artifacts (conditional-build, deploy) while `INSTANCE_MODE` selects emulator/prod behavior.  
   - Add guardrails in `scripts/test-wrapper.js` (or a new helper) that log the active modes at startup, preventing future scripts from inferring build behavior based on `.env`.

4. **Revisit diagnostics exposure.**  
   - The `/env` endpoint and diagnostics helper still dump `process.env` in dev (`firebase/functions/src/endpoints/env.ts:1-23`, `firebase/functions/src/endpoints/diagnostics.ts:81-147`). Once runtime config is centralized, update those payloads to return only the curated config surface (e.g., `instanceMode`, warning banner) to avoid leaking unrelated build/test variables.

5. **(Pending Expert input)**  
   - We asked The Expert whether multi-tenant or CI flows require keeping emulator ports in `.env` or exposing extra runtime vars. Incorporate their feedback before executing the plan, but the current analysis suggests everything outside `client-config.ts`/`firebase.ts` can move elsewhere without affecting tenants or deploys.
