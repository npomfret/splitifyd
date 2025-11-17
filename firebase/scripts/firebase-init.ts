import { getPorts, getProjectId } from '@splitifyd/test-support';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { isDevInstanceMode, requireInstanceMode } from '../functions/src/shared/instance-mode';

export function isProduction() {
    return requireInstanceMode() === 'prod';
}

export function isEmulator() {
    const mode = requireInstanceMode();
    if (mode === 'test') return false;
    return isDevInstanceMode(mode);
}

export interface ScriptEnvironment {
    isEmulator: boolean;
    environment: string;
}

export function parseEnvironment(args: string[]): ScriptEnvironment {
    const targetEnvironment = args[0];

    // Always require explicit argument since scripts are called from command line
    if (!targetEnvironment || !['emulator', 'production'].includes(targetEnvironment)) {
        console.error('❌ Usage: script.ts <emulator|production>');
        process.exit(1);
    }

    const isEmulator = targetEnvironment === 'emulator';
    return {
        isEmulator,
        environment: isEmulator ? 'EMULATOR' : 'PRODUCTION',
    };
}

export function getEnvironmentForModule(): ScriptEnvironment {
    const mode = requireInstanceMode();
    const isEmulatorEnv = isDevInstanceMode(mode);
    return {
        isEmulator: isEmulatorEnv,
        environment: isEmulatorEnv ? 'EMULATOR' : 'PRODUCTION',
    };
}

export function getEnvironment(args?: string[]): ScriptEnvironment {
    if (require.main === module || (args && args.length > 0)) {
        // Called directly - parse command line args
        return parseEnvironment(args || process.argv.slice(2));
    } else {
        // Called as a module - detect from INSTANCE_MODE
        return getEnvironmentForModule();
    }
}

export function initializeFirebase(env: ScriptEnvironment): void {
    console.log(`🎯 Initializing Firebase for ${env.environment}`);

    if (!env.isEmulator) {
        console.log('   Using Production Firebase');

        const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

        if (!fs.existsSync(serviceAccountPath)) {
            console.error('❌ Service account key not found at firebase/service-account-key.json');
            console.error('💡 Make sure you have downloaded the service account key and placed it in the firebase directory');
            process.exit(1);
        }

        if (admin.apps.length === 0) {
            console.log('🔑 Initializing Firebase Admin with service account...');
            const credential = admin.credential.cert(serviceAccountPath);
            const projectId = process.env.GCLOUD_PROJECT ?? process.env.PROJECT_ID;
            const appOptions: admin.AppOptions = projectId
                ? {
                      credential,
                      projectId,
                  }
                : {
                      credential,
                  };

            admin.initializeApp(appOptions);
        } else {
            console.log('   Firebase Admin already initialized');
        }
    } else {
        console.log('   Using Firebase Emulator Suite');

        const envPath = path.join(__dirname, '../functions/.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        }

        const projectId = process.env.GCLOUD_PROJECT ?? (() => {
            try {
                const id = getProjectId();
                process.env.GCLOUD_PROJECT = id;
                return id;
            } catch {
                return undefined;
            }
        })();

        try {
            const ports = getPorts();

            if (!process.env.FUNCTIONS_EMULATOR) {
                process.env.FUNCTIONS_EMULATOR = 'true';
            }

            if (!process.env.FIRESTORE_EMULATOR_HOST) {
                process.env.FIRESTORE_EMULATOR_HOST = `localhost:${ports.firestore}`;
            }

            if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
                process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${ports.auth}`;
            }

            if (!process.env.FIREBASE_CONFIG) {
                const resolvedProjectId = projectId ?? 'local-test';
                process.env.FIREBASE_CONFIG = JSON.stringify({
                    projectId: resolvedProjectId,
                    storageBucket: `${resolvedProjectId}.appspot.com`,
                });
            }
        } catch (error) {
            console.warn('⚠️  Failed to load emulator ports from firebase.json', error);
        }
    }
}
