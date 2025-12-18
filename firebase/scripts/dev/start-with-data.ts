#!/usr/bin/env npx tsx

import { PooledTestUser, toDisplayName, toEmail } from '@billsplit-wl/shared';
import { ApiDriver, DEFAULT_ADMIN_EMAIL, DEFAULT_PASSWORD } from '@billsplit-wl/test-support';
import { ChildProcess } from 'child_process';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../lib/logger';
import { loadRuntimeConfig } from '../lib/scripts-config';
import { seedPolicies } from '../seed-policies';
import { startEmulator } from './start-emulator';
import { publishDemoThemes, syncDemoTenants } from './test-data-generator';

/**
 * Check that required secret files exist for local emulator development.
 * Firebase Functions with `secrets: [...]` config require these secrets to be available.
 */
function checkRequiredSecrets(): void {
    const functionsDir = path.join(process.cwd(), 'functions');
    const secretLocalPath = path.join(functionsDir, '.secret.local');

    if (!fs.existsSync(secretLocalPath)) {
        logger.error('');
        logger.error('════════════════════════════════════════════════════════════════════');
        logger.error('❌ MISSING REQUIRED FILE: functions/.secret.local');
        logger.error('════════════════════════════════════════════════════════════════════');
        logger.error('');
        logger.error('The Firebase emulator requires secrets to be defined locally.');
        logger.error('');
        logger.error('Create the file with:');
        logger.error('');
        logger.error('  echo \'POSTMARK_API_KEYS_JSON={"sidebadger-me-blackhole":"test-token"}\' > functions/.secret.local');
        logger.error('');
        logger.error('This file is gitignored and safe to create with test values.');
        logger.error('════════════════════════════════════════════════════════════════════');
        logger.error('');
        process.exit(1);
    }
}

/**
 * Ensure the default admin user exists.
 * Creates the admin using the test API if it doesn't exist (bypasses policy checks).
 * Returns the admin user for subsequent operations (e.g., policy acceptance).
 */
async function ensureAdminUser(apiDriver: ApiDriver): Promise<PooledTestUser> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('👤 ENSURING ADMIN USER EXISTS...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    try {
        // Try to sign in existing admin
        const admin = await apiDriver.getDefaultAdminUser();
        logger.info(`✅ Admin user already exists: ${admin.email}`);
        return admin;
    } catch {
        // Admin doesn't exist - create it using the test API (bypasses policy checks)
        logger.info('→ Admin not found, creating...');
        const admin = await apiDriver.createAdminUser({
            email: toEmail(DEFAULT_ADMIN_EMAIL),
            password: DEFAULT_PASSWORD,
            displayName: toDisplayName('Bill Splitter Admin'),
        });
        logger.info(`✅ Created admin user: ${admin.email}`);
        return admin;
    }
}

/**
 * Accept all published policies for the admin user.
 * This prevents the admin from seeing policy acceptance prompts in the UI.
 */
async function acceptPoliciesForAdmin(apiDriver: ApiDriver, adminToken: string): Promise<void> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📋 ACCEPTING POLICIES FOR ADMIN USER...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    // Get current policy status for admin
    const policyStatus = await apiDriver.getUserPolicyStatus(adminToken);

    if (!policyStatus.needsAcceptance) {
        logger.info('✅ Admin has already accepted all policies');
        return;
    }

    // Build acceptances for all policies that need acceptance
    const acceptances = policyStatus
        .policies
        .filter(p => p.needsAcceptance)
        .map(p => ({
            policyId: p.policyId,
            versionHash: p.currentVersionHash,
        }));

    if (acceptances.length === 0) {
        logger.info('✅ No policies need acceptance');
        return;
    }

    logger.info(`→ Accepting ${acceptances.length} policies...`);
    await apiDriver.acceptMultiplePolicies(acceptances, adminToken);
    logger.info(`✅ Accepted ${acceptances.length} policies for admin user`);
}

async function runSeedPoliciesStep(): Promise<void> {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📊 SEEDING POLICIES...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    await seedPolicies();

    logger.info('');
    logger.info('✅ Policy seeding completed successfully!');
    logger.info('📋 Privacy policy, terms, and cookie policy are now available');
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

// Check required secrets before starting emulator
checkRequiredSecrets();

let emulatorProcess: ChildProcess | null = null;

const main = async () => {
    try {
        // Step 1: Start emulator
        emulatorProcess = await startEmulator();

        logger.info('🚀 You can now use the webapp and all endpoints are available');

        // Create API driver for subsequent operations
        const apiDriver = await ApiDriver.create();

        // Step 2: Ensure admin user exists (must happen before policy seeding)
        const admin = await ensureAdminUser(apiDriver);

        // Step 3: Seed policies (requires admin user)
        await runSeedPoliciesStep();

        // Step 4: Accept policies for admin user (must happen after policies are seeded)
        await acceptPoliciesForAdmin(apiDriver, admin.token);

        // Step 5: Sync demo tenants to Firestore (requires admin user for API calls)
        await runSyncDemoTenantsStep();

        // Step 6: Publish demo themes (bucket auto-created on first write in emulator)
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
