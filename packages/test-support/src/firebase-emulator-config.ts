import type { ClientAppConfiguration } from '@billsplit-wl/shared';
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

/**
 * Loads Firebase configuration from firebase.json
 * Walks up the directory tree to find firebase/firebase.json from any context
 * @param startPath - Optional starting path (defaults to current working directory)
 * @returns Parsed Firebase configuration
 */
function loadFirebaseConfig(startPath?: string): FirebaseConfig {
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
 * Get the Firebase Firestore emulator port
 * @returns Firestore emulator port number
 */
export function getFirestorePort(): number {
    const config = loadFirebaseConfig();
    return config.emulators.firestore.port;
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

export async function getFirebaseEmulatorSigninUrl(): Promise<string> {
    const firebaseConfig = loadFirebaseConfig();
    const hostingPort = firebaseConfig.emulators.hosting.port;
    const config = await loadClientAppConfiguration(emulatorHost, hostingPort);

    if (!config.firebaseAuthUrl) {
        throw new Error('firebaseAuthUrl not present in config - is the emulator running in dev mode?');
    }

    const authUrl = new URL(config.firebaseAuthUrl);
    const signInUrl = `http://${authUrl.hostname}:${authUrl.port}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.apiKey}`;

    return signInUrl;
}

async function loadClientAppConfiguration(emulatorHost: string, hostingPort: number): Promise<ClientAppConfiguration> {
    const hostingUrl = `http://${emulatorHost}:${hostingPort}`;

    // Use bootstrap-config which works even when no tenants are configured
    const response = await fetch(`${hostingUrl}/api/bootstrap-config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch config from ${hostingUrl}/api/bootstrap-config: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ClientAppConfiguration
}

const emulatorHost = '127.0.0.1';

export function emulatorHostingURL() {
    const firebaseConfig = loadFirebaseConfig();
    const hostingPort = firebaseConfig.emulators.hosting.port;
    return `http://${emulatorHost}:${hostingPort}`;
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
 * Get ApiDriver configuration by fetching from the running app's /api/bootstrap-config endpoint.
 * Uses bootstrap-config which works even when no tenants are configured.
 * @returns Promise<ApiDriverConfig> for the emulator environment
 */
export async function getApiDriverConfig(): Promise<ApiDriverConfig> {
    const firebaseConfig = loadFirebaseConfig();
    const hostingPort = firebaseConfig.emulators.hosting.port;
    const hostingUrl = `http://${emulatorHost}:${hostingPort}`;

    const response = await fetch(`${hostingUrl}/api/bootstrap-config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch config from ${hostingUrl}/api/bootstrap-config: ${response.status} ${response.statusText}`);
    }

    const config: ClientAppConfiguration = await response.json();

    if (!config.firebaseAuthUrl) {
        throw new Error('firebaseAuthUrl not present in config - is the emulator running in dev mode?');
    }

    return {
        baseUrl: `${hostingUrl}/api`,
        firebaseApiKey: config.firebase.apiKey,
        authBaseUrl: `${config.firebaseAuthUrl}/identitytoolkit.googleapis.com`,
    };
}

/**
 * Finds the project root by looking for firebase/firebase.json
 * @param startPath - Optional starting path (defaults to current working directory)
 * @returns Path to project root
 */
function findProjectRoot(startPath?: string): string {
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
