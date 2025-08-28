#!/usr/bin/env npx tsx

assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');
assert(process.env.NODE_ENV === undefined); // todo

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ChildProcess } from 'child_process';
import { logger } from './logger';
import assert from 'node:assert';
import { startEmulator } from './start-emulator';
import { seedPolicies } from './seed-policies';
import { generateTestData } from './generate-test-data';

async function runSeedPoliciesStep(): Promise<void> {
    try {
        logger.info('');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`📊 STARTING POLICY SEEDING ...`);
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('');

        await seedPolicies();

        logger.info('');
        logger.info('✅ Policy seeding completed successfully!');
        logger.info('📋 Privacy policy, terms, and cookie policy are now available');
    } catch (error) {
        logger.error('⚠️ Policy seeding failed (non-fatal)', { error });
        logger.info('💡 You can manually seed policies later by running:');
        logger.info('   cd firebase/functions && npx tsx src/scripts/seed-policies.ts');
        logger.info('');
        logger.info('🔧 Continuing with test data generation despite policy seeding failure...');
        // Don't throw - continue with test data generation
    }
}

async function runGenerateTestDataStep(): Promise<void> {
    try {
        logger.info('');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('📊 STARTING TEST DATA GENERATION...');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('');

        await generateTestData();

        logger.info('');
        logger.info('✅ Test data generation completed successfully!');
        logger.info('🎲 Groups now contain expenses and payments for testing');
    } catch (error) {
        logger.error('⚠️ Test data generation failed (non-fatal)', { error });
        logger.info('💡 You can manually generate test data later by running:');
        logger.info('   cd firebase/functions && npx tsx scripts/generate-test-data.ts');
        logger.info('');
        logger.info('🔧 The emulator is still running and functional despite test data generation failure');
        // Don't throw - emulator is still functional
    }
}

// Read and validate configuration files
const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
    logger.error('❌ firebase.json not found. Run the build process first to generate it.');
    process.exit(1);
}

const firebaseRcPath = path.join(__dirname, '../.firebaserc');
if (!fs.existsSync(firebaseRcPath)) {
    logger.error('❌ .firebaserc not found.');
    process.exit(1);
}

const envPath = path.join(__dirname, '../functions/.env');
if (!fs.existsSync(envPath)) {
    logger.error('❌ .env file not found. Run switch-instance script first to set up environment.');
    process.exit(1);
}

// Load environment variables from .env file
dotenv.config({ path: envPath });

// Parse configuration
const firebaseRc: any = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
const PROJECT_ID = firebaseRc.projects.default!;
assert(PROJECT_ID);

// sanity check
assert(PROJECT_ID === process.env.GCLOUD_PROJECT, `PROJECT_ID=${PROJECT_ID} but GCLOUD_PROJECT=${process.env.GCLOUD_PROJECT}`);

const firebaseConfig: any = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const UI_PORT: string = firebaseConfig.emulators.ui.port!;
const FUNCTIONS_PORT: string = firebaseConfig.emulators.functions.port!;
const FIRESTORE_PORT: string = firebaseConfig.emulators.firestore.port!;
const AUTH_PORT: string = firebaseConfig.emulators.auth.port!;

logger.info('🚀 Starting Firebase emulator with test data generation...', {
    projectId: PROJECT_ID,
    uiPort: UI_PORT,
    functionsPort: FUNCTIONS_PORT,
});

let emulatorProcess: ChildProcess | null = null;

const main = async () => {
    try {
        // Step 1: Start emulator
        emulatorProcess = await startEmulator({
            uiPort: UI_PORT,
            functionsPort: FUNCTIONS_PORT,
            firestorePort: FIRESTORE_PORT,
            authPort: AUTH_PORT,
        });

        logger.info('🚀 You can now use the webapp and all endpoints are available');

        // Step 2: Seed policies
        await runSeedPoliciesStep();

        // Step 3: Generate test data
        await runGenerateTestDataStep();

        logger.info('');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('✨ EMULATOR IS READY FOR USE ✨');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('');
    } catch (error) {
        logger.error('❌ An unexpected error occurred during startup', { error });
        process.exit(1);
    }
};

// Start the main process with a delay to allow for proper setup
setTimeout(() => {
    main().catch((error) => {
        logger.error('❌ An unexpected error occurred during emulator startup', { error });
        process.exit(1);
    });
}, 5000);

let isShuttingDown = false;

process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('🛑 Shutting down...');

    if (emulatorProcess && !emulatorProcess.killed) {
        emulatorProcess.kill('SIGINT');
    }

    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

process.on('SIGTERM', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (emulatorProcess && !emulatorProcess.killed) {
        emulatorProcess.kill('SIGTERM');
    }

    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

process.on('uncaughtException', (error: any) => {
    if (error.code === 'EIO') {
        return;
    }
    logger.error('Uncaught Exception', { error });
    process.exit(1);
});
