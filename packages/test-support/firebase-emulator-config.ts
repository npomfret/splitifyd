import * as fs from 'fs';
import * as path from 'path';

if (!process.env.GCLOUD_PROJECT) {
    throw Error("process.env.GCLOUD_PROJECT must be set")
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
 * Reads Firebase emulator configuration from firebase.json and .firebaserc
 * @returns Firebase emulator configuration
 */
export function getFirebaseEmulatorConfig(): FirebaseEmulatorConfig {
    const projectRoot = findProjectRoot();

    // Read emulator configuration from firebase.json
    const firebaseConfigPath = path.join(projectRoot, 'firebase', 'firebase.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

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
 * @returns Path to project root
 */
export function findProjectRoot(): string {
    let currentPath = process.cwd();

    while (currentPath !== '/') {
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
