# Potential Race Condition in Firebase Initialization

## Problem
- **Location**: `webapp/src/js/firebase.ts`
- **Description**: The `initializeFirebase` function is asynchronous and can be called from multiple places. While it checks `getApps().length` to prevent re-initialization, there's a potential race condition if it's called multiple times in quick succession before the first initialization is complete.
- **Current vs Expected**: Currently, the initialization is handled by a promise, but the logic inside could be more robust. A more robust solution would be to use a singleton pattern to ensure that the initialization code is only ever executed once.

## Solution
- **Approach**: Implement a singleton pattern for Firebase initialization. This will ensure that the initialization logic is only executed once, and subsequent calls will return the already initialized Firebase instance.
- **Code Sample**:
  ```typescript
  import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
  // ... other imports

  let firebaseApp: FirebaseApp;

  async function initializeFirebase() {
    if (firebaseApp) {
      return { app: firebaseApp, auth: getAuth(firebaseApp), db: getFirestore(firebaseApp) };
    }

    if (getApps().length) {
      firebaseApp = getApp();
    } else {
      const config = await firebaseConfigManager.getFirebaseConfig();
      firebaseApp = initializeApp(config);
    }

    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);

    // ... emulator connection logic ...

    return { app: firebaseApp, auth, db };
  }

  export const firebasePromise = initializeFirebase();
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves robustness and prevents potential race conditions)

## Implementation Notes
This change will make the Firebase initialization more predictable and prevent potential issues related to multiple initializations.