#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { UserRecord } from "firebase-admin/auth";
import { execSync } from 'child_process';
import { FirestoreCollections, SystemUserRoles, UserThemeColor } from '@splitifyd/shared';
import { parseEnvironment, initializeFirebase } from './firebase-init';

/**
 * Script to fix broken user accounts by ensuring every Firebase Auth user
 * has a corresponding Firestore user document
 */

// Parse command line arguments and initialize Firebase
const args = process.argv.slice(2);
const env = parseEnvironment(args);
initializeFirebase(env);

const { isEmulator, environment } = env;
console.log(`🎯 Running user fixing for ${environment}`);


// We'll import Firebase-dependent modules dynamically after initialization

/**
 * Script to fix broken user accounts by ensuring every Firebase Auth user
 * has a corresponding Firestore user document
 */

interface FirestoreUserDocument {
    email: string;
    displayName: string;
    role: typeof SystemUserRoles.SYSTEM_USER | typeof SystemUserRoles.SYSTEM_ADMIN;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    acceptedPolicies: Record<string, string>;
    themeColor: UserThemeColor;
}

interface BrokenUserStats {
    totalAuthUsers: number;
    totalFirestoreUsers: number;
    missingFirestoreUsers: number;
    invalidAuthUsers: number;
    fixedUsers: number;
    failedUsers: number;
}

// We'll get these instances dynamically
let firestoreDb: Firestore;
let createServerTimestamp: any;
let getCurrentPolicyVersions: any;
let assignThemeColor: any;

/**
 * Initialize Firebase and import handlers
 */
async function initializeAppServices() {
    console.log('🔧 Initializing Firebase database connection...');

    if (!isEmulator && require.main === module) {
        // Production mode - use the admin instance we already initialized
        console.log('🔗 Getting Firestore instance for production...');
        try {
            firestoreDb = admin.firestore();
            console.log('✅ Firestore instance obtained successfully');

            // Import handlers that will use our initialized admin instance
            const dateHelpers = await import('../functions/src/utils/dateHelpers');
            const policyHelpers = await import('../functions/src/auth/policy-helpers');
            const themeHelpers = await import('../functions/src/user-management/assign-theme-color');

            createServerTimestamp = dateHelpers.createOptimisticTimestamp;
            getCurrentPolicyVersions = policyHelpers.getCurrentPolicyVersions;
            assignThemeColor = themeHelpers.assignThemeColor;

            console.log('✅ Production handlers imported successfully');
        } catch (error) {
            console.error('❌ Failed to get Firestore instance or import handlers:', error);
            throw error;
        }
    } else {
        // Emulator mode - import everything normally
        console.log('🔗 Importing Firebase module for emulator...');
        const firebaseModule = await import('../functions/src/firebase');
        const dateHelpers = await import('../functions/src/utils/dateHelpers');
        const policyHelpers = await import('../functions/src/auth/policy-helpers');
        const themeHelpers = await import('../functions/src/user-management/assign-theme-color');

        firestoreDb = firebaseModule.getFirestore();
        createServerTimestamp = dateHelpers.createOptimisticTimestamp;
        getCurrentPolicyVersions = policyHelpers.getCurrentPolicyVersions;
        assignThemeColor = themeHelpers.assignThemeColor;

        console.log('✅ Emulator Firestore instance and handlers obtained');
    }
}

/**
 * Get all Firebase Auth users using Firebase CLI export
 */
async function getAllAuthUsers(): Promise<UserRecord[]> {
    console.log('🔍 Starting to fetch Firebase Auth users via Firebase CLI...');

    try {
        const tmpFile = '/tmp/firebase-auth-users.json';

        console.log('📤 Exporting users with Firebase CLI...');
        execSync(`firebase auth:export ${tmpFile} --format json`, {
            stdio: ['inherit', 'inherit', 'inherit'],
            cwd: __dirname,
        });

        console.log('📥 Reading exported user data...');
        const usersData = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));

        // Convert CLI export format to UserRecord format
        const users: UserRecord[] = usersData.users.map((user: any) => ({
            uid: user.localId,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoUrl || null,
            emailVerified: user.emailVerified || false,
            disabled: user.disabled || false,
            metadata: {
                creationTime: user.createdAt,
                lastSignInTime: user.lastLoginAt,
            },
            customClaims: user.customAttributes ? JSON.parse(user.customAttributes) : undefined,
            providerData: user.providerUserInfo || [],
        }));

        // Clean up temp file
        fs.unlinkSync(tmpFile);

        console.log(`✅ Successfully fetched ${users.length} auth users via Firebase CLI`);
        return users;
    } catch (error) {
        console.error('❌ Failed to fetch Firebase Auth users via CLI:', error);
        throw error;
    }
}

/**
 * Get all existing Firestore user documents
 */
async function getExistingFirestoreUsers(): Promise<Set<string>> {
    const snapshot = await firestoreDb.collection(FirestoreCollections.USERS).get();
    const userIds = new Set<string>();

    snapshot.docs.forEach((doc) => {
        userIds.add(doc.id);
    });

    return userIds;
}

