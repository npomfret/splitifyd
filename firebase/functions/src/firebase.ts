import {config as loadEnv} from 'dotenv';
import * as admin from 'firebase-admin';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

const envPath = join(__dirname, '../.env');
if (existsSync(envPath)) {
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

interface FirebaseJsonConfig {
    emulators: {
        functions: {port: number; host: string};
    };
}

/**
 * Finds firebase.json by walking up the directory tree.
 * Works from any context within the project.
 */
function findFirebaseJson(startPath?: string): string {
    let currentPath = startPath || process.cwd();

    while (currentPath !== dirname(currentPath)) {
        // Try firebase/firebase.json (from project root)
        const fromRoot = join(currentPath, 'firebase', 'firebase.json');
        if (existsSync(fromRoot)) return fromRoot;

        // Try firebase.json directly (from within firebase/)
        const direct = join(currentPath, 'firebase.json');
        if (existsSync(direct)) return direct;

        currentPath = dirname(currentPath);
    }

    throw new Error('Could not find firebase.json');
}

function readFirebaseJson(startPath?: string): FirebaseJsonConfig {
    const path = findFirebaseJson(startPath);
    return JSON.parse(readFileSync(path, 'utf8'));
}

interface EmulatorPorts {
    functions: number;
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
    const config = readFirebaseJson();

    cachedEmulatorPorts = {
        functions: config.emulators.functions.port,
    };

    return cachedEmulatorPorts;
}

/**
 * Check if deployed to Firebase (not emulator)
 */
export function isDeployed() {
    return !isEmulator();
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
        }
    }
    return app;
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
