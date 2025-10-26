#!/usr/bin/env npx tsx
/**
 * Promote a user to system admin role
 *
 * Usage:
 *   npx tsx firebase/scripts/promote-user-to-admin.ts <emulator|production> <userId|email>
 *
 * Examples:
 *   npx tsx firebase/scripts/promote-user-to-admin.ts emulator user@example.com
 *   npx tsx firebase/scripts/promote-user-to-admin.ts production abc123def456
 *
 * WARNING: This grants full admin access to the user. Use with caution in production.
 */

import { SystemUserRoles } from '@splitifyd/shared';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { FirestoreCollections } from '../functions/src/constants';
import { initializeFirebase, parseEnvironment } from './firebase-init';

// Parse command line arguments
const args = process.argv.slice(2);
const userIdentifier = args[1];

if (!userIdentifier) {
    console.error('❌ Error: User identifier (userId or email) is required');
    console.log('\nUsage:');
    console.log('  npx tsx firebase/scripts/promote-user-to-admin.ts <emulator|production> <userId|email>');
    console.log('\nExamples:');
    console.log('  npx tsx firebase/scripts/promote-user-to-admin.ts emulator user@example.com');
    console.log('  npx tsx firebase/scripts/promote-user-to-admin.ts production abc123def456');
    process.exit(1);
}

// Parse environment and initialize Firebase
const env = parseEnvironment(args);
initializeFirebase(env);

const { isEmulator, environment } = env;
console.log(`🎯 Promoting user to admin in ${environment}`);
console.log(`👤 User identifier: ${userIdentifier}`);

let firestoreDb: Firestore;

/**
 * Initialize Firebase database connection
 */
async function initializeAppServices() {
    console.log('🔧 Initializing Firebase database connection...');

    if (!isEmulator) {
        console.log('🔗 Getting Firestore instance for production...');
        try {
            firestoreDb = admin.firestore();
            console.log('✅ Firestore instance obtained successfully');
        } catch (error) {
            console.error('❌ Failed to get Firestore instance:', error);
            throw error;
        }
    } else {
        console.log('🔗 Importing Firebase module for emulator...');
        const firebaseModule = await import('../functions/src/firebase');
        firestoreDb = firebaseModule.getFirestore();
        console.log('✅ Emulator Firestore instance obtained');
    }
}

/**
 * Resolve user identifier to userId
 * Accepts either a userId directly or an email address
 */
async function resolveUserId(identifier: string): Promise<string> {
    // Check if it looks like an email (contains @)
    if (identifier.includes('@')) {
        console.log(`📧 Resolving email ${identifier} to userId...`);
        try {
            const userRecord = await admin.auth().getUserByEmail(identifier);
            console.log(`✅ Found user: ${userRecord.uid}`);
            return userRecord.uid;
        } catch (error) {
            throw new Error(`Failed to find user with email ${identifier}: ${(error as Error).message}`);
        }
    }

    // Assume it's already a userId
    console.log(`🔑 Using provided userId: ${identifier}`);
    return identifier;
}

/**
 * Get current user data from Firestore
 */
async function getUserData(userId: UserId) {
    const userDoc = await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).get();

    if (!userDoc.exists) {
        throw new Error(`User document not found in Firestore: ${userId}`);
    }

    return userDoc.data();
}

/**
 * Promote user to admin role
 */
async function promoteUserToAdmin(userId: UserId): Promise<void> {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('👑 PROMOTING USER TO SYSTEM ADMIN...');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    try {
        // Verify user exists in Firestore
        console.log('🔍 Verifying user exists in Firestore...');
        const userData = await getUserData(userId);

        console.log(`✅ User found: ${userData?.displayName || 'Unknown'} (${userData?.email || 'No email'})`);

        // Check current role
        const currentRole = userData?.role;
        if (currentRole === SystemUserRoles.SYSTEM_ADMIN) {
            console.log('ℹ️  User already has admin role');
            return;
        }

        console.log(`📝 Current role: ${currentRole || '(none)'}`);

        // Confirm promotion in production
        if (!isEmulator) {
            console.log('');
            console.log('⚠️  WARNING: You are about to grant admin access in PRODUCTION');
            console.log('⚠️  This will give the user full access to all admin endpoints');
            console.log('');

            // In production, we should require manual confirmation
            // For now, we'll proceed but log a warning
            console.log('⚠️  Proceeding with promotion...');
        }

        // Update user role in Firestore
        console.log(`🔄 Setting role to '${SystemUserRoles.SYSTEM_ADMIN}'...`);
        await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).update({
            role: SystemUserRoles.SYSTEM_ADMIN,
        });

        console.log('✅ User role updated successfully!');
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ PROMOTION COMPLETE');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('User details:');
        console.log(`  - User ID: ${userId}`);
        console.log(`  - Display Name: ${userData?.displayName || 'Unknown'}`);
        console.log(`  - Email: ${userData?.email || 'Unknown'}`);
        console.log(`  - Previous role: ${currentRole || '(none)'}`);
        console.log(`  - New role: ${SystemUserRoles.SYSTEM_ADMIN}`);
        console.log('');
        console.log('The user can now:');
        console.log('  - Access all /admin/* endpoints');
        console.log('  - Manage policies via admin panel');
        console.log('  - View and modify all system data');
        console.log('');
    } catch (error) {
        console.error('❌ Error promoting user to admin:', error);
        throw error;
    }
}

/**
 * Main function
 */
async function main(): Promise<void> {
    try {
        // Initialize Firebase
        await initializeAppServices();

        // Resolve user identifier to userId
        const userId = await resolveUserId(userIdentifier);

        // Promote user
        await promoteUserToAdmin(userId);

        console.log('✅ Admin promotion completed successfully!');
    } catch (error) {
        console.error('❌ Admin promotion failed:', error);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

export { main as promoteUserToAdmin };
