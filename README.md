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
