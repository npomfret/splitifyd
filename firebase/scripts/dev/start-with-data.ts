#!/usr/bin/env npx tsx

import { ChildProcess } from 'child_process';
import assert from 'node:assert';
import { loadRuntimeConfig } from '../scripts-config';
import { logger } from '../logger';
import { seedPolicies } from '../seed-policies';
import { startEmulator } from './start-emulator';
import { publishDemoThemes, syncDemoTenants } from './test-data-generator';

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

let emulatorProcess: ChildProcess | null = null;

const main = async () => {
    try {
        // Step 1: Start emulator
        emulatorProcess = await startEmulator();

        logger.info('🚀 You can now use the webapp and all endpoints are available');

        // Step 2: Seed policies and ensure Bill Splitter admin exists
        // (admin user must be created first - subsequent steps need admin authentication)
        await runSeedPoliciesStep();

        // Step 3: Sync demo tenants to Firestore (requires admin user for API calls)
        await runSyncDemoTenantsStep();

        // Step 4: Publish demo themes (bucket auto-created on first write in emulator)
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
