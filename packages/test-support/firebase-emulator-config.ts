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
    baseUrl: string;
    firebaseApiKey: string;
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
 * Get the Firebase project ID from .firebaserc
 * @returns Firebase project ID
 */
export function getProjectId(): string {
    const projectRoot = findProjectRoot();
    const firebaseRcPath = path.join(projectRoot, 'firebase', '.firebaserc');
    
    try {
        const firebaseRcContent = fs.readFileSync(firebaseRcPath, 'utf8');
        const firebaseRc = JSON.parse(firebaseRcContent);
        return firebaseRc.projects.default;
    } catch (error) {
        throw new Error(`Failed to read .firebaserc at ${firebaseRcPath}: ${error}`);
    }
}

/**
 * Get the Firebase region (hardcoded to us-central1 as per project convention)
 * @returns Firebase region string
 */
export function getRegion(): string {
    return 'us-central1';
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
    ui: number;
} {
    const config = loadFirebaseConfig();
    return {
        functions: config.emulators.functions.port,
        firestore: config.emulators.firestore.port,
        auth: config.emulators.auth.port,
        hosting: config.emulators.hosting.port,
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
    const firebaseRcPath = path.join(projectRoot, 'firebase', '.firebaserc');
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    const projectId = firebaseRc.projects.default;

    const functionsPort = firebaseConfig.emulators.functions.port;
    const authPort = firebaseConfig.emulators.auth.port;
    const firestorePort = firebaseConfig.emulators.firestore.port;
    const hostingPort = firebaseConfig.emulators.hosting.port;

    return {
        projectId,
        functionsPort,
        authPort,
        firestorePort,
        hostingPort,
        baseUrl: `http://localhost:${functionsPort}/${projectId}/us-central1/api`,
        firebaseApiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg', // Default API key for emulator
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
