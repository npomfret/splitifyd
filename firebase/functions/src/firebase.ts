import { config as loadEnv } from 'dotenv';
import * as admin from 'firebase-admin';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getInstanceName, isDevInstanceName } from './shared/instance-name';

const envPath = join(__dirname, '../.env');
if (!process.env.__INSTANCE_NAME && existsSync(envPath)) {
    loadEnv({ path: envPath });
}

/**
 * Check if running in Firebase emulator (local development)
 */
export function isEmulator() {
    const name = getInstanceName();
    return isDevInstanceName(name) && process.env.FUNCTIONS_EMULATOR === 'true';
}

/**
 * Check if deployed to Firebase (not emulator)
 */
export function isDeployed() {
    return !isEmulator();
}

function isTest() {
    return getInstanceName() === 'dev1';
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
        // Validate GCLOUD_PROJECT is available (Firebase provides this automatically in production)
        if (!process.env.GCLOUD_PROJECT) {
            if (isTest()) {
                throw Error('env.GCLOUD_PROJECT should be set in vitest.config.ts in any test environment - and make sure you are running from the correct directory!');
            } else {
                throw Error('env.GCLOUD_PROJECT should be set by Firebase or in your environment');
            }
        }

        try {
            // Try to get the default app if it exists
            app = admin.app();
        } catch (error) {
            // No app exists, create a new one
            // In emulator/test mode, use FIREBASE_CONFIG env var which includes storageBucket
            // In production, use explicit project ID
            const config = process.env.FIREBASE_CONFIG
                ? JSON.parse(process.env.FIREBASE_CONFIG)
                : { projectId: process.env.GCLOUD_PROJECT! };

            app = admin.initializeApp(config);

            // Configure emulator settings if needed
            if (isEmulator()) {
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
        assert(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
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

        // Configure Storage emulator
        assert(firebaseConfig.emulators?.storage?.port, 'firebase storage port must be defined in firebase.json emulators configuration');
        const storagePort = firebaseConfig.emulators.storage.port;
        assert(typeof storagePort === 'number', 'firebase storage port in firebase.json must be a number');
        process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = `localhost:${storagePort}`;
    }
}

// Lazy-initialized singleton instances to minimize connections
let _firestoreDb: admin.firestore.Firestore | undefined;
let _firebaseAuth: admin.auth.Auth | undefined;
let _firebaseStorage: admin.storage.Storage | undefined;

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

/**
 * Get Storage instance - lazy initialization to reduce connections
 * This ensures we only create connections when actually needed
 */
export function getStorage(): admin.storage.Storage {
    if (!_firebaseStorage) {
        const appInstance = getApp();
        _firebaseStorage = appInstance.storage();
    }
    return _firebaseStorage;
}
