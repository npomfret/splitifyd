#!/usr/bin/env npx tsx

import { PolicyId, PolicyIds, PolicyName, toPolicyName, toPolicyText } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';
import { getEnvironment, initializeFirebase } from './lib/firebase-init';
import { generateBillSplitterUser, signInExistingBillSplitter } from './dev/test-data-generator';

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

// API driver for all policy operations (lazily initialized)
let _apiDriver: ApiDriver | null = null;
async function getApiDriver(): Promise<ApiDriver> {
    if (!_apiDriver) {
        _apiDriver = await ApiDriver.create();
    }
    return _apiDriver;
}

/**
 * Initialize Firebase and set up emulator environment variables.
 * Must be called before any Firebase operations.
 */
async function initialize(): Promise<void> {
    // Initialize Firebase (this fetches config from running app for emulator mode)
    await initializeFirebase(env);
}

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
    const createResponse = await (await getApiDriver()).createPolicy(
        { policyName, text },
        adminToken,
    );
    console.log(`✅ Created policy: ${createResponse.id}`);

    // Publish the policy
    const publishResponse = await (await getApiDriver()).publishPolicy(
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
    await (await getApiDriver()).acceptCurrentPublishedPolicies(adminToken);
    console.log('✅ Admin accepted all current policies');
}

/**
 * Verify policies are accessible via public API
 */
async function verifyPolicies(): Promise<void> {
    console.log('\n🔍 Verifying policies via public API...');

    const policyIds = [PolicyIds.TERMS_OF_SERVICE, PolicyIds.COOKIE_POLICY, PolicyIds.PRIVACY_POLICY];

    for (const policyId of policyIds) {
        const policy = await (await getApiDriver()).getCurrentPolicy(policyId);
        console.log(`✅ ${policy.policyName}: ${policy.text.length} chars`);
    }

    console.log('✅ All policies verified!');
}

/**
 * Seed initial policies.
 *
 * Bootstrap order:
 * 1. Initialize Firebase
 * 2. Create admin user (registration allows empty acceptedPolicies for bootstrap)
 * 3. Seed policies via Admin API
 * 4. Accept policies for the admin user
 * 5. Verify policies via public API
 */
export async function seedPolicies() {
    // Initialize Firebase before any operations
    await initialize();

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
