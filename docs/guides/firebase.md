# Firebase Development Guide

Concise rules for working with the Firebase emulator stack and the instance switching toolchain.

## Core Rules

- Never start or stop the emulator yourself; ask the user.
- Keep dev and prod behaviour identical—no environment-specific branches or hard-coded ports.
- Assume `npm run dev` is already running; refresh the browser after backend edits.

## Instance Selection & Config Files

- `__INSTANCE_NAME` identifies which Firebase environment you're working with: `dev1`, `dev2`, `dev3`, `dev4`, or `staging-1`.
- Each `firebase/functions/.env.instance*` contains Firebase client keys and dev form defaults. The `__INSTANCE_NAME` is included in each file.
- `npm run switch-instance <n>` (invoked by `dev1.sh` … `dev4.sh`) writes the instance name to `firebase/.current-instance`, symlinks (dev) or copies (staging) the template to `.env`, then regenerates `firebase/firebase.json` from port mappings in `instances.json`.
- Never edit `firebase.json`; it is always generated.
- `firebase/scripts/dev/start-with-data.ts` reads `__INSTANCE_NAME`, validates it's a dev instance, reads ports from the generated config, seeds policies, and provisions the default user.

## Runtime Config Consumers

- `firebase/functions/src/client-config.ts` owns env parsing; everything flows from `__INSTANCE_NAME`.
- `firebase/functions/src/firebase.ts` reads the same instance name to select admin credentials for dev or staging. Seeder scripts load `.env` before imports so production APIs are never hit accidentally.
- `/api/env` returns server environment diagnostics and is protected by `authenticateAdmin` middleware (system_admin only).

## Build & Deploy Pipeline

- `firebase/functions/scripts/conditional-build.js` reads `__INSTANCE_NAME` to determine compilation strategy: `dev1`-`dev4` use tsx wrappers (fast iteration), `staging-*` triggers full compilation.
- Deployments always use the service account key at `firebase/service-account-key.json` via `GOOGLE_APPLICATION_CREDENTIALS`. Clear any interactive Firebase login (`firebase logout` or remove `~/.config/configstore/firebase-tools.json`) to avoid credential conflicts.
- `firebase/functions/src/firebase.ts` lazily loads `.env` if `__INSTANCE_NAME` is missing so Cloud Functions analysis gets the right settings.
- If you run deploy commands with a service account, grant it the following:
  - **Firebase Admin** (`roles/firebase.admin`) – deploy functions, rules, and hosting
  - **Firebase Rules Admin** (`roles/firebaserules.admin`) – publish Firestore security rules
  - **Service Account User** (`roles/iam.serviceAccountUser`) – let the deploy impersonate the runtime service account (default is `PROJECT_NUMBER-compute@developer.gserviceaccount.com`)
  - **Cloud Scheduler Admin** (`roles/cloudscheduler.admin`) – manage scheduled Cloud Functions triggers
  - Run `bash firebase/scripts/deployment/grant-deploy-roles.sh` from the repo root (pass a custom email if you use a different service account) to apply all bindings in one shot.

## Deployment

There are two deployment approaches:

### Fresh Checkout Deployment (Recommended for CI/CD)

Use `npm run deploy:all` (or `deploy:functions`, `deploy:hosting`, etc.) from `firebase/` directory. This:
1. Clones the repo to a temp directory (ensures clean state)
2. Installs dependencies fresh
3. Builds everything with `__INSTANCE_NAME=staging-1`
4. Stages functions with tarball'd shared packages
5. Deploys via Firebase CLI
6. Cleans up temp directory

**When to use:** CI/CD pipelines, release deployments, when you want guaranteed reproducibility.

### Direct Deployment (Quick iteration)

Use `bash scripts/deployment/deploy-staging.sh [target]` from `firebase/` directory. This:
1. Switches to staging-1 instance
2. Builds and stages functions in-place
3. Deploys via Firebase CLI

**When to use:** Quick fixes, testing deployment changes, when you trust your local state.

### Deployment Targets

| Target | Command | What it deploys |
|--------|---------|-----------------|
| `all` | `npm run deploy:all` | Functions, Firestore rules, Hosting |
| `functions` | `npm run deploy:functions` | Cloud Functions only |
| `hosting` | `npm run deploy:hosting` | Static webapp only |
| `rules` | `npm run deploy:rules` | Firestore security rules only |
| `indexes` | `npm run deploy:indexes` | Firestore indexes only |

### Prerequisites

Before deploying, ensure you have:

1. **Service account key** at `firebase/service-account-key.json`
2. **Staging environment config** at `firebase/functions/.env.instancestaging-1` (copy from `.env.firebase.example` and fill in real values)
3. **Service account permissions** (run `bash firebase/scripts/deployment/grant-deploy-roles.sh`)

### Post-Deployment

After deploying, run these operations as needed:

```bash
# Sync tenant configurations
npm run postdeploy:sync-tenant

# Seed policy documents
npm run seed-policies:staging-1

# Promote a user to admin
bash scripts/staging-operations.sh promote-admin user@example.com system_admin
```

## Ports, URLs, and Tests

- Fetch webapp URL with `npm run get-webapp-url`; tests can import `test-support/firebase-emulator-client-config.ts`.
- Firebase integration tests live in `firebase/functions`; run `npm run test:integration` from that directory.
- Logs land in `firebase/*.log`, with `firebase/firebase-debug.log` as the primary stream.
