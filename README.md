# Splitifyd

A bill splitting app.

View the [docs](docs) for details on features, todo, dev stuff etc.

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
cd firebase && npm run dev:with-data
```

In your browser go to http://localhost:5002/

To stop the emulator, just hit `ctrl-c`, but if it doesn't stop cleanly run `./scripts/kill-emulators.js`

## Deployment

Run `cd firebase && npm deploy:prod`