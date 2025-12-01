# Firebase Development Guide

Concise rules for working with the Firebase emulator stack and the instance switching toolchain.

## Core Rules

- Never start or stop the emulator yourself; ask the user.
- Keep dev and prod behaviour identical—no environment-specific branches or hard-coded ports.
- Assume `npm run dev` is already running; refresh the browser after backend edits.

## Instance Selection & Config Files

- `INSTANCE_NAME` identifies which Firebase environment you're working with: `dev1`, `dev2`, `dev3`, `dev4`, or `prod`.
- Each `firebase/functions/.env.instance*` contains Firebase client keys and dev form defaults (NO instance name—that's derived from the filename).
- `npm run switch-instance <n>` (invoked by `dev1.sh` … `dev4.sh`) writes the instance name to `firebase/.current-instance`, copies the template to `.env` (injecting `INSTANCE_NAME`), then regenerates `firebase/firebase.json` from port mappings in `instances.json`.
- Never edit `firebase.json`; it is always generated.
- `firebase/scripts/start-with-data.ts` reads `INSTANCE_NAME`, validates it's a dev instance, reads ports from the generated config, seeds policies, and provisions the default user.

## Runtime Config Consumers

- `firebase/functions/src/client-config.ts` owns env parsing; everything flows from `INSTANCE_NAME`.
- `firebase/functions/src/firebase.ts` reads the same instance name to select admin credentials for dev or prod. Seeder scripts load `.env` before imports so production APIs are never hit accidentally.
- `/api/env` returns server environment diagnostics and is protected by `authenticateAdmin` middleware (system_admin only).

## Build & Deploy Pipeline

- `firebase/functions/scripts/conditional-build.js` reads `INSTANCE_NAME` to determine compilation strategy: `dev1`-`dev4` use tsx wrappers (fast iteration), `prod` triggers full compilation.
- `npm run deploy:prod` runs `switch-instance prod`, rebuilds workspaces with `INSTANCE_NAME=prod` (which triggers compilation), stages local tarballs for shared packages, installs production deps, and expects `lib/index.js` from `tsconfig.deploy.json`.
- If the Firebase CLI throws `Authentication Error: Your credentials are no longer valid` during deploy, clear the stale interactive login (`firebase logout` or remove `~/.config/configstore/firebase-tools.json`) so the CLI falls back to `firebase/service-account-key.json`.
- `firebase/functions/src/firebase.ts` lazily loads `.env` if `INSTANCE_NAME` is missing so Cloud Functions analysis gets the right settings.
- Project ID is read from `firebase/.firebaserc` - no need to set `GCLOUD_PROJECT`.
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
