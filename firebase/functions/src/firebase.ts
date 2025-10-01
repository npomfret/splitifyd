import * as admin from 'firebase-admin';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function isEmulator() {
    return process.env.NODE_ENV === 'development' && process.env.FUNCTIONS_EMULATOR === 'true';
}

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function isTest() {
    return process.env.NODE_ENV !== 'production' && process.env.FUNCTIONS_EMULATOR !== 'true';
}

if (!process.env.GCLOUD_PROJECT) {
    if (isTest()) {
        throw Error('env.GCLOUD_PROJECT should be set in vitest.config.ts in any test environment - and make sure you are running from the correct directory!');
    } else {
        throw Error('env.GCLOUD_PROJECT should be set in vitest.config.ts in any test environment, or by firebase elsewhere');
    }
}

// Lazy-initialized app instance - DO NOT initialize at module level
let app: admin.app.App | undefined;

/**
 * Get or create the Firebase Admin app instance
 * This follows the recommended pattern from Firebase docs:
 * - Lazy initialization to prevent connection creation at module load
 * - Singleton pattern to reuse connections across function invocations
 */
function getApp(): admin.app.App {
    if (!app) {
        try {
            // Try to get the default app if it exists
            app = admin.app();
        } catch (error) {
            // No app exists, create a new one
            app = admin.initializeApp({
                projectId: process.env.GCLOUD_PROJECT!,
            });

            // Configure emulator settings if needed
            if (!isProduction()) {
                configureEmulatorSettings(app);
            }
        }
    }
    return app;
}

/**
 * Configure emulator settings for non-production environments
 */
function configureEmulatorSettings(appInstance: admin.app.App): void {
    if (isEmulator()) {
        // Sanity checks for emulator environment
        assert(process.env.FIREBASE_AUTH_EMULATOR_HOST);
        assert(process.env.FIRESTORE_EMULATOR_HOST);
        assert(process.env.FIREBASE_CONFIG);
    } else if (isTest()) {
        const firebaseJsonPath = join(__dirname, '../../firebase.json');
        const firebaseJsonContent = readFileSync(firebaseJsonPath, 'utf8');
        const firebaseConfig = JSON.parse(firebaseJsonContent);

        // Configure Firestore emulator
        assert(firebaseConfig.emulators?.firestore?.port, 'firestore port must be defined in firebase.json emulators configuration');
        const firestorePort = firebaseConfig.emulators.firestore.port;
        assert(typeof firestorePort === 'number', 'firestore port in firebase.json must be a number');

        const firestore = appInstance.firestore();
        firestore.settings({
            host: `localhost:${firestorePort}`,
            ssl: false,
        });

        // Configure Auth emulator
        assert(firebaseConfig.emulators?.auth?.port, 'firebase auth port must be defined in firebase.json emulators configuration');
        const authPort = firebaseConfig.emulators.auth.port;
        assert(typeof authPort === 'number', 'firebase auth port in firebase.json must be a number');

        process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `localhost:${authPort}`;
    }
}

// Lazy-initialized singleton instances to minimize connections
let _firestoreDb: admin.firestore.Firestore | undefined;
let _firebaseAuth: admin.auth.Auth | undefined;

/**
 * Get Firestore instance - lazy initialization to reduce connections
 * This ensures we only create connections when actually needed
 */
export function getFirestore(): admin.firestore.Firestore {
    if (!_firestoreDb) {
        const appInstance = getApp();
        _firestoreDb = appInstance.firestore();
    }
    return _firestoreDb;
}

/**
 * Get Auth instance - lazy initialization to reduce connections
 * This ensures we only create connections when actually needed
 */
export function getAuth(): admin.auth.Auth {
    if (!_firebaseAuth) {
        const appInstance = getApp();
        _firebaseAuth = appInstance.auth();
    }
    return _firebaseAuth;
}
