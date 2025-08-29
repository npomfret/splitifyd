#!/usr/bin/env npx tsx
import * as path from 'path';
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import assert from 'node:assert';

/*
 * This script seeds policy files to either the emulator or production
 * Usage:
 *   tsx seed-policies.ts emulator
 *   tsx seed-policies.ts production
 */

// Parse command line arguments or detect environment
const args = process.argv.slice(2);
const targetEnvironment = args[0];

// If called directly, require explicit argument
// If called as a module, detect from environment
let isEmulator: boolean;
let environment: string;

if (require.main === module) {
    // Called directly - require explicit argument
    if (!targetEnvironment || !['emulator', 'production'].includes(targetEnvironment)) {
        console.error('❌ Usage: tsx seed-policies.ts <emulator|production>');
        process.exit(1);
    }
    isEmulator = targetEnvironment === 'emulator';
    environment = isEmulator ? 'EMULATOR' : 'PRODUCTION';
} else {
    isEmulator = !isProduction();
    environment = isEmulator ? 'EMULATOR' : 'PRODUCTION';
}

console.log(`🎯 Running policy seeding for ${environment}`);

// Initialize Firebase Admin for production BEFORE any other imports
if (!isEmulator && require.main === module) {
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
            projectId: process.env.GCLOUD_PROJECT,
        });
    }
} else if (isEmulator) {
    console.log('   Using Firebase Emulator Suite');
}

// Now import modules that depend on Firebase initialization
import { PolicyIds, FirestoreCollections } from '@splitifyd/shared';
import { ApiDriver } from '@splitifyd/test-support';
import {isProduction} from "../functions/src/firebase";

// We'll get these instances dynamically
let firestoreDb: admin.firestore.Firestore;
let createPolicyInternal: any;
let publishPolicyInternal: any;

/**
 * Initialize Firebase and import handlers
 */
async function initializeFirebase() {
    if (!isEmulator && require.main === module) {
        // Production mode - use the admin instance we already initialized
        firestoreDb = admin.firestore();

        // Import handlers that will use our initialized admin instance
        const handlers = await import('../functions/src/policies/handlers');
        createPolicyInternal = handlers.createPolicyInternal;
        publishPolicyInternal = handlers.publishPolicyInternal;
    } else {
        // Emulator mode - import everything normally
        const firebaseModule = await import('../functions/src/firebase');
        const handlers = await import('../functions/src/policies/handlers');

        firestoreDb = firebaseModule.firestoreDb;
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
    if (!isEmulator) {
        console.log('⏭️  Skipping API verification (not available for production)');
        return;
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 VERIFYING POLICIES VIA API...');
    console.log('═══════════════════════════════════════════════════════');

    const apiDriver = new ApiDriver();

    try {
        // Test 1: Get all current policies
        console.log('\n📋 Fetching all current policies via API...');
        const allPolicies = await apiDriver.getAllPolicies();

        console.log(`✅ Successfully fetched ${allPolicies.count} policies via API`);
        console.log('Policies available:', Object.keys(allPolicies.policies));

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
    console.log(`🌍 Target environment: ${environment}`);

    assert(process.env.GCLOUD_PROJECT, 'GCLOUD_PROJECT must be set');

    // Initialize Firebase and import handlers
    await initializeFirebase();

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

        console.log(`✅ Successfully seeded all policies to ${environment}`);

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

        console.log(`\n🎉 ${environment} POLICY SEEDING COMPLETED SUCCESSFULLY!`);
    } catch (error) {
        console.error(`❌ Failed to seed policies to ${environment}:`, error);
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
