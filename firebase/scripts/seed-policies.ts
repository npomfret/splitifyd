#!/usr/bin/env npx tsx

import * as path from 'path';
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import assert from 'node:assert';
import { PolicyIds, FirestoreCollections } from '@splitifyd/shared';
import { ApiDriver } from '@splitifyd/test-support';
import { getEnvironment, initializeFirebase } from './firebase-init';
import { registerAllServices } from '../functions/src/services/serviceRegistration';
import { createMetricsStorage } from '../functions/src/utils/metrics-storage-factory';

/*
 * This script seeds policy files to either the emulator or production
 * Usage:
 *   tsx seed-policies.ts emulator
 *   tsx seed-policies.ts production
 */

assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');

// Parse environment - handle both direct calls and module calls
const env = getEnvironment();
console.log(`🎯 Running policy seeding for ${env.environment}`);

// Initialize Firebase using common pattern
initializeFirebase(env);

// We'll get these instances dynamically
let firestoreDb: Firestore;
let createPolicyInternal: any;
let publishPolicyInternal: any;

/**
 * Initialize Firebase handlers
 */
async function initializeHandlers() {
    if (!env.isEmulator && require.main === module) {
        // Production mode - use the admin instance we already initialized
        firestoreDb = admin.firestore();

        // Register all services before importing handlers
        const metricsStorage = createMetricsStorage();
        registerAllServices(metricsStorage);

        // Import handlers that will use our initialized admin instance
        const handlers = await import('../functions/src/policies/handlers');
        createPolicyInternal = handlers.createPolicyInternal;
        publishPolicyInternal = handlers.publishPolicyInternal;
    } else {
        // Emulator mode - import everything normally
        const firebaseModule = await import('../functions/src/firebase');
        
        // Register all services before importing handlers
        const metricsStorage = createMetricsStorage();
        registerAllServices(metricsStorage);
        
        const handlers = await import('../functions/src/policies/handlers');

        firestoreDb = firebaseModule.getFirestore();
        createPolicyInternal = handlers.createPolicyInternal;
        publishPolicyInternal = handlers.publishPolicyInternal;
    }
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
 * Seed policy using internal functions (idempotent)
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

        // Create policy using internal function with custom ID
        const createResponse = await createPolicyInternal(policyName, text, policyId);

        console.log(`✅ Created policy: ${createResponse.id}`);

        // Publish the policy immediately using internal function
        const publishResponse = await publishPolicyInternal(createResponse.id, createResponse.currentVersionHash);

        console.log(`✅ Published policy: ${policyId} (hash: ${publishResponse.currentVersionHash})`);
    } catch (error) {
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
    await initializeHandlers();

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

// Run the seeding if this script is executed directly
if (require.main === module) {
    seedPolicies()
        .then(() => {
            console.log('\n✅ Policy seeding script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Policy seeding script failed:', error);
            process.exit(1);
        });
}
