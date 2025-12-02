#!/usr/bin/env npx tsx

import { getPorts } from '@billsplit-wl/test-support';
import { ChildProcess } from 'child_process';
import { exec } from 'child_process';
import assert from 'node:assert';
import * as path from 'path';
import { promisify } from 'util';
import { loadRuntimeConfig } from './scripts-config';
import { logger } from './logger';
import { seedPolicies } from './seed-policies';
import { startEmulator } from './start-emulator';
import { publishDemoThemes, syncDemoTenants } from './test-data-generator';

const execPromise = promisify(exec);

async function runSeedPoliciesStep(): Promise<void> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`📊 SEEDING POLICIES & ADMIN USER ...`);
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    await seedPolicies();

    logger.info('');
    logger.info('✅ Policy seeding completed successfully!');
    logger.info('📋 Privacy policy, terms, and cookie policy are now available');
    logger.info('🔑 Sign in with test1@test.com to access the emulator');
}

async function runSetupStorageBucketStep(): Promise<void> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🪣 SETTING UP CLOUD STORAGE BUCKET...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    try {
        // Run the storage setup script in emulator mode
        const { stdout, stderr } = await execPromise('npx tsx scripts/setup-storage-bucket.ts emulator', {
            cwd: path.join(__dirname, '..'),
        });

        if (stdout) logger.info(stdout.trim());
        if (stderr) logger.error(stderr.trim());

        logger.info('');
        logger.info('✅ Cloud Storage bucket setup complete!');
    } catch (error) {
        logger.warn('⚠️  Storage bucket setup script failed (bucket will be auto-created on first use)', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function runSyncDemoTenantsStep(): Promise<void> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🏢 SYNCING DEMO TENANTS...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    await syncDemoTenants();

    logger.info('');
    logger.info('✅ Demo tenants synced to Firestore!');
}

async function runPublishDemoThemesStep(): Promise<void> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🎨 PUBLISHING DEMO THEMES...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    await publishDemoThemes();

    logger.info('');
    logger.info('✅ Theme CSS published!');
    logger.info('🎨 Theme CSS available at /api/theme.css for localhost + loopback hosts');
}


// Load and validate runtime configuration
const runtimeConfig = loadRuntimeConfig();
assert(runtimeConfig.__INSTANCE_NAME.startsWith('dev'), `__INSTANCE_NAME=${runtimeConfig.__INSTANCE_NAME} is not allowed when starting emulators`);

// Get Firebase configuration using centralized loader
let UI_PORT: number;
let FUNCTIONS_PORT: number;
let FIRESTORE_PORT: number;
let AUTH_PORT: number;

try {
    ({ ui: UI_PORT, functions: FUNCTIONS_PORT, firestore: FIRESTORE_PORT, auth: AUTH_PORT } = getPorts());
} catch (error) {
    logger.error('❌ firebase.json not found. Run the build process first to generate it.', { error });
    process.exit(1);
}

logger.info('🚀 Starting Firebase emulator with default user setup...', {
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

        // Step 2: Sync demo tenants to Firestore (needed before any API calls that require tenant resolution)
        await runSyncDemoTenantsStep();

        // Step 3: Seed policies and ensure Bill Splitter admin exists
        // (admin user is created first, then used to seed policies via API, then accepts policies)
        await runSeedPoliciesStep();

        // Step 4: Setup Cloud Storage bucket (needed before publishing themes)
        await runSetupStorageBucketStep();

        // Step 5: Publish demo themes (needs storage bucket)
        await runPublishDemoThemesStep();

        logger.info('');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('✨ EMULATOR IS READY FOR USE ✨');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('');
    } catch (error) {
        logger.error('❌ An unexpected error occurred during startup', {
            error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
        });
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
