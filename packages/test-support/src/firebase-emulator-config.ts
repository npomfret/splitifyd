import type { ClientAppConfiguration } from '@billsplit-wl/shared';
import * as fs from 'fs';
import * as path from 'path';

export interface FirebaseJsonConfig {
    emulators: {
        auth: { port: number; host: string };
        functions: { port: number; host: string };
        firestore: { port: number; host: string };
        hosting: { port: number; host: string };
        storage: { port: number; host: string };
        tasks: { port: number; host: string };
        ui: { enabled: boolean; port: number; host: string };
        singleProjectMode: boolean;
    };
}

/**
 * Finds firebase.json by walking up the directory tree.
 * Works from any context within the project.
 */
function findFirebaseJson(startPath?: string): string {
    let currentPath = startPath || process.cwd();

    while (currentPath !== path.dirname(currentPath)) {
        // Try firebase/firebase.json (from project root)
        const fromRoot = path.join(currentPath, 'firebase', 'firebase.json');
        if (fs.existsSync(fromRoot)) return fromRoot;

        // Try firebase.json directly (from within firebase/)
        const direct = path.join(currentPath, 'firebase.json');
        if (fs.existsSync(direct)) return direct;

        currentPath = path.dirname(currentPath);
    }

    throw new Error('Could not find firebase.json');
}

/**
 * Loads Firebase configuration from firebase.json
 * Walks up the directory tree to find firebase/firebase.json from any context
 */
function loadFirebaseConfig(startPath?: string): FirebaseJsonConfig {
    const configPath = findFirebaseJson(startPath);
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    const hostingUrl = emulatorHostingURL();
    const config = await loadClientAppConfiguration(hostingUrl);

    if (!config.firebaseAuthUrl) {
        throw new Error('firebaseAuthUrl not present in config - is the emulator running in dev mode?');
    }

    const authUrl = new URL(config.firebaseAuthUrl);
    const signInUrl = `http://${authUrl.hostname}:${authUrl.port}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.apiKey}`;

    return signInUrl;
}

async function loadClientAppConfiguration(hostingUrl: string): Promise<ClientAppConfiguration> {
    // Use bootstrap-config which works even when no tenants are configured
    const response = await fetch(`${hostingUrl}/api/bootstrap-config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch config from ${hostingUrl}/api/bootstrap-config: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ClientAppConfiguration;
}

const emulatorHost = '127.0.0.1';

export function emulatorHostingURL() {
    const config = loadFirebaseConfig();
    return `http://${emulatorHost}:${config.emulators.hosting.port}`;
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
    const hostingUrl = emulatorHostingURL();
    const config = await loadClientAppConfiguration(hostingUrl);

    if (!config.firebaseAuthUrl) {
        throw new Error('firebaseAuthUrl not present in config - is the emulator running in dev mode?');
    }

    return {
        baseUrl: `${hostingUrl}/api`,
        firebaseApiKey: config.firebase.apiKey,
        authBaseUrl: `${config.firebaseAuthUrl}/identitytoolkit.googleapis.com`,
    };
}
