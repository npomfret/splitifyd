import {config as loadEnv} from 'dotenv';
import * as admin from 'firebase-admin';
import assert from 'node:assert';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getInstanceName, isDevInstanceName} from './shared/instance-name';

const envPath = join(__dirname, '../.env');
if (!process.env.__INSTANCE_NAME && existsSync(envPath)) {
    loadEnv({path: envPath});
}

/**
 * Check if running in Firebase emulator (local development)
 */
export function isEmulator() {
    return process.env.FUNCTIONS_EMULATOR === 'true';
}

export function isRealFirebase(): boolean {
    return process.env.GAE_RUNTIME !== undefined;
}

interface EmulatorPorts {
    functions: number;
    firestore: number;
    auth: number;
    storage: number;
}

let cachedEmulatorPorts: EmulatorPorts | null = null;

/**
 * Read emulator ports from firebase.json.
 * Cached after first read since the file doesn't change at runtime.
 */
export function getEmulatorPorts(): EmulatorPorts {
    if (cachedEmulatorPorts) {
        return cachedEmulatorPorts;
    }

    const firebaseJsonPath = join(__dirname, '../../firebase.json');
    if (!existsSync(firebaseJsonPath)) {
        throw new Error(`firebase.json not found at ${firebaseJsonPath}`);
    }

    const config = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));
    const emulators = config.emulators;

    if (!emulators?.functions?.port || !emulators?.firestore?.port ||
        !emulators?.auth?.port || !emulators?.storage?.port) {
        throw new Error('All emulator ports must be defined in firebase.json');
    }

    cachedEmulatorPorts = {
        functions: emulators.functions.port,
        firestore: emulators.firestore.port,
        auth: emulators.auth.port,
        storage: emulators.storage.port,
    };

    return cachedEmulatorPorts;
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

export function getFirebaseConfigFromEnvVar() {
    return JSON.parse(process.env.FIREBASE_CONFIG!);
}

export function inferProjectId() {
    // FIREBASE_CONFIG is an env var provided to us, it looks like: {"projectId":"splitifyd","storageBucket":"splitifyd.firebasestorage.app"}
    const config = getFirebaseConfigFromEnvVar();
    return config.projectId;
}

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

            if (!process.env.FIREBASE_CONFIG) {
                throw Error("both the emulator and prod should provide env.FIREBASE_CONFIG");
            }

            // FIREBASE_CONFIG looks like: {"projectId":"splitifyd","storageBucket":"splitifyd.firebasestorage.app"}
            const config = getFirebaseConfigFromEnvVar();

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
        // Sanity checks
        assert(process.env.FIREBASE_AUTH_EMULATOR_HOST);
        assert(process.env.FIRESTORE_EMULATOR_HOST);
        assert(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
        assert(process.env.FIREBASE_CONFIG);
    } else if (isRealFirebase()) {
        // Sanity checks
        assert(process.env.FIREBASE_CONFIG);
    } else {// we are in a test
        const ports = getEmulatorPorts();

        // Configure Firestore emulator
        const firestore = appInstance.firestore();
        firestore.settings({
            host: `localhost:${ports.firestore}`,
            ssl: false,
        });

        // Configure Auth emulator
        process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `localhost:${ports.auth}`;

        // Configure Storage emulator
        process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = `localhost:${ports.storage}`;
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