/**
 * Validate that an auth user has the required fields
 */
function validateAuthUser(user: UserRecord): { valid: boolean; reason?: string } {
    if (!user.email) {
        return { valid: false, reason: 'missing email' };
    }

    if (!user.displayName) {
        return { valid: false, reason: 'missing displayName' };
    }

    return { valid: true };
}

/**
 * Create a Firestore user document for an auth user
 */
async function createUserDocument(authUser: UserRecord): Promise<void> {
    try {
        // Get current policy versions
        const currentPolicyVersions = await getCurrentPolicyVersions();

        // Assign theme color
        const themeColor = await assignThemeColor(authUser.uid);

        // Create user document
        const userDoc: FirestoreUserDocument = {
            email: authUser.email!,
            displayName: authUser.displayName!,
            role: SystemUserRoles.SYSTEM_USER,
            createdAt: createServerTimestamp(),
            updatedAt: createServerTimestamp(),
            acceptedPolicies: currentPolicyVersions,
            themeColor,
        };

        await firestoreDb.collection(FirestoreCollections.USERS).doc(authUser.uid).set(userDoc);

        console.log(`✅ Created user document for ${authUser.email} (${authUser.uid})`);
    } catch (error) {
        console.error(`❌ Failed to create user document for ${authUser.email} (${authUser.uid})`, { error });
        throw error;
    }
}

/**
 * Main function to fix broken users
 */
async function fixBrokenUsers(): Promise<void> {
    const stats: BrokenUserStats = {
        totalAuthUsers: 0,
        totalFirestoreUsers: 0,
        missingFirestoreUsers: 0,
        invalidAuthUsers: 0,
        fixedUsers: 0,
        failedUsers: 0,
    };

    try {
        // Initialize Firebase and import handlers
        await initializeAppServices();

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔧 FIXING BROKEN USER ACCOUNTS...');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');

        // Get all auth users
        console.log('📋 Fetching Firebase Auth users...');
        const authUsers = await getAllAuthUsers();
        stats.totalAuthUsers = authUsers.length;
        console.log(`Found ${authUsers.length} Firebase Auth users`);

        // Get existing Firestore users
        console.log('📋 Fetching Firestore user documents...');
        const existingFirestoreUsers = await getExistingFirestoreUsers();
        stats.totalFirestoreUsers = existingFirestoreUsers.size;
        console.log(`Found ${existingFirestoreUsers.size} Firestore user documents`);

        // Find users that need fixing
        const brokenUsers: UserRecord[] = [];
        const invalidUsers: UserRecord[] = [];

        for (const authUser of authUsers) {
            const validation = validateAuthUser(authUser);

            if (!validation.valid) {
                invalidUsers.push(authUser);
                console.log(`⚠️ Invalid auth user ${authUser.uid}: ${validation.reason}`);
                continue;
            }

            if (!existingFirestoreUsers.has(authUser.uid)) {
                brokenUsers.push(authUser);
            }
        }

        stats.missingFirestoreUsers = brokenUsers.length;
        stats.invalidAuthUsers = invalidUsers.length;

        console.log('');
        console.log('📊 ANALYSIS RESULTS:');
        console.log(`  - Total Firebase Auth users: ${stats.totalAuthUsers}`);
        console.log(`  - Total Firestore user docs: ${stats.totalFirestoreUsers}`);
        console.log(`  - Missing Firestore docs: ${stats.missingFirestoreUsers}`);
        console.log(`  - Invalid Auth users: ${stats.invalidAuthUsers}`);

        if (brokenUsers.length === 0) {
            console.log('');
            console.log('✅ All users have valid Firestore documents - nothing to fix!');
            return;
        }

        console.log('');
        console.log('🔧 CREATING MISSING USER DOCUMENTS...');
        console.log('');

        // Fix broken users
        for (let i = 0; i < brokenUsers.length; i++) {
            const authUser = brokenUsers[i];

            try {
                console.log(`[${i + 1}/${brokenUsers.length}] Fixing ${authUser.email} (${authUser.uid})`);
                await createUserDocument(authUser);
                stats.fixedUsers++;
            } catch (error) {
                stats.failedUsers++;
                console.error(`Failed to fix user ${authUser.email}`, { error });
            }
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✨ USER ACCOUNT FIXING COMPLETE');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('📊 FINAL STATS:');
        console.log(`  - Users fixed: ${stats.fixedUsers}`);
        console.log(`  - Users failed: ${stats.failedUsers}`);
        console.log(`  - Invalid users skipped: ${stats.invalidAuthUsers}`);

        if (stats.failedUsers > 0) {
            console.log('⚠️ Some users could not be fixed - check logs above for details');
        }
    } catch (error) {
        console.error('❌ Error during user fixing process', { error });
        throw error;
    }
}

// Run the script if executed directly
if (require.main === module) {
    fixBrokenUsers()
        .then(() => {
            console.log('✅ User fixing script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 User fixing script failed', { error });
            process.exit(1);
        });
}
