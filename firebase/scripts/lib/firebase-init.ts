import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getInstanceEnvironment, loadRuntimeConfig, type ScriptEnvironment } from './scripts-config';

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
        console.error('  emulator - Connect to Firebase emulator');
        console.error('  staging  - Connect to deployed Firebase');
        process.exit(1);
    }

    // Auto-set __INSTANCE_NAME based on target environment BEFORE loading config
    // This allows scripts to work without running switch-instance first
    if (targetEnvironment === 'staging' || targetEnvironment === 'deployed') {
        process.env.__INSTANCE_NAME = 'staging-1';
    } else if (targetEnvironment === 'emulator') {
        // For emulator, use .current-instance if set to a dev instance, otherwise default to dev1
        if (!process.env.__INSTANCE_NAME?.startsWith('dev')) {
            process.env.__INSTANCE_NAME = 'dev1';
        }
    }

    // Load runtime config with the correct instance
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
    if (!env.isEmulator) {
        console.log('   Using Production Firebase');

        const serviceAccountPath = path.join(__dirname, '../../service-account-key.json');

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
    }
}
