import { getFirebaseEmulatorConfig } from '@billsplit-wl/test-support';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import {getInstanceEnvironment, loadRuntimeConfig, type ScriptEnvironment} from './scripts-config';

export { type ScriptEnvironment } from './scripts-config';

export function isDeployed() {
    const env = getInstanceEnvironment();
    return env.isDeployed;
}

export function isEmulator() {
    const env = getInstanceEnvironment();
    return env.isEmulator;
}

export function parseEnvironment(args: string[]): ScriptEnvironment {
    const targetEnvironment = args[0];

    // Always require explicit argument since scripts are called from command line
    if (!targetEnvironment || !['emulator', 'staging', 'deployed'].includes(targetEnvironment)) {
        console.error('❌ Usage: script.ts <emulator|staging>');
        console.error('');
        console.error('  emulator - Connect to Firebase emulator (requires __INSTANCE_NAME=dev1-4)');
        console.error('  staging  - Connect to deployed Firebase (requires __INSTANCE_NAME=staging-1)');
        console.error('');
        console.error('Current __INSTANCE_NAME from .current-instance: ' + (loadRuntimeConfig().__INSTANCE_NAME || 'not set'));
        process.exit(1);
    }

    // Load runtime config to ensure __INSTANCE_NAME is validated
    loadRuntimeConfig();

    const isEmulator = targetEnvironment === 'emulator';
    const env = getInstanceEnvironment();

    return {
        ...env,
        isEmulator,
        environment: isEmulator ? 'EMULATOR' : 'DEPLOYED',
    };
}

export function getEnvironmentForModule(): ScriptEnvironment {
    // Load and validate runtime config
    loadRuntimeConfig();
    return getInstanceEnvironment();
}

export function getEnvironment(args?: string[]): ScriptEnvironment {
    if (require.main === module || (args && args.length > 0)) {
        // Called directly - parse command line args
        return parseEnvironment(args || process.argv.slice(2));
    } else {
        // Called as a module - detect from INSTANCE_NAME
        return getEnvironmentForModule();
    }
}

export async function initializeFirebase(env: ScriptEnvironment): Promise<void> {
    console.log(`🎯 Initializing Firebase for ${env.environment}`);

    if (!env.isEmulator) {
        console.log('   Using Production Firebase');

        const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

        if (!fs.existsSync(serviceAccountPath)) {
            console.error('❌ Service account key not found at firebase/service-account-key.json');
            console.error('💡 Make sure you have downloaded the service account key and placed it in the firebase directory');
            process.exit(1);
        }

        const projectId = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')).project_id;

        if (admin.apps.length === 0) {
            console.log('🔑 Initializing Firebase Admin with service account...');
            const credential = admin.credential.cert(serviceAccountPath);
            admin.initializeApp({
                credential,
                projectId,
                storageBucket: `${projectId}.firebasestorage.app`,
            });
        } else {
            console.log('   Firebase Admin already initialized');
        }
    } else {
        console.log('   Using Firebase Emulator Suite');

        // Ensure runtime config is loaded
        loadRuntimeConfig();

        try {
            // Fetch config from running app
            const emulatorConfig = await getFirebaseEmulatorConfig();

            // if (!process.env.FUNCTIONS_EMULATOR) {
            //     process.env.FUNCTIONS_EMULATOR = 'true';
            // }

            // process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorConfig.identityToolkit.host;
            // process.env.FIRESTORE_EMULATOR_HOST = emulatorConfig.firestoreEmulatorHost;
            // process.env.FIREBASE_STORAGE_EMULATOR_HOST = emulatorConfig.firebaseStorageEmulatorHost;
            //
            // if (!process.env.FIREBASE_CONFIG) {
            //     process.env.FIREBASE_CONFIG = JSON.stringify({
            //         projectId: emulatorConfig.projectId,
            //         storageBucket: `${emulatorConfig.projectId}.appspot.com`,
            //     });
            // }
            //
            // if (admin.apps.length === 0) {
            //     admin.initializeApp({
            //         projectId: emulatorConfig.projectId,
            //         storageBucket: `${emulatorConfig.projectId}.appspot.com`,
            //     });
            //     console.log('   Firebase Admin initialized for emulator');
            // } else {
            //     console.log('   Firebase Admin already initialized');
            // }
        } catch (error) {
            console.warn('⚠️  Failed to load emulator config from running app', error);
        }
    }
}
