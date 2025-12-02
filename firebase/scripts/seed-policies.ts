#!/usr/bin/env npx tsx

import { PolicyId, PolicyIds, PolicyName, toPolicyName, toPolicyText } from '@billsplit-wl/shared';
import { ApiDriver, getFirebaseEmulatorConfig } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';
import { getEnvironment, initializeFirebase } from './firebase-init';
import { generateBillSplitterUser, signInExistingBillSplitter } from './test-data-generator';

/*
 * This script seeds policy files using the Admin API
 *
 * Usage:
 *   tsx seed-policies.ts emulator
 *   tsx seed-policies.ts production
 */

// Parse environment - handle both direct calls and module calls
const env = getEnvironment();
console.log(`🎯 Running policy seeding for ${env.environment}`);

// Initialize Firebase using common pattern
initializeFirebase(env);

if (env.isEmulator) {
    const emulator = getFirebaseEmulatorConfig();
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${emulator.firestorePort}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = emulator.identityToolkit.host;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = `127.0.0.1:${emulator.storagePort}`;
    process.env.__CLIENT_API_KEY = emulator.identityToolkit.apiKey;
}

// API driver for all policy operations
const apiDriver = new ApiDriver();

/**
 * Read policy file from docs/policies directory
 */
function readPolicyFile(filename: string): string {
    const policyPath = path.join(__dirname, '../docs/policies', filename);
    try {
        return fs.readFileSync(policyPath, 'utf8');
    } catch (error) {
        console.error(`Error reading policy file ${filename}:`, error);
        throw error;
    }
}

/**
 * Get or create admin user for API operations.
 * This can be called before policies exist - registration now allows empty acceptedPolicies.
 */
async function ensureAdminUser(): Promise<string> {
    // Try to sign in existing Bill Splitter admin
    const existingUser = await signInExistingBillSplitter();
    if (existingUser) {
        console.log('✅ Using existing Bill Splitter admin');
        return existingUser.token;
    }

    // Create the admin user (registration allows empty acceptedPolicies for bootstrap)
    console.log('🆕 Creating Bill Splitter admin...');
    const newUser = await generateBillSplitterUser();
    console.log('✅ Bill Splitter admin created');
    return newUser.token;
}

/**
 * Seed policy using Admin API
 */
async function seedPolicy(
    policyId: PolicyId,
    policyName: PolicyName,
    filename: string,
    adminToken: string,
): Promise<void> {
    console.log(`📄 Creating policy: ${policyName}`);

    // Read policy text
    const text = toPolicyText(readPolicyFile(filename));

    // Create policy via Admin API
    const createResponse = await apiDriver.createPolicy(
        { policyName, text },
        adminToken,
    );
    console.log(`✅ Created policy: ${createResponse.id}`);

    // Publish the policy
    const publishResponse = await apiDriver.publishPolicy(
        createResponse.id,
        createResponse.versionHash,
        adminToken,
    );
    console.log(`✅ Published policy ${policyId} (hash: ${publishResponse.currentVersionHash})`);
}

/**
 * Accept policies for the admin user who was created before policies existed
 */
async function acceptPoliciesForAdmin(adminToken: string): Promise<void> {
    console.log('\n📝 Accepting policies for admin user...');
    await apiDriver.acceptCurrentPublishedPolicies(adminToken);
    console.log('✅ Admin accepted all current policies');
}

/**
 * Verify policies are accessible via public API
 */
async function verifyPolicies(): Promise<void> {
    console.log('\n🔍 Verifying policies via public API...');

    const policyIds = [PolicyIds.TERMS_OF_SERVICE, PolicyIds.COOKIE_POLICY, PolicyIds.PRIVACY_POLICY];

    for (const policyId of policyIds) {
        const policy = await apiDriver.getCurrentPolicy(policyId);
        console.log(`✅ ${policy.policyName}: ${policy.text.length} chars`);
    }

    console.log('✅ All policies verified!');
}

/**
 * Seed initial policies.
 *
 * Bootstrap order:
 * 1. Create admin user (registration allows empty acceptedPolicies for bootstrap)
 * 2. Seed policies via Admin API
 * 3. Accept policies for the admin user
 * 4. Verify policies via public API
 */
export async function seedPolicies() {
    console.log(`📚 Seeding policies for ${env.environment}...`);

    // Verify all policy files exist first
    try {
        readPolicyFile('terms-and-conditions.md');
        readPolicyFile('cookie-policy.md');
        readPolicyFile('privacy-policy.md');
        console.log('✅ Successfully read all policy documents');
    } catch (error) {
        throw new Error(`Failed to read policy documents: ${error instanceof Error ? error.message : error}`);
    }

    try {
        // Step 1: Create/get admin user (can be created before policies exist)
        const adminToken = await ensureAdminUser();

        // Step 2: Seed all policies via Admin API
        await seedPolicy(
            PolicyIds.TERMS_OF_SERVICE,
            toPolicyName('Terms of Service'),
            'terms-and-conditions.md',
            adminToken,
        );
        await seedPolicy(
            PolicyIds.COOKIE_POLICY,
            toPolicyName('Cookie Policy'),
            'cookie-policy.md',
            adminToken,
        );
        await seedPolicy(
            PolicyIds.PRIVACY_POLICY,
            toPolicyName('Privacy Policy'),
            'privacy-policy.md',
            adminToken,
        );

        // Step 3: Accept policies for the admin user (who was created before policies existed)
        await acceptPoliciesForAdmin(adminToken);

        // Step 4: Verify all policies are accessible via public API
        await verifyPolicies();

        console.log(`\n🎉 ${env.environment} POLICY SEEDING COMPLETED SUCCESSFULLY!`);
    } catch (error) {
        console.error(`❌ Failed to seed policies to ${env.environment}:`, error);
        throw error;
    }
}
