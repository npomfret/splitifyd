# Firebase Development Guide

Concise rules for working with the Firebase emulator stack and the instance switching toolchain.

## Core Rules

- Never start or stop the emulator yourself; ask the user.
- Keep dev and prod behaviour identical—no environment-specific branches or hard-coded ports.
- Assume `npm run dev` is already running; refresh the browser after backend edits.

## Instance Modes & Config Files

- Each `firebase/functions/.env.instance*` declares `INSTANCE_MODE`, emulator ports, and logging flags. Prod uses `.env.instanceprod` (no emulator ports, `INSTANCE_MODE=prod`).
- `npm run switch-instance <n>` (invoked by `dev1.sh` … `dev4.sh`) copies the chosen template to `.env`, validates the mode, then regenerates `firebase/firebase.json` from `firebase/firebase.template.json`.
- Never edit `firebase.json`; it is always generated.
- `firebase/scripts/start-with-data.ts` requires a dev `INSTANCE_MODE`, reads ports from the generated config, seeds policies, and provisions the default user.

## Runtime Config Consumers

- `firebase/functions/src/client-config.ts` owns env parsing; everything flows from `INSTANCE_MODE`.
- `firebase/functions/src/firebase.ts` reads the same mode to select admin credentials for dev, prod, or Vitest (`test`). Seeder scripts load `.env` before imports so production APIs are never hit accidentally.
- `/api/env` is only mounted when running a dev instance.

## Build & Deploy Pipeline

- `firebase/functions/scripts/conditional-build.js` toggles between tsx wrappers (dev) and compiled output (production/tests) via `BUILD_MODE`.
- `npm run deploy:prod` runs `switch-instance prod`, rebuilds workspaces with `BUILD_MODE=production`, stages local tarballs for shared packages, installs production deps, and expects `lib/index.js` from `tsconfig.deploy.json`.
- `firebase/functions/src/firebase.ts` lazily loads `.env` if `INSTANCE_MODE` is missing so Cloud Functions analysis gets the right settings.
- Export `GCLOUD_PROJECT` before running the deploy pipeline; the tooling assumes it exists.
- If you run deploy commands with a service account, grant it the following:
  - **Firebase Admin** (`roles/firebase.admin`) – deploy functions, rules, and hosting
  - **Firebase Rules Admin** (`roles/firebaserules.admin`) – publish Firestore security rules
  - **Service Account User** (`roles/iam.serviceAccountUser`) – let the deploy impersonate the runtime service account (default is `PROJECT_NUMBER-compute@developer.gserviceaccount.com`)
  - **Cloud Scheduler Admin** (`roles/cloudscheduler.admin`) – manage scheduled Cloud Functions triggers
  - Run `bash firebase/scripts/grant-deploy-roles.sh` from the repo root (pass a custom email if you use a different service account) to apply all bindings in one shot.

## Ports, URLs, and Tests

- Fetch webapp URL with `npm run get-webapp-url`; tests can import `test-support/firebase-emulator-client-config.ts`.
- Firebase integration tests live in `firebase/functions`; run `npm run test:integration` from that directory.
- Logs land in `firebase/*.log`, with `firebase/firebase-debug.log` as the primary stream.
