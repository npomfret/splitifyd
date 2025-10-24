# Firebase Config Deep Dive

This note captures the current Firebase configuration workflow, the moving pieces that feed it, and the problems spotted while digging through the codebase. Use it as a starting point for any cleanup or refactors.

## Local Environments

- The root scripts `dev1.sh` … `dev4.sh` call `scripts/dev-common.sh`. That helper kills any running emulators, runs `npm run switch-instance <n>` from the `firebase` project, then executes the monorepo `npm run dev` pipeline.
- Each local instance owns a dedicated env template (for example `firebase/functions/.env.instance1`). These files define `NODE_ENV=development`, logging flags, and a unique set of `EMULATOR_*` ports so multiple checkouts can run in parallel.
- Production uses `firebase/functions/.env.instanceprod`. It only publishes the client Firebase credentials that the `/api/config` endpoint serves to the webapp—no emulator ports are defined there.

## Instance Switching Workflow

- `firebase/scripts/switch-instance.ts` copies the selected template into `firebase/functions/.env`, warns before overwriting, loads the values with `dotenv`, then runs `firebase/scripts/generate-firebase-config.ts`.
- `generate-firebase-config` fills `firebase/firebase.json` from `firebase/firebase.template.json`. It decides whether the build is “production” by checking if `FUNCTIONS_SOURCE` is set to something other than the default `functions`. When the branch is considered dev, the script expects every `EMULATOR_*` port to be present in the env file.
- `firebase/scripts/start-with-data.ts` is the entry point the emulator stack uses. It requires `GCLOUD_PROJECT` to be exported in the shell up-front, insists that `NODE_ENV` is unset, reloads the `.env` file, pulls port numbers from the freshly generated `firebase.json`, and seeds default data once the emulators are live.
- `firebase/functions/scripts/conditional-build.js` handles the dual “run TS directly with tsx” vs “compile for deployment” behaviour. If `NODE_ENV` is `production` (or `test`) it shells out to `npm run build:prod`; otherwise it generates a lightweight wrapper that lets the emulator execute TypeScript without compiling.

## Runtime Config Consumption

- `firebase/functions/src/client-config.ts` is the central access point for env-derived values. It parses `process.env` with a Zod schema, memoises the result, and exposes:
  - `getConfig()` – internal flags and validation limits.
  - `getAppConfig()` – the object returned to the webapp via `/api/config`.
  - `getIdentityToolkitConfig()` – credentials for Firebase Identity Toolkit calls.
- `firebase/functions/src/firebase.ts` is the only place the Admin SDK touches env vars. It detects emulator vs production vs test, enforces required values, and configures emulator hosts.
- `firebase/functions/src/index.ts` exposes `/api/env` (environment dump for debugging) and `/api/config` (client-facing config). The debug endpoint is currently live for every environment.

## Problems Observed

- `generate-firebase-config` never recognises the prod template: `.env.instanceprod` does not set `FUNCTIONS_SOURCE`, so the script remains in “dev” mode, demands emulator ports that do not exist, and fails. That blocks `npm run switch-instance prod` and—by extension—`npm run deploy:prod`.
- `conditional-build.js` shells out to `npm run build:prod`, but `firebase/functions/package.json` does not define that script. The first production build attempt therefore halts with a missing-script error.
- The generated `firebase/firebase.json` is tracked in git. Every time a developer runs `switch-instance`, the file gets overwritten with their local port layout, leaving a dirty working tree and increasing the odds of committing environment-specific config.
- `/api/env` is still available in the prod branch of the code, so a real deployment would leak every environment variable and various filesystem details.
- `firebase/scripts/start-with-data.ts` asserts that `NODE_ENV` is `undefined`. That conflicts with the rest of the tooling, which does set `NODE_ENV=development` for the emulator workflow.
- `client-config.ts` accepts only `127.0.0.1` for `FIRESTORE_EMULATOR_HOST`, but the generated `.env.instance*` values use `0.0.0.0:<port>` when provided by the emulator. The wrapper works today because the env file is cached, yet the validation is brittle.

## Improvement Ideas

| Priority | Item | Notes |
| --- | --- | --- |
| P1 | Add a real production build script for functions (or invoke `tsc` directly) | Fixes the missing `npm run build:prod` path that `conditional-build.js` expects. |
| P1 | Stop committing the generated `firebase/firebase.json` | Add to `.gitignore` or redirect output so instance switches stop dirtying git state. |
| P2 | Relax `start-with-data.ts` to allow `NODE_ENV=development` | Removes friction during emulator startup without affecting prod. |
| P2 | Broaden Firestore emulator host validation (`localhost`/`0.0.0.0`/`127.0.0.1`) | Avoid brittle checks when the emulator supplies different hosts. |
| P3 | Add a dedicated `INSTANCE_MODE=dev|prod` flag and use it across scripts/config loaders | Longer-term cleanup that clarifies intent once critical issues are fixed. |
