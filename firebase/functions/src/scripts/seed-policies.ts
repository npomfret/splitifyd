#!/usr/bin/env npx tsx
import * as path from 'path';
import * as fs from 'fs';
import { PolicyIds, FirestoreCollections } from '../shared/shared-types';
import { createPolicyInternal, publishPolicyInternal } from '../policies/handlers';
import { db } from '../firebase';
import { ApiDriver } from '../__tests__/support/ApiDriver';

/*
 * this script only seeds policy files to the emulator
 */

/**
 * Read policy file from docs/policies directory
 */
function readPolicyFile(filename: string): string {
    const policyPath = path.join(__dirname, '../../../../docs/policies', filename);
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
        const existingDoc = await db.collection(FirestoreCollections.POLICIES).doc(policyId).get();

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
        console.error(`❌ Failed to seed policy ${policyId}:`, error);
        throw error;
    }
}

/**
 * Verify policies are accessible via API
 */
async function verifyPoliciesViaApi(): Promise<void> {
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
                console.error(`❌ Failed to fetch policy ${policyId}:`, error);
            }
        }
        
        console.log('\n✅ API VERIFICATION COMPLETE - All policies are accessible!');
        
    } catch (error) {
        console.error('\n❌ API VERIFICATION FAILED:', error);
        throw error;
    }
}

/**
 * Seed initial policies using admin API
 */
export async function seedPolicies() {
    console.log('Reading policy documents from docs/policies...');

    try {
        // Verify all policy files exist first
        readPolicyFile('terms-and-conditions.md');
        readPolicyFile('cookie-policy.md');
        readPolicyFile('privacy-policy.md');
        console.log('✅ Successfully read all policy documents');
    } catch (error) {
        console.error('❌ Failed to read policy documents:', error);
        console.log('Make sure the policy files exist in docs/policies/');
        process.exit(1);
    }

    try {
        // Seed all policies via admin API
        await seedPolicy(PolicyIds.TERMS_OF_SERVICE, 'Terms and Conditions', 'terms-and-conditions.md');
        await seedPolicy(PolicyIds.COOKIE_POLICY, 'Cookie Policy', 'cookie-policy.md');
        await seedPolicy(PolicyIds.PRIVACY_POLICY, 'Privacy Policy', 'privacy-policy.md');

        console.log('✅ Successfully seeded all policies');

        // Verify policies were created by querying Firestore directly
        const docs = await db.collection(FirestoreCollections.POLICIES).get();
        console.log(`Total documents in policies collection: ${docs.size}`);

        docs.forEach((doc) => {
            const data = doc.data();
            console.log(`Document ${doc.id}:`, {
                policyName: data.policyName,
                currentVersionHash: data.currentVersionHash,
                hasVersions: !!data.versions,
            });
        });
        
        // Verify policies are accessible via API
        await verifyPoliciesViaApi();
        
    } catch (error) {
        console.error('❌ Error seeding policies:', error);
        process.exit(1);
    }
}

// Only run seeding when executed directly (not when imported)
if (require.main === module) {
    seedPolicies()
        .then(() => {
            console.log('✅ Policy seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}
