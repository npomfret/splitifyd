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
 * Seed initial policies into Firestore
 */
async function seedPolicies() {
  const firestore = admin.firestore();
  const now = new Date().toISOString();
  
  // Terms of Service text
  const termsText = `# Terms of Service

Last updated: ${new Date().toLocaleDateString()}

## 1. Acceptance of Terms

By accessing and using Splitifyd ("we", "our", "us"), you agree to be bound by these Terms of Service.

## 2. Description of Service

Splitifyd is a bill-splitting application that helps groups manage shared expenses.

## 3. User Responsibilities

Users are responsible for maintaining accurate information and using the service lawfully.

## 4. Privacy

Your use of our service is also governed by our Privacy Policy.

## 5. Limitation of Liability

The service is provided "as is" without warranties of any kind.

## 6. Changes to Terms

We reserve the right to modify these terms at any time.

## 7. Contact

If you have questions about these terms, please contact us.`;

  // Cookie Policy text
  const cookieText = `# Cookie Policy

Last updated: ${new Date().toLocaleDateString()}

## What Are Cookies

Cookies are small text files stored on your device.

## How We Use Cookies

We use cookies for authentication and to improve your experience.

## Your Choices

You can control cookies through your browser settings.`;

  // Privacy Policy text
  const privacyText = `# Privacy Policy

Last updated: ${new Date().toLocaleDateString()}

## Information We Collect

We collect information you provide directly to us.

## How We Use Your Information

We use the information to provide and improve our services.

## Data Security

We implement appropriate security measures to protect your data.

## Your Rights

You have rights regarding your personal information.

## Contact Us

If you have questions about this privacy policy, please contact us.`;

  try {
    const batch = firestore.batch();

    // Seed Terms of Service
    const termsRef = firestore
      .collection(FirestoreCollections.DOCUMENTS)
      .doc(PolicyIds.TERMS_OF_SERVICE);
    
    batch.set(termsRef, {
      id: PolicyIds.TERMS_OF_SERVICE,
      type: 'policy',
      name: 'Terms of Service',
      text: termsText,
      hash: calculatePolicyHash(termsText),
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      status: 'published'
    });

    // Seed Cookie Policy
    const cookieRef = firestore
      .collection(FirestoreCollections.DOCUMENTS)
      .doc(PolicyIds.COOKIE_POLICY);
    
    batch.set(cookieRef, {
      id: PolicyIds.COOKIE_POLICY,
      type: 'policy',
      name: 'Cookie Policy',
      text: cookieText,
      hash: calculatePolicyHash(cookieText),
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      status: 'published'
    });

    // Seed Privacy Policy
    const privacyRef = firestore
      .collection(FirestoreCollections.DOCUMENTS)
      .doc(PolicyIds.PRIVACY_POLICY);
    
    batch.set(privacyRef, {
      id: PolicyIds.PRIVACY_POLICY,
      type: 'policy',
      name: 'Privacy Policy',
      text: privacyText,
      hash: calculatePolicyHash(privacyText),
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      status: 'published'
    });

    await batch.commit();
    console.log('✅ Successfully seeded all policies');
    
    // Verify the policies were created
    const docs = await firestore.collection(FirestoreCollections.DOCUMENTS).get();
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