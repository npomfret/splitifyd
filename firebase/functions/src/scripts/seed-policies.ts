#!/usr/bin/env npx tsx
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { PolicyIds, FirestoreCollections } from '../types/webapp-shared-types';
import { createPolicyInternal, publishPolicyInternal } from '../policies/handlers';

// Load environment variables
const envPath = path.join(__dirname, '../../.env.development');
dotenv.config({ path: envPath });

// Read emulator configuration from firebase.json
const firebaseConfigPath = path.join(__dirname, '../../../firebase.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

const firestorePort = firebaseConfig.emulators.firestore.port;
const authPort = firebaseConfig.emulators.auth.port;

// Set emulator host BEFORE initializing admin SDK
process.env.FIRESTORE_EMULATOR_HOST = `localhost:${firestorePort}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${authPort}`;

console.log(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`Auth emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

// Initialize admin SDK with emulator settings (same as functions)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'splitifyd'
  });
}


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
    const firestore = admin.firestore();
    const existingDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(policyId).get();
    
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
    const firestore = admin.firestore();
    const docs = await firestore.collection(FirestoreCollections.POLICIES).get();
    console.log(`Total documents in policies collection: ${docs.size}`);
    
    docs.forEach(doc => {
      const data = doc.data();
      console.log(`Document ${doc.id}:`, {
        policyName: data.policyName,
        currentVersionHash: data.currentVersionHash,
        hasVersions: !!data.versions
      });
    });
    
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