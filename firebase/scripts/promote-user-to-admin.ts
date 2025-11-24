#!/usr/bin/env npx tsx
/**
 * Promote a user to admin role in deployed Firebase
 *
 * Usage:
 *   npx tsx firebase/scripts/promote-user-to-admin.ts <emulator|staging> <userId|email> [role]
 *
 * Examples:
 *   npx tsx firebase/scripts/promote-user-to-admin.ts staging user@example.com system_admin
 *   npx tsx firebase/scripts/promote-user-to-admin.ts staging user@example.com tenant_admin
 *   npx tsx firebase/scripts/promote-user-to-admin.ts emulator user@example.com
 *
 * Valid roles (defaults to system_admin):
 *   - system_admin: Can access admin panel, manage all users
 *   - tenant_admin: Can manage tenant settings
 *
 * WARNING: This grants admin access to the user. Use with caution in production.
 */

import { SystemUserRoles, toUserId, UserId } from '@billsplit-wl/shared';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { FirestoreCollections } from '../functions/src/constants';
import { getFirestore } from '../functions/src/firebase';
import { initializeFirebase, parseEnvironment } from './firebase-init';

// Parse command line arguments
const args = process.argv.slice(2);
const userIdentifier = args[1];
const roleArg = args[2] || 'system_admin';

if (!userIdentifier) {
    console.error('❌ Error: User identifier (userId or email) is required');
    console.log('\nUsage:');
    console.log('  npx tsx firebase/scripts/promote-user-to-admin.ts <emulator|staging> <userId|email> [role]');
    console.log('\nValid roles (defaults to system_admin):');
    console.log('  - system_admin: Can access admin panel, manage all users');
    console.log('  - tenant_admin: Can manage tenant settings');
    console.log('\nExamples:');
    console.log('  npx tsx firebase/scripts/promote-user-to-admin.ts staging user@example.com system_admin');
    console.log('  npx tsx firebase/scripts/promote-user-to-admin.ts staging user@example.com tenant_admin');
    process.exit(1);
}

// Validate role
const validRoles = [SystemUserRoles.SYSTEM_ADMIN, SystemUserRoles.TENANT_ADMIN];
if (!validRoles.includes(roleArg as any)) {
    console.error(`❌ Error: Invalid role '${roleArg}'`);
    console.error(`   Valid roles: ${validRoles.join(', ')}`);
    process.exit(1);
}

const targetRole = roleArg as SystemUserRoles.SYSTEM_ADMIN | SystemUserRoles.TENANT_ADMIN;

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
        console.log('🔗 Getting Firestore instance for emulator...');
        firestoreDb = getFirestore();
        console.log('✅ Emulator Firestore instance obtained');
    }
}

/**
 * Resolve user identifier to userId
 * Accepts either a userId directly or an email address
 */
async function resolveUserId(identifier: string): Promise<UserId> {
    // Check if it looks like an email (contains @)
    if (identifier.includes('@')) {
        console.log(`📧 Resolving email ${identifier} to userId...`);
        try {
            const userRecord = await admin.auth().getUserByEmail(identifier);
            console.log(`✅ Found user: ${userRecord.uid}`);
            return toUserId(userRecord.uid);
        } catch (error) {
            throw new Error(`Failed to find user with email ${identifier}: ${(error as Error).message}`);
        }
    }

    // Assume it's already a userId
    console.log(`🔑 Using provided userId: ${identifier}`);
    return toUserId(identifier);
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
async function promoteUserToAdmin(userId: UserId, role: SystemUserRoles): Promise<void> {
    const roleLabel = role === SystemUserRoles.SYSTEM_ADMIN ? 'SYSTEM ADMIN' : 'TENANT ADMIN';

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👑 PROMOTING USER TO ${roleLabel}...`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    try {
        // Verify user exists in Firestore
        console.log('🔍 Verifying user exists in Firestore...');
        const userData = await getUserData(userId);

        console.log(`✅ User found: ${userData?.displayName || 'Unknown'} (${userData?.email || 'No email'})`);

        // Check current role
        const currentRole = userData?.role;
        if (currentRole === role) {
            console.log(`ℹ️  User already has ${roleLabel} role`);
            return;
        }

        console.log(`📝 Current role: ${currentRole || '(none)'}`);

        // Confirm promotion in production
        if (!isEmulator) {
            console.log('');
            console.log('⚠️  WARNING: You are about to grant admin access in DEPLOYED ENVIRONMENT');
            console.log(`⚠️  This will give the user ${roleLabel} access`);
            console.log('');

            // In production, we should require manual confirmation
            // For now, we'll proceed but log a warning
            console.log('⚠️  Proceeding with promotion...');
        }

        // Update user role in Firestore
        console.log(`🔄 Setting role to '${role}'...`);
        await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).update({
            role,
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
        console.log(`  - New role: ${role}`);
        console.log('');

        if (role === SystemUserRoles.SYSTEM_ADMIN) {
            console.log('The user can now:');
            console.log('  - Access all /admin/* endpoints');
            console.log('  - Manage policies via admin panel');
            console.log('  - Manage all tenants');
            console.log('  - View and modify all system data');
        } else {
            console.log('The user can now:');
            console.log('  - Manage their tenant settings');
            console.log('  - Update tenant branding');
            console.log('  - Manage tenant domains');
        }
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
        await promoteUserToAdmin(userId, targetRole);

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
