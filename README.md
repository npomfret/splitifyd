# Splitifyd

A bill splitting app.

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

To run the server locally via the firebase emulator

```
npm run dev
```

To stop the emulator, just hit `ctrl-c`, but if it doesn't stop cleanly run `./scripts/kill-emulators.js`

## Webapp Architecture

The webapp is a modern Preact-based SPA located in the `webapp-v2` directory. It's served directly from the Firebase emulator and provides a responsive, single-page application experience.

### Development

```bash
# Start the full development environment (Firebase emulator + webapp)
npm run dev

# Build webapp only
npm run webapp-v2:build
```

The webapp is served from the Firebase emulator's hosting service.

## Deployment

Run `cd firebase && npm deploy:prod`
