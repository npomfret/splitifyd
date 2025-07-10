# Webapp Issue: Hardcoded Values (Firebase Emulator Ports)

## Issue Description

Firebase emulator port numbers are hardcoded in `firebase-config.ts`. While functional, this can be brittle if the emulator configuration changes.

## Recommendation

Consider externalizing these port numbers into a configuration file or environment variables that are loaded dynamically, allowing for easier updates without code modifications.

## Implementation Suggestions

This issue is closely related to the `environment-config-report.md` which proposes a more robust solution using `.env` files. The recommendation here is to follow the plan outlined in that report.

**Reference:** `docs/todo/environment-config-report.md`

Specifically, ensure that `firebase-config.ts` retrieves the emulator host and port from `window.env` (as proposed in `environment-config-report.md`) rather than hardcoding them or deriving them from `window.location.port`.

```typescript
// webapp/src/js/firebase-config.ts (Refactored Snippets)

// Inside FirebaseConfigManager class

    async initialize() {
        // ... (imports remain the same)
        
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        
        // Use the new env variables from window.env
        if (window.env.FIREBASE_EMULATOR_HOST && window.env.FIREBASE_AUTH_EMULATOR_PORT) {
            const authEmulatorUrl = `${window.env.FIREBASE_EMULATOR_HOST}:${window.env.FIREBASE_AUTH_EMULATOR_PORT}`;
            console.log(`🔧 Connecting to Firebase Auth emulator at ${authEmulatorUrl}`);
            connectAuthEmulator(this.auth, authEmulatorUrl, { disableWarnings: true });
        }
        
        // ... (rest of the method)
    }

    async fetchFirebaseConfig() {
        const configUrl = `${window.env.API_BASE_URL}/config`;
        console.log('Fetching Firebase configuration from:', configUrl);
        
        try {
            // ... (fetch logic remains the same)
            
            this.config = {
                firebaseConfig,
                apiUrl: window.env.API_BASE_URL,
                isLocal: !!window.env.FIREBASE_EMULATOR_HOST,
                formDefaults: firebaseConfig.formDefaults,
                warningBanner: firebaseConfig.warningBanner
            };
            
            return firebaseConfig;
            
        } catch (error) {
            // ... (error handling)
        }
    }

    // Remove getLocalFunctionsPort and getLocalAuthPort methods
    // as their logic is now handled by the env variables.
```

**Action:** Implement the `.env` file loading mechanism as described in `docs/todo/environment-config-report.md` and then update `firebase-config.ts` to consume these environment variables.
