# Firebase Development Guide

This guide covers the standards and workflow for developing with the Firebase Emulator Suite.

## Core Principles

- **Environment Parity**: The application MUST run identically in the local Firebase Emulator and in the deployed production Firebase environment. Avoid environment-specific code paths.
- **Emulator First**: The Firebase Emulator is the primary development and testing environment. Do not use the Vite dev server directly.
- NEVER kill or start the firebase emulator - always ask

## Environment Configuration

Our project supports multiple local Firebase instances to prevent configuration conflicts.

- **NEVER edit `firebase.json` directly.** This file is generated automatically.
- To change instance configurations, modify `firebase/firebase.template.json` and the environment files (e.g., `.env.instance1`, `.env.instance2`) located in `firebase/functions/`.
- The `switch-instance.sh` script uses these files to generate the final `firebase.json`.

### Ports and URLs

- **Never hard-code ports or URLs.**
- In the client-side code, the base API URL is injected into `window.API_BASE_URL` during the build step.
- To determine the correct ports for the running instance, inspect the generated `firebase/firebase.json` file.
- You can get the webapp's base URL for the active instance using: `npm run get-webapp-url`.
- In a test, use `test-support/firebase-emulator-config.ts` to get the local URL.

## Development Workflow

- **Emulator Status**: Always assume the emulator is already running via the `npm run dev` command. If you suspect it is not running, you must stop and ask the user to start it.
- **Restarting the Emulator**: If any changes are made to `firebase.template.json` or the `.env` files, the emulator must be restarted for the new `firebase.json` to take effect. You should ask the user to do this.
- **Auto-Reload**: The emulator automatically picks up most backend changes. However, you **must manually refresh the browser** to see the changes reflected in the web application.

## Logging

- Local Firebase logs are located in the `firebase/` directory (e.g., `firebase/*.log`).
- The main application log is `firebase/firebase-debug.log`.

## Testing

- The primary integration tests for Firebase are located in the `firebase/functions` directory.
- Run them with: `cd firebase/functions && npm run test:integration`

## Deployment

- To deploy the Firebase project to production, run: `cd firebase && npm run deploy:prod`
