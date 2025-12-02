import * as fs from 'fs';
import * as path from 'path';

export interface FirebaseConfig {
    functions: Array<{
        source: string;
        codebase: string;
        ignore: string[];
        predeploy: string[];
    }>;
    hosting: {
        public: string;
        ignore: string[];
        headers: Array<{
            source: string;
            headers: Array<{
                key: string;
                value: string;
            }>;
        }>;
        rewrites: Array<{
            source: string;
            function?: string;
            destination?: string;
        }>;
    };
    firestore: {
        rules: string;
        indexes: string;
    };
    emulators: {
        auth: {
            port: number;
            host: string;
        };
        functions: {
            port: number;
            host: string;
        };
        firestore: {
            port: number;
            host: string;
        };
        hosting: {
            port: number;
            host: string;
        };
        storage: {
            port: number;
            host: string;
        };
        ui: {
            enabled: boolean;
            port: number;
            host: string;
        };
        singleProjectMode: boolean;
    };
}

export interface FirebaseEmulatorConfig {
    projectId: string;
    functionsPort: number;
    authPort: number;
    firestorePort: number;
    hostingPort: number;
    firebaseStorageEmulatorHost: string;
    baseUrl: string;
    firebaseApiKey: string;
    identityToolkit: {
        apiKey: string;
        baseUrl: string;
        host: string;
    };
}

/**
 * Loads Firebase configuration from firebase.json
 * Walks up the directory tree to find firebase/firebase.json from any context
 * @param startPath - Optional starting path (defaults to current working directory)
 * @returns Parsed Firebase configuration
 */
export function loadFirebaseConfig(startPath?: string): FirebaseConfig {
    const projectRoot = findProjectRoot(startPath);
    const firebaseConfigPath = path.join(projectRoot, 'firebase', 'firebase.json');

    try {
        const firebaseJsonContent = fs.readFileSync(firebaseConfigPath, 'utf8');
        return JSON.parse(firebaseJsonContent);
    } catch (error) {
        throw new Error(`Failed to read firebase.json at ${firebaseConfigPath}: ${error}`);
    }
}

/**
 * Get the Firebase Functions emulator port
 * @returns Functions emulator port number
 */
export function getFunctionsPort(): number {
    const config = loadFirebaseConfig();
    return config.emulators.functions.port;
}

/**
 * Get the Firebase Firestore emulator port
 * @returns Firestore emulator port number
 */
export function getFirestorePort(): number {
    const config = loadFirebaseConfig();
    return config.emulators.firestore.port;
}

/**
 * Get the Firebase Auth emulator port
 * @returns Auth emulator port number
 */
export function getAuthPort(): number {
    const config = loadFirebaseConfig();
    return config.emulators.auth.port;
}

/**
 * Get the Firebase Hosting emulator port
 * @returns Hosting emulator port number
 */
export function getHostingPort(): number {
    const config = loadFirebaseConfig();
    return config.emulators.hosting.port;
}

/**
 * Get the Firebase UI emulator port
 * @returns UI emulator port number
 */
export function getUIPort(): number {
    const config = loadFirebaseConfig();
    return config.emulators.ui.port;
}

/**
 * Get all Firebase emulator ports as an object for destructuring
 * @returns Object with named port properties
 */
export function getPorts(): {
    functions: number;
    firestore: number;
    auth: number;
    hosting: number;
    storage: number;
    ui: number;
} {
    const config = loadFirebaseConfig();
    return {
        functions: config.emulators.functions.port,
        firestore: config.emulators.firestore.port,
        auth: config.emulators.auth.port,
        hosting: config.emulators.hosting.port,
        storage: config.emulators.storage.port,
        ui: config.emulators.ui.port,
    };
}

/**
 * Get all Firebase emulator ports as an array
 * @returns Array of emulator port numbers
 */
export function getAllEmulatorPorts(): number[] {
    const config = loadFirebaseConfig();
    const ports: number[] = [];

    if (config.emulators) {
        Object.values(config.emulators).forEach((emulator: any) => {
            if (emulator.port) {
                ports.push(parseInt(emulator.port));
            }
        });
    }

    return ports;
}

/**
 * Reads Firebase emulator configuration from firebase.json and .firebaserc
 * @returns Firebase emulator configuration
 */
export function getFirebaseEmulatorConfig(): FirebaseEmulatorConfig {
    const projectRoot = findProjectRoot();

    // Read emulator configuration from firebase.json
    const firebaseConfig = loadFirebaseConfig();

    // Read project ID from .firebaserc
    const firebaseRc = JSON.parse(fs.readFileSync(path.join(projectRoot, 'firebase', '.firebaserc'), 'utf8'));
    const projectId = firebaseRc.projects.default;

    const functionsPort = firebaseConfig.emulators.functions.port;
    const authPort = firebaseConfig.emulators.auth.port;
    const authHost = firebaseConfig.emulators.auth.host;
    const firestorePort = firebaseConfig.emulators.firestore.port;
    const hostingPort = firebaseConfig.emulators.hosting.port;
    const storagePort = firebaseConfig.emulators.storage.port;

    const firebaseApiKey = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg'; // Default API key for emulator

    return {
        projectId,
        functionsPort,
        authPort,
        firestorePort,
        hostingPort,
        firebaseStorageEmulatorHost: `127.0.0.1:${storagePort}`,
        baseUrl: `http://localhost:${functionsPort}/${projectId}/us-central1/api`,
        firebaseApiKey: firebaseApiKey,
        identityToolkit: {
            apiKey: firebaseApiKey,
            baseUrl: `http://${authHost}:${authPort}/identitytoolkit.googleapis.com`,
            host: `${authHost}:${authPort}`,
        },
    };
}

/**
 * Configuration for ApiDriver
 */
export interface ApiDriverConfig {
    /** API endpoint base URL (e.g., 'https://myapp.web.app/api') */
    baseUrl: string;
    /** Firebase API key for authentication */
    firebaseApiKey: string;
    /** Firebase Auth base URL for identity toolkit (e.g., 'https://identitytoolkit.googleapis.com' for production) */
    authBaseUrl: string;
}

/**
 * Get ApiDriver configuration for the Firebase emulator.
 * @returns ApiDriverConfig for the emulator environment
 */
export function getApiDriverConfig(): ApiDriverConfig {
    const config = getFirebaseEmulatorConfig();
    return {
        baseUrl: config.baseUrl,
        firebaseApiKey: config.firebaseApiKey,
        authBaseUrl: config.identityToolkit.baseUrl,
    };
}

/**
 * Finds the project root by looking for firebase/firebase.json
 * @param startPath - Optional starting path (defaults to current working directory)
 * @returns Path to project root
 */
export function findProjectRoot(startPath?: string): string {
    let currentPath = startPath || process.cwd();

    while (currentPath !== path.dirname(currentPath)) {
        try {
            const firebaseJsonPath = path.join(currentPath, 'firebase', 'firebase.json');
            if (fs.existsSync(firebaseJsonPath)) {
                return currentPath;
            }
        } catch {
            // Continue searching
        }
        currentPath = path.dirname(currentPath);
    }

    throw new Error('Could not find project root with firebase/firebase.json');
}
