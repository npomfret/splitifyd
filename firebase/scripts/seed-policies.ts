#!/usr/bin/env npx tsx

import { PolicyIds } from '@splitifyd/shared';
import { ApiDriver, getFirebaseEmulatorConfig } from '@splitifyd/test-support';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import assert from 'node:assert';
import * as path from 'path';
import { requireInstanceMode } from '../functions/src/shared/instance-mode';
import { getEnvironment, initializeFirebase } from './firebase-init';

/*
 * This script seeds policy files to either the emulator or production
 * Usage:
 *   tsx seed-policies.ts emulator
 *   tsx seed-policies.ts production
 */

const envPath = path.join(__dirname, '../functions/.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

requireInstanceMode();

assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');

// Parse environment - handle both direct calls and module calls
const env = getEnvironment();
console.log(`🎯 Running policy seeding for ${env.environment}`);

// Initialize Firebase using common pattern
initializeFirebase(env);

import { getIdentityToolkitConfig } from '../functions/src/client-config';
import { FirestoreCollections } from '../functions/src/constants';
import { getAuth, getFirestore } from '../functions/src/firebase';
import { ApplicationBuilder } from '../functions/src/services/ApplicationBuilder';

type IdentityToolkit = ReturnType<typeof getIdentityToolkitConfig>;
let identityToolkitConfig: IdentityToolkit;

if (env.isEmulator) {
    const emulator = getFirebaseEmulatorConfig();
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${emulator.firestorePort}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = emulator.identityToolkit.host;
    process.env.CLIENT_API_KEY = emulator.identityToolkit.apiKey;
    identityToolkitConfig = emulator.identityToolkit;
} else {
    identityToolkitConfig = getIdentityToolkitConfig();
}

// Get Firebase instances
const firestoreDb = getFirestore();

const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestoreDb, getAuth(), identityToolkitConfig);
const policyService = applicationBuilder.buildPolicyService();

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
 * Seed policy using API endpoints (dev) or internal functions (production)
 */
async function seedPolicy(policyId: string, policyName: string, filename: string): Promise<void> {
    try {
        // Check if policy already exists
        const existingDoc = await firestoreDb.collection(FirestoreCollections.POLICIES).doc(policyId).get();

        if (existingDoc.exists) {
            console.log(`⏭️  Policy ${policyId} already exists, skipping...`);
            return;
        }

        console.log(`📄 Creating policy: ${policyName}`);

        // Read policy text
        const text = readPolicyFile(filename);

        // Use direct service for seeding (avoids complex authentication setup)
        console.log(`🔒 Creating policy via direct service (bypassing API authentication)...`);

        // Use direct PolicyService instead of API for seeding
        const createResponse = await policyService.createPolicy(policyName, text, policyId);
        const publishResponse = await policyService.publishPolicy(createResponse.id, createResponse.currentVersionHash);
        console.log(`✅ Created policy via service: ${createResponse.id}`);
        console.log(`✅ Policy ${policyId} ready (hash: ${publishResponse.currentVersionHash})`);
    } catch (error) {
        console.error(`❌ Failed to seed policy ${policyId}:`, error);
        throw error;
    }
}

/**
 * Verify policies are accessible via API (only for emulator)
 */
async function verifyPoliciesViaApi(): Promise<void> {
    if (!env.isEmulator) {
        console.log('⏭️  Skipping API verification (not available for production)');
        return;
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 VERIFYING POLICIES VIA API...');
    console.log('═══════════════════════════════════════════════════════');

    const apiDriver = new ApiDriver();

    try {
        // Test 2: Fetch each individual policy
        const policyIds = [PolicyIds.TERMS_OF_SERVICE, PolicyIds.COOKIE_POLICY, PolicyIds.PRIVACY_POLICY];

        for (const policyId of policyIds) {
            console.log(`\n📄 Fetching policy ${policyId} via API...`);

            try {
                const policy = await apiDriver.getPolicy(policyId);
                console.log(`✅ Successfully fetched policy: ${policy.policyName}`);
                console.log(`   - ID: ${policy.id}`);
                console.log(`   - Hash: ${policy.currentVersionHash}`);
                console.log(`   - Text length: ${policy.text.length} characters`);
            } catch (error) {
                throw new Error(`Failed to fetch policy ${policyId}: ${error instanceof Error ? error.message : error}`);
            }
        }

        console.log('\n✅ API VERIFICATION COMPLETE - All policies are accessible!');
    } catch (error) {
        throw error;
    }
}

/**
 * Seed initial policies using admin API
 */
export async function seedPolicies() {
    console.log(`📚 Reading policy documents from docs/policies...`);
    console.log(`🌍 Target environment: ${env.environment}`);

    assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');

    // Initialize Firebase handlers
    try {
        // Verify all policy files exist first
        readPolicyFile('terms-and-conditions.md');
        readPolicyFile('cookie-policy.md');
        readPolicyFile('privacy-policy.md');
        console.log('✅ Successfully read all policy documents');
    } catch (error) {
        throw new Error(`Failed to read policy documents: ${error instanceof Error ? error.message : error}`);
    }

    try {
        // Seed all policies via admin API
        await seedPolicy(PolicyIds.TERMS_OF_SERVICE, 'Terms and Conditions', 'terms-and-conditions.md');
        await seedPolicy(PolicyIds.COOKIE_POLICY, 'Cookie Policy', 'cookie-policy.md');
        await seedPolicy(PolicyIds.PRIVACY_POLICY, 'Privacy Policy', 'privacy-policy.md');

        console.log(`✅ Successfully seeded all policies to ${env.environment}`);

        // Verify policies were created by querying Firestore directly
        const docs = await firestoreDb.collection(FirestoreCollections.POLICIES).get();
        console.log(`Total documents in policies collection: ${docs.size}`);

        docs.forEach((doc) => {
            const data = doc.data();
            console.log(`Document ${doc.id}:`, {
                policyName: data.policyName,
                currentVersionHash: data.currentVersionHash,
                hasVersions: !!data.versions,
            });
        });

        // Verify policies are accessible via API (emulator only)
        await verifyPoliciesViaApi();

        console.log(`\n🎉 ${env.environment} POLICY SEEDING COMPLETED SUCCESSFULLY!`);
    } catch (error) {
        console.error(`❌ Failed to seed policies to ${env.environment}:`, error);
        throw error;
    }
}
