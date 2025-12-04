#!/usr/bin/env npx tsx
/**
 * List all users from staging Firestore and Firebase Auth
 *
 * This script connects directly to staging Firestore using the service account key
 * and paginates through all users, printing their details correlated with Auth data.
 *
 * Usage:
 *   npx tsx firebase/scripts/list-staging-users.ts
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
const PAGE_SIZE = 100;

interface FirestoreUserRecord {
    id: string;
    email?: string;
    role?: string;
    preferredLanguage?: string;
    createdAt?: admin.firestore.Timestamp;
    updatedAt?: admin.firestore.Timestamp;
    acceptedPolicies?: Record<string, Record<string, string>>;
}

interface CombinedUserRecord {
    uid: string;
    // From Auth
    authEmail?: string;
    authDisplayName?: string;
    authDisabled?: boolean;
    authCreatedAt?: string;
    authLastSignIn?: string;
    // From Firestore
    firestoreExists: boolean;
    firestoreEmail?: string;
    firestoreRole?: string;
    firestoreAcceptedPolicies?: string[];
}

function initializeFirebase(): admin.firestore.Firestore {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ Service account key not found at firebase/service-account-key.json');
        console.error('💡 Download the service account key from Firebase Console');
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

    return admin.firestore();
}

function formatPolicies(policies: Record<string, Record<string, string>> | undefined): string[] {
    if (!policies) return [];
    return Object.keys(policies);
}

async function listAuthUsers(): Promise<Map<string, admin.auth.UserRecord>> {
    const auth = admin.auth();
    const users = new Map<string, admin.auth.UserRecord>();
    let pageToken: string | undefined;
    let pageCount = 0;

    console.log('\n📋 Fetching users from Firebase Auth...\n');

    while (true) {
        const result = await auth.listUsers(1000, pageToken);
        pageCount++;

        for (const user of result.users) {
            users.set(user.uid, user);
        }

        console.log(`   Page ${pageCount}: fetched ${result.users.length} users (total: ${users.size})`);

        if (!result.pageToken) {
            break;
        }
        pageToken = result.pageToken;
    }

    return users;
}

async function listFirestoreUsers(db: admin.firestore.Firestore): Promise<Map<string, FirestoreUserRecord>> {
    const users = new Map<string, FirestoreUserRecord>();
    let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
    let pageCount = 0;

    console.log('\n📋 Fetching users from Firestore...\n');

    while (true) {
        let query = db.collection(USERS_COLLECTION).orderBy('__name__').limit(PAGE_SIZE);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        pageCount++;

        if (snapshot.empty) {
            break;
        }

        for (const doc of snapshot.docs) {
            const data = doc.data();
            users.set(doc.id, {
                id: doc.id,
                email: data.email,
                role: data.role,
                preferredLanguage: data.preferredLanguage,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                acceptedPolicies: data.acceptedPolicies,
            });
        }

        console.log(`   Page ${pageCount}: fetched ${snapshot.docs.length} users (total: ${users.size})`);

        if (snapshot.docs.length < PAGE_SIZE) {
            break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    return users;
}

function combineUserData(
    authUsers: Map<string, admin.auth.UserRecord>,
    firestoreUsers: Map<string, FirestoreUserRecord>,
): CombinedUserRecord[] {
    const combined: CombinedUserRecord[] = [];
    const allUids = new Set([...authUsers.keys(), ...firestoreUsers.keys()]);

    for (const uid of allUids) {
        const authUser = authUsers.get(uid);
        const fsUser = firestoreUsers.get(uid);

        combined.push({
            uid,
            // Auth data
            authEmail: authUser?.email,
            authDisplayName: authUser?.displayName,
            authDisabled: authUser?.disabled,
            authCreatedAt: authUser?.metadata.creationTime,
            authLastSignIn: authUser?.metadata.lastSignInTime,
            // Firestore data
            firestoreExists: !!fsUser,
            firestoreEmail: fsUser?.email,
            firestoreRole: fsUser?.role,
            firestoreAcceptedPolicies: formatPolicies(fsUser?.acceptedPolicies),
        });
    }

    return combined;
}

function printUserTable(users: CombinedUserRecord[]): void {
    console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('                                        STAGING USERS');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════\n');

    if (users.length === 0) {
        console.log('No users found.');
        return;
    }

    // Sort by email for easier reading
    const sortedUsers = [...users].sort((a, b) => {
        const emailA = a.authEmail || '';
        const emailB = b.authEmail || '';
        return emailA.localeCompare(emailB);
    });

    for (const user of sortedUsers) {
        // Highlight the known-good admin
        const isKnownGood = user.authEmail === 'admin@snowmonkey.co.uk';
        const prefix = isKnownGood ? '✅' : '❓';

        console.log(`${prefix} UID: ${user.uid}`);
        console.log(`   Auth Email:        ${user.authEmail || 'N/A'}`);
        console.log(`   Auth Display Name: ${user.authDisplayName || 'N/A'}`);
        console.log(`   Auth Disabled:     ${user.authDisabled ?? 'N/A'}`);
        console.log(`   Auth Created:      ${user.authCreatedAt || 'N/A'}`);
        console.log(`   Auth Last Sign-In: ${user.authLastSignIn || 'N/A'}`);
        console.log(`   Firestore Exists:  ${user.firestoreExists}`);
        console.log(`   Firestore Role:    ${user.firestoreRole || 'N/A'}`);
        console.log(`   Firestore Email:   ${user.firestoreEmail || 'N/A (not stored)'}`);
        console.log(`   Accepted Policies: ${user.firestoreAcceptedPolicies?.length ? user.firestoreAcceptedPolicies.join(', ') : 'none'}`);
        console.log('');
    }

    console.log('-'.repeat(100));
    console.log(`\nTotal users: ${users.length}`);
    console.log('\n✅ = Known correct user (admin@snowmonkey.co.uk)');
    console.log('❓ = User needs review\n');
}

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('              LIST STAGING USERS - Auth + Firestore Combined');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const db = initializeFirebase();

    // Fetch from both Auth and Firestore
    const authUsers = await listAuthUsers();
    const firestoreUsers = await listFirestoreUsers(db);

    // Combine and display
    const combined = combineUserData(authUsers, firestoreUsers);
    printUserTable(combined);

    // Clean exit
    await admin.app().delete();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error.message || error);
        process.exit(1);
    });
