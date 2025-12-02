import {getFirebaseEmulatorConfig} from '@billsplit-wl/test-support';

export default async function setup() {
    const emulatorConfig = getFirebaseEmulatorConfig();

    process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorConfig.identityToolkit.host;
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${emulatorConfig.firestorePort}`;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = `127.0.0.1:${emulatorConfig.storagePort}`;
    process.env.__CLIENT_API_KEY = emulatorConfig.identityToolkit.apiKey;
    process.env.FUNCTIONS_EMULATOR = 'true';
    process.env.FIREBASE_CONFIG = JSON.stringify({
        projectId: emulatorConfig.projectId,
        storageBucket: `${(emulatorConfig.projectId)}.appspot.com`,
    });

    // Cache configuration (seconds) - used by app-config.ts
    process.env.__CACHE_PATH_HOME = '300';
    process.env.__CACHE_PATH_LOGIN = '300';
    process.env.__CACHE_PATH_TERMS = '300';
    process.env.__CACHE_PATH_PRIVACY = '300';
    process.env.__CACHE_PATH_API_CONFIG = '60';
    process.env.__CACHE_THEME_VERSIONED = '300';
    process.env.__CACHE_THEME_UNVERSIONED = '0';

}
