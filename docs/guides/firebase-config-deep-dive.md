# Firebase Config Deep Dive

This note captures the current Firebase configuration workflow, the moving pieces that feed it, and the problems spotted while digging through the codebase. Use it as a starting point for any cleanup or refactors.

## Local Environments

- The root scripts `dev1.sh` … `dev4.sh` call `scripts/dev-common.sh`. That helper kills any running emulators, runs `npm run switch-instance <n>` from the `firebase` project, then executes the monorepo `npm run dev` pipeline.
- Each instance-specific env template (for example `firebase/functions/.env.instance1`) now carries an explicit `INSTANCE_MODE` (`dev1`, `dev2`, etc.) alongside logging flags and the `EMULATOR_*` port assignments. Multiple checkouts can run side by side without clashing.
- Production uses `firebase/functions/.env.instanceprod`, which sets `INSTANCE_MODE=prod` and the Firebase client credentials exposed through `/api/config`. Emulator ports are omitted on purpose.

## Instance Switching Workflow

- `firebase/scripts/switch-instance.ts` copies the requested template into `firebase/functions/.env`, validates that `INSTANCE_MODE` matches the selected instance, then runs `firebase/scripts/generate-firebase-config.ts`.
- `generate-firebase-config` fills `firebase/firebase.json` from `firebase/firebase.template.json`. It keys entirely off `INSTANCE_MODE` (rather than `FUNCTIONS_SOURCE`) to decide between emulator and production rules, and refuses to continue if the mode flag is missing or inconsistent.
- `firebase/scripts/start-with-data.ts` is the entry point for the emulator stack. It now enforces that `INSTANCE_MODE` is one of the dev variants before loading ports from the generated `firebase.json`, seeding policies, and preparing the default test user.
- `firebase/functions/scripts/conditional-build.js` still bifurcates between TypeScript-on-the-fly and compiled builds, but production or test builds are triggered explicitly via `BUILD_MODE`. The dev wrapper also preloads `.env` so emulator launches always see `INSTANCE_MODE`.

## Runtime Config Consumption

- `firebase/functions/src/client-config.ts` is the single source of truth for environment settings. The Zod schema requires `INSTANCE_MODE` and derives `isProduction` from it, cascading through `getConfig`, `getAppConfig`, and `getIdentityToolkitConfig`.
- `firebase/functions/src/firebase.ts` relies on the same `INSTANCE_MODE` flag to distinguish emulator (`dev*`), production (`prod`), and Vitest scenarios (`test`), applying the correct Firebase Admin configuration for each. Seeder scripts load `.env` before importing modules to avoid production calls during emulator startup.
- `/api/env` is now guarded: `firebase/functions/src/index.ts` only registers the endpoint when `INSTANCE_MODE` points at a dev instance, keeping environment details out of any deployed build.

## Remaining Considerations

- The toolchain still depends on `GCLOUD_PROJECT` being exported before launching the emulator workflow (`firebase/scripts/start-with-data.ts`). Documenting or automating that export would close the loop for new contributors, but functionally the Firebase config story is now driven entirely by `INSTANCE_MODE`.
