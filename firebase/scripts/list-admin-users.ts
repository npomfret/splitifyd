#!/usr/bin/env npx tsx
/**
 * List admin users from staging-1 Firestore
 *
 * Usage:
 *   ./scripts/list-admin-users.ts <emulator|staging>
 *
 * This script connects to Firestore and lists all users with admin roles:
 * - system_admin: Can access admin panel, manage all users
 * - tenant_admin: Can manage tenant settings
 * - system_user: Internal system accounts
 */
import { SystemUserRoles } from '@billsplit-wl/shared';
import * as admin from 'firebase-admin';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { FirestoreCollections } from '../functions/src/constants';
import { getFirestore } from '../functions/src/firebase';
import { initializeFirebase, parseEnvironment, type ScriptEnvironment } from './firebase-init';

interface UserDocument {
    email?: string;
    displayName?: string;
    role?: string;
    createdAt?: any;
    lastLoginAt?: any;
}

async function resolveFirestore(env: ScriptEnvironment): Promise<Firestore> {
    if (env.isEmulator) {
        return getFirestore();
    }
    return admin.firestore();
}

function formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'never';
    if (timestamp.toDate) {
        return timestamp.toDate().toISOString();
    }
    return 'unknown';
}

function getRoleLabel(role: string): string {
    switch (role) {
        case SystemUserRoles.SYSTEM_ADMIN:
            return '🔴 SYSTEM ADMIN';
        case SystemUserRoles.TENANT_ADMIN:
            return '🟡 TENANT ADMIN';
        case SystemUserRoles.SYSTEM_USER:
            return '🔵 SYSTEM USER';
        default:
            return '⚪ REGULAR USER';
    }
}

async function listAdminUsers(firestore: Firestore): Promise<void> {
    console.log('📋 Fetching admin users from Firestore...\n');

    const usersCollection = firestore.collection(FirestoreCollections.USERS);

    // Query only for actual admin roles (not system users)
    const adminRoles = [
        SystemUserRoles.SYSTEM_ADMIN,
        SystemUserRoles.TENANT_ADMIN,
    ];

    // Get Firebase Auth instance
    const auth = admin.auth();
    const adminUsers: Array<{ id: string; data: UserDocument; authData?: admin.auth.UserRecord; }> = [];

    // Query for each admin role type
    for (const role of adminRoles) {
        const snapshot = await usersCollection.where('role', '==', role).get();

        for (const doc of snapshot.docs) {
            const data = doc.data() as UserDocument;
            let authData: admin.auth.UserRecord | undefined;

            // Fetch email from Firebase Auth
            try {
                authData = await auth.getUser(doc.id);
            } catch (error) {
                // User might not exist in Auth (orphaned Firestore doc)
                console.warn(`⚠️  Warning: User ${doc.id} not found in Firebase Auth`);
            }

            adminUsers.push({ id: doc.id, data, authData });
        }
    }

    console.log(`🔐 Admin users found: ${adminUsers.length}\n`);

    if (adminUsers.length === 0) {
        console.log('⚠️  No admin users found.');
        return;
    }

    console.log('═'.repeat(100));
    console.log('🔐 ADMIN USERS');
    console.log('═'.repeat(100));

    adminUsers.forEach((user, index) => {
        const { id, data, authData } = user;
        const roleLabel = getRoleLabel(data.role || SystemUserRoles.SYSTEM_USER);

        // Prefer auth data for email and display name
        const email = authData?.email || data.email || 'N/A';
        const displayName = authData?.displayName || data.displayName || 'N/A';

        console.log(`\n${index + 1}. ${roleLabel}`);
        console.log(`   UID:          ${id}`);
        console.log(`   Email:        ${email}`);
        console.log(`   Display Name: ${displayName}`);
        console.log(`   Created:      ${formatTimestamp(data.createdAt)}`);
        console.log(`   Last Login:   ${formatTimestamp(data.lastLoginAt)}`);
    });

    console.log('\n' + '═'.repeat(100));
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);
    const env = parseEnvironment(rawArgs);
    initializeFirebase(env);

    if (env.isEmulator) {
        console.log('🎯 Connected to Firebase Emulator');
        console.log(`   Instance: ${env.instanceName}\n`);
    } else {
        console.log('🎯 Connected to Deployed Firebase');
        console.log(`   Instance: ${env.instanceName}\n`);
    }

    try {
        const firestore = await resolveFirestore(env);
        await listAdminUsers(firestore);
    } catch (error) {
        console.error('❌ Failed to list admin users:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

export { listAdminUsers };
