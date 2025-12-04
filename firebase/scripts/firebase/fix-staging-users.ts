#!/usr/bin/env npx tsx
/**
 * Fix staging user data
 *
 * This script:
 * 1. Ensures all users have displayName in Firebase Auth (derives from email if missing)
 * 2. Ensures all users have Firestore documents with correct structure
 * 3. Sets role to 'system_user' for all users except admin@snowmonkey.co.uk
 * 4. admin@snowmonkey.co.uk remains the only system_admin
 *
 * Usage:
 *   npx tsx firebase/scripts/fix-staging-users.ts
 *
 * Prerequisites:
 *   - firebase/service-account-key.json must exist
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const FIREBASE_DIR = path.join(__dirname, '../..');
const SERVICE_ACCOUNT_PATH = path.join(FIREBASE_DIR, 'service-account-key.json');
const USERS_COLLECTION = 'users';

const KNOWN_GOOD_ADMIN_EMAIL = 'admin@snowmonkey.co.uk';

interface FixResult {
    uid: string;
    email: string;
    action: 'created' | 'updated' | 'unchanged';
    authChanges: string[];
    firestoreChanges: string[];
}

function deriveDisplayNameFromEmail(email: string): string {
    // Take the part before @ and capitalize first letter
    const localPart = email.split('@')[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function initializeFirebase(): { db: admin.firestore.Firestore; auth: admin.auth.Auth } {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ Service account key not found at firebase/service-account-key.json');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    const projectId = serviceAccount.project_id;

    console.log(`🔑 Initializing Firebase Admin for project: ${projectId}`);

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
            projectId,
        });
    }

    return {
        db: admin.firestore(),
        auth: admin.auth(),
    };
}

async function listAllAuthUsers(auth: admin.auth.Auth): Promise<admin.auth.UserRecord[]> {
    const users: admin.auth.UserRecord[] = [];
    let pageToken: string | undefined;

    console.log('\n📋 Fetching users from Firebase Auth...');

    while (true) {
        const result = await auth.listUsers(1000, pageToken);
        users.push(...result.users);

        if (!result.pageToken) {
            break;
        }
        pageToken = result.pageToken;
    }

    console.log(`   Found ${users.length} users in Auth\n`);
    return users;
}

async function fixUser(
    db: admin.firestore.Firestore,
    auth: admin.auth.Auth,
    authUser: admin.auth.UserRecord,
): Promise<FixResult> {
    const uid = authUser.uid;
    const email = authUser.email || 'unknown';
    const isAdmin = email === KNOWN_GOOD_ADMIN_EMAIL;
    const targetRole = isAdmin ? 'system_admin' : 'system_user';

    const result: FixResult = {
        uid,
        email,
        action: 'unchanged',
        authChanges: [],
        firestoreChanges: [],
    };

    // --- Fix Firebase Auth ---
    if (!authUser.displayName && email !== 'unknown') {
        const derivedName = deriveDisplayNameFromEmail(email);
        await auth.updateUser(uid, { displayName: derivedName });
        result.authChanges.push(`displayName: N/A → ${derivedName}`);
    }

    // --- Fix Firestore ---
    const userRef = db.collection(USERS_COLLECTION).doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        // Create new Firestore document
        const now = admin.firestore.Timestamp.now();
        await userRef.set({
            role: targetRole,
            acceptedPolicies: {},
            createdAt: now,
            updatedAt: now,
        });
        result.firestoreChanges.push(`Created Firestore document with role=${targetRole}`);
    } else {
        // Document exists - check if updates needed
        const data = userDoc.data()!;
        const updates: Record<string, unknown> = {};

        // Fix role if needed
        if (data.role !== targetRole) {
            updates.role = targetRole;
            result.firestoreChanges.push(`role: ${data.role || 'N/A'} → ${targetRole}`);
        }

        // Ensure acceptedPolicies exists (can be empty object)
        if (data.acceptedPolicies === undefined) {
            updates.acceptedPolicies = {};
            result.firestoreChanges.push('Added empty acceptedPolicies');
        }

        // Ensure createdAt exists
        if (!data.createdAt) {
            updates.createdAt = admin.firestore.Timestamp.now();
            result.firestoreChanges.push('Added missing createdAt');
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
            updates.updatedAt = admin.firestore.Timestamp.now();
            await userRef.update(updates);
        }
    }

    // Determine overall action
    if (result.authChanges.length > 0 || result.firestoreChanges.length > 0) {
        result.action = result.firestoreChanges.some((c) => c.startsWith('Created')) ? 'created' : 'updated';
    }

    return result;
}

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    FIX STAGING USERS - Auth + Firestore Repair');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    console.log(`📌 Known good admin: ${KNOWN_GOOD_ADMIN_EMAIL}`);
    console.log('   All other users will be set to system_user role');
    console.log('   Missing displayNames will be derived from email\n');

    const { db, auth } = initializeFirebase();

    // Get all Auth users
    const authUsers = await listAllAuthUsers(auth);

    // Fix each user
    const results: FixResult[] = [];
    console.log('🔧 Processing users...\n');

    for (const authUser of authUsers) {
        const result = await fixUser(db, auth, authUser);
        results.push(result);

        const statusIcon = result.action === 'unchanged' ? '✓' : result.action === 'created' ? '+' : '~';
        const emailDisplay = result.email === KNOWN_GOOD_ADMIN_EMAIL ? `${result.email} (ADMIN)` : result.email;
        console.log(`   ${statusIcon} ${emailDisplay}`);

        for (const change of result.authChanges) {
            console.log(`      [Auth] → ${change}`);
        }
        for (const change of result.firestoreChanges) {
            console.log(`      [Firestore] → ${change}`);
        }
    }

    // Summary
    const created = results.filter((r) => r.action === 'created').length;
    const updated = results.filter((r) => r.action === 'updated').length;
    const unchanged = results.filter((r) => r.action === 'unchanged').length;
    const authFixed = results.filter((r) => r.authChanges.length > 0).length;

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('                                   SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    console.log(`   Total users:         ${results.length}`);
    console.log(`   Auth fixed:          ${authFixed}`);
    console.log(`   Firestore created:   ${created}`);
    console.log(`   Firestore updated:   ${updated}`);
    console.log(`   Unchanged:           ${unchanged}`);
    console.log('\n✅ All users now have displayName in Auth');
    console.log('✅ All users now have correct Firestore structure');
    console.log(`✅ Only ${KNOWN_GOOD_ADMIN_EMAIL} has system_admin role\n`);

    // Clean exit
    await admin.app().delete();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error.message || error);
        process.exit(1);
    });
