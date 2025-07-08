# Firebase Deployment Report

## Issue: Webapp Content Not Deployed

The `firebase/public` directory, which is configured for Firebase Hosting, is currently empty. This means that the `webapp` content is not being deployed to Firebase Hosting.

## Analysis:

- The `firebase.json` file correctly configures `public` as the hosting directory.
- There are no `package.json` files in the root or `webapp` directories, indicating that the `webapp` is likely a static site and does not have a build process that automatically places files into `firebase/public`.

## Recommendation:

To deploy the `webapp` content, the files from the `/Users/nickpomfret/projects/splitifyd/webapp` directory need to be copied into the `/Users/nickpomfret/projects/splitifyd/firebase/public` directory.

This can be done manually, or by adding a script to the `firebase/package.json` (if one is created for the webapp) or to the `firebase/functions/package.json` (if the functions project is the primary build orchestrator) that copies the `webapp` files to the `public` directory before deployment.

**Example of a script to add to `firebase/functions/package.json` (under `scripts`):**

```json
"predeploy:hosting": "cp -R ../../webapp/* ../public/"
```

This script would need to be run before `firebase deploy --only hosting`. A more robust solution would involve a dedicated build process for the webapp that outputs to the `public` directory.
