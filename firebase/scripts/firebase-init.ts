import * as path from 'path';
import * as fs from 'fs';
import * as admin from 'firebase-admin';

export function isProduction() {
    return process.env.NODE_ENV === "production";
}

export function isEmulator() {
    return !isProduction();
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
        environment: isEmulator ? 'EMULATOR' : 'PRODUCTION'
    };
}

export function initializeFirebase(env: ScriptEnvironment): void {
    console.log(`🎯 Initializing Firebase for ${env.environment}`);
    
    if (!env.isEmulator && require.main === module) {
        console.log('   Using Production Firebase');

        const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

        if (!fs.existsSync(serviceAccountPath)) {
            console.error('❌ Service account key not found at firebase/service-account-key.json');
            console.error('💡 Make sure you have downloaded the service account key and placed it in the firebase directory');
            process.exit(1);
        }

        if (admin.apps.length === 0) {
            console.log('🔑 Initializing Firebase Admin with service account...');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath),
                projectId: 'splitifyd',
            });
        }
    } else if (env.isEmulator) {
        console.log('   Using Firebase Emulator Suite');
    }
}