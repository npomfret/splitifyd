#!/usr/bin/env npx tsx
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { FirestoreCollections, PolicyIds } from '../types/webapp-shared-types';

// Load environment variables
const envPath = path.join(__dirname, '../../.env.development');
dotenv.config({ path: envPath });

// Read emulator ports from firebase.json
const firebaseConfigPath = path.join(__dirname, '../../../firebase.json');
let firestorePort = 8080; // fallback defaults
let authPort = 9099;

try {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  if (firebaseConfig.emulators) {
    firestorePort = firebaseConfig.emulators.firestore?.port || firestorePort;
    authPort = firebaseConfig.emulators.auth?.port || authPort;
  }
} catch (error) {
  console.warn('Could not read firebase.json, using default ports');
}

// Set emulator host BEFORE initializing admin SDK
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || `localhost:${firestorePort}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || `localhost:${authPort}`;

console.log(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`Auth emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

// Initialize admin SDK with emulator settings
const projectId = process.env.FIREBASE_PROJECT_ID || 'splitifyd';
console.log(`Using project ID: ${projectId}`);

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId
  });
}

/**
 * Calculate SHA-256 hash of policy text
 */
function calculatePolicyHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
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
 * Seed initial policies into Firestore
 */
async function seedPolicies() {
  const firestore = admin.firestore();
  const now = new Date().toISOString();
  
  // Read policy texts from the actual policy documents
  console.log('Reading policy documents from docs/policies...');
  
  let termsText: string;
  let cookieText: string;
  let privacyText: string;
  
  try {
    termsText = readPolicyFile('terms-and-conditions.md');
    cookieText = readPolicyFile('cookie-policy.md');
    privacyText = readPolicyFile('privacy-policy.md');
    console.log('✅ Successfully read all policy documents');
  } catch (error) {
    console.error('❌ Failed to read policy documents:', error);
    console.log('Make sure the policy files exist in docs/policies/');
    process.exit(1);
  }

  try {
    const batch = firestore.batch();

    // Seed Terms and Conditions
    const termsRef = firestore
      .collection(FirestoreCollections.GROUPS)
      .doc(PolicyIds.TERMS_OF_SERVICE);
    
    const termsHash = calculatePolicyHash(termsText);
    batch.set(termsRef, {
      id: PolicyIds.TERMS_OF_SERVICE,
      policyName: 'Terms and Conditions',
      currentVersionHash: termsHash,
      versions: {
        [termsHash]: {
          text: termsText,
          version: '2.0.0',  // Version 2.0.0 for the comprehensive rewrite
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
          status: 'published'
        }
      },
      createdAt: now,
      updatedAt: now
    });

    // Seed Cookie Policy
    const cookieRef = firestore
      .collection(FirestoreCollections.GROUPS)
      .doc(PolicyIds.COOKIE_POLICY);
    
    const cookieHash = calculatePolicyHash(cookieText);
    batch.set(cookieRef, {
      id: PolicyIds.COOKIE_POLICY,
      policyName: 'Cookie Policy',
      currentVersionHash: cookieHash,
      versions: {
        [cookieHash]: {
          text: cookieText,
          version: '2.0.0',  // Version 2.0.0 for the comprehensive rewrite
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
          status: 'published'
        }
      },
      createdAt: now,
      updatedAt: now
    });

    // Seed Privacy Policy
    const privacyRef = firestore
      .collection(FirestoreCollections.GROUPS)
      .doc(PolicyIds.PRIVACY_POLICY);
    
    const privacyHash = calculatePolicyHash(privacyText);
    batch.set(privacyRef, {
      id: PolicyIds.PRIVACY_POLICY,
      policyName: 'Privacy Policy',
      currentVersionHash: privacyHash,
      versions: {
        [privacyHash]: {
          text: privacyText,
          version: '2.0.0',  // Version 2.0.0 for the comprehensive rewrite
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
          status: 'published'
        }
      },
      createdAt: now,
      updatedAt: now
    });

    await batch.commit();
    console.log('✅ Successfully seeded all policies');
    
    // Verify the policies were created
    const docs = await firestore.collection(FirestoreCollections.GROUPS).get();
    console.log(`Total documents in collection: ${docs.size}`);
    
  } catch (error) {
    console.error('❌ Error seeding policies:', error);
    process.exit(1);
  }
}

// Run the seeding
seedPolicies()
  .then(() => {
    console.log('✅ Policy seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });