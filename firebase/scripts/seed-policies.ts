#!/usr/bin/env npx tsx

import { PolicyIds, PolicyName, toPolicyName, toPolicyText } from '@billsplit-wl/shared';
import { ApiDriver, getFirebaseEmulatorConfig } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import assert from 'node:assert';
import * as path from 'path';
import { loadRuntimeConfig } from '../shared/scripts-config';
import { getEnvironment, initializeFirebase } from './firebase-init';
import { signInExistingBillSplitter } from './test-data-generator';

/*
 * This script seeds policy files using the Admin API
 *
 * Note: Policy creation requires direct service access since there's no admin API endpoint.
 * Verification is done through the API to ensure policies are accessible.
 *
 * Usage:
 *   tsx seed-policies.ts emulator
 *   tsx seed-policies.ts production
 */

// Load and validate runtime configuration
const runtimeConfig = loadRuntimeConfig();
assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');

// Parse environment - handle both direct calls and module calls
const env = getEnvironment();
console.log(`🎯 Running policy seeding for ${env.environment}`);

// Initialize Firebase using common pattern
initializeFirebase(env);

import { PolicyId } from '@billsplit-wl/shared';
import { getComponentBuilder } from '../functions/src/ComponentBuilderSingleton';

if (env.isEmulator) {
    const emulator = getFirebaseEmulatorConfig();
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${emulator.firestorePort}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = emulator.identityToolkit.host;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = `127.0.0.1:${emulator.storagePort}`;
    process.env.CLIENT_API_KEY = emulator.identityToolkit.apiKey;
}

// Get component builder for service access
const componentBuilder = getComponentBuilder();

// API driver for verification only
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
 * Seed policy using service (no admin API endpoint exists for policy creation)
 */
async function seedPolicy(
    policyId: PolicyId,
    policyName: PolicyName,
    filename: string,
): Promise<void> {
    try {
        // Check if policy already exists (via service)
        const firestoreReader = componentBuilder.buildFirestoreReader();
        const existingPolicy = await firestoreReader.getPolicy(policyId);

        if (existingPolicy) {
            console.log(`⏭️  Policy ${policyId} already exists, skipping...`);
            return;
        }

        console.log(`📄 Creating policy: ${policyName}`);

        // Read policy text
        const text = toPolicyText(readPolicyFile(filename));

        // Use direct service access (no admin API endpoint exists for policy creation)
        console.log(`🔒 Creating policy via direct service...`);
        const policyService = componentBuilder.buildPolicyService();
        const createResponse = await policyService.createPolicy(policyName, text, policyId);
        const publishResponse = await policyService.publishPolicy(
            createResponse.id,
            createResponse.currentVersionHash,
        );
        console.log(`✅ Created policy: ${createResponse.id}`);
        console.log(`✅ Policy ${policyId} ready (hash: ${publishResponse.currentVersionHash})`);
    } catch (error) {
        console.error(`❌ Failed to seed policy ${policyId}:`, error);
        throw error;
    }
}

/**
 * Verify policies are accessible via Admin API
 */
async function verifyPoliciesViaApi(adminToken: string): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 VERIFYING POLICIES VIA ADMIN API...');
    console.log('═══════════════════════════════════════════════════════');

    try {
        // Fetch each individual policy using admin authentication
        const policyIds = [PolicyIds.TERMS_OF_SERVICE, PolicyIds.COOKIE_POLICY, PolicyIds.PRIVACY_POLICY];

        for (const policyId of policyIds) {
            console.log(`\n📄 Fetching policy ${policyId} via Admin API...`);

            try {
                const policy = await apiDriver.getPolicy(policyId, adminToken);
                const currentVersion = policy.versions[policy.currentVersionHash];
                console.log(`✅ Successfully fetched policy: ${policy.policyName}`);
                console.log(`   - ID: ${policy.id}`);
                console.log(`   - Hash: ${policy.currentVersionHash}`);
                console.log(`   - Text length: ${currentVersion?.text.length || 0} characters`);
            } catch (error) {
                throw new Error(`Failed to fetch policy ${policyId}: ${error instanceof Error ? error.message : error}`);
            }
        }

        console.log('\n✅ ADMIN API VERIFICATION COMPLETE - All policies are accessible!');
    } catch (error) {
        throw error;
    }
}

/**
 * Seed initial policies
 */
export async function seedPolicies() {
    console.log(`📚 Reading policy documents from docs/policies...`);
    console.log(`🌍 Target environment: ${env.environment}`);

    assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');

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
        // Seed all policies via service (no admin API endpoint exists)
        await seedPolicy(
            PolicyIds.TERMS_OF_SERVICE,
            toPolicyName('Terms and Conditions'),
            'terms-and-conditions.md',
        );
        await seedPolicy(
            PolicyIds.COOKIE_POLICY,
            toPolicyName('Cookie Policy'),
            'cookie-policy.md',
        );
        await seedPolicy(
            PolicyIds.PRIVACY_POLICY,
            toPolicyName('Privacy Policy'),
            'privacy-policy.md',
        );

        console.log(`✅ Successfully seeded all policies to ${env.environment}`);

        // Verify policies are accessible via Admin API (if admin token available)
        if (env.isEmulator) {
            console.log('\n🔐 Looking for Bill Splitter admin user for API verification...');
            const billSplitterUser = await signInExistingBillSplitter();

            if (billSplitterUser) {
                console.log('✅ Bill Splitter admin found - verifying via Admin API...');
                await verifyPoliciesViaApi(billSplitterUser.token);
            } else {
                console.log('⏭️  Bill Splitter admin not found - skipping API verification');
            }
        }

        console.log(`\n🎉 ${env.environment} POLICY SEEDING COMPLETED SUCCESSFULLY!`);
    } catch (error) {
        console.error(`❌ Failed to seed policies to ${env.environment}:`, error);
        throw error;
    }
}
