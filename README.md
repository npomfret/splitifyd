# BillSplit

A white-label bill splitting webapp and service.

## Getting started

Create a firebase project and from it create `firbase/functions/.env` and add:

```
PROJECT_ID=<your-project-id>
CLIENT_API_KEY=
CLIENT_AUTH_DOMAIN=<your-project-id>.firebaseapp.com
CLIENT_STORAGE_BUCKET=<your-project-id>.firebasestorage.app
CLIENT_MESSAGING_SENDER_ID=
CLIENT_APP_ID=
CLIENT_MEASUREMENT_ID=
```

To run the server locally via the firebase emulator use one of the pre-defined emulator environments:

```
./dev1.sh
```

## Webapp Architecture

The webapp is a modern Preact-based SPA located in the `webapp-v2` directory. It's served directly from the Firebase emulator and provides a responsive, single-page application experience.

## Deployment

### Prerequisites

1. **Service account key** at `firebase/service-account-key.json`
2. **Staging environment config** at `firebase/functions/.env.instancestaging-1`
3. **Service account permissions**: `bash firebase/scripts/deployment/grant-deploy-roles.sh`

### Fresh Checkout Deployment (Recommended)

From `firebase/` directory:

```bash
npm run deploy:all        # Functions, Firestore rules, Hosting
npm run deploy:functions  # Cloud Functions only
npm run deploy:hosting    # Static webapp only
npm run deploy:rules      # Firestore security rules only
```

This clones the repo to a temp directory, builds with `__INSTANCE_NAME=staging-1`, and deploys via Firebase CLI.

### Direct Deployment (Quick iteration)

```bash
bash scripts/deployment/deploy-staging.sh [target]
```

Builds and deploys in-place. Use when you trust your local state.

### Post-Deployment

```bash
npm run postdeploy:sync-tenant                                              # Sync tenant configs
npm run seed-policies:staging-1                                             # Seed policy documents
bash scripts/deployment/staging-operations.sh promote-admin user@example.com system_admin  # Promote admin
```
