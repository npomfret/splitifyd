#!/usr/bin/env npx tsx
import * as admin from 'firebase-admin';
import { Firestore, DocumentSnapshot, FieldPath } from 'firebase-admin/firestore';
import { FirestoreCollections } from '@splitifyd/shared';
import { parseEnvironment, initializeFirebase } from './firebase-init';

/**
 * Script to paginate through user documents in Firestore
 * Usage:
 *   tsx paginate-users.ts emulator [pageSize] [maxPages]
 *   tsx paginate-users.ts production [pageSize] [maxPages]
 */

// Parse command line arguments
const args = process.argv.slice(2);
const targetEnvironment = args[0];
const pageSize = parseInt(args[1]) || 10;
const maxPages = parseInt(args[2]) || 5;

// Parse command line arguments and initialize Firebase
const env = parseEnvironment(process.argv.slice(2));
initializeFirebase(env);

const { isEmulator, environment } = env;
console.log(`🎯 Paginating through users in ${environment}`);
console.log(`📄 Page size: ${pageSize}, Max pages: ${maxPages}`);

// We'll get these instances dynamically
let firestoreDb: Firestore;

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
        } catch (error) {
            console.error('❌ Failed to get Firestore instance:', error);
            throw error;
        }
    } else {
        // Emulator mode - import everything normally
        console.log('🔗 Importing Firebase module for emulator...');
        const firebaseModule = await import('../functions/src/firebase');
        firestoreDb = firebaseModule.getFirestore();
        console.log('✅ Emulator Firestore instance obtained');
    }
}

/**
 * Format user data as single line JSON
 */
function formatUserData(doc: DocumentSnapshot): string {
    const data = doc.data();
    if (!data) return JSON.stringify({ id: doc.id, data: null });

    // Convert Firestore Timestamps to ISO strings for JSON serialization
    const cleanData = { ...data };

    // Handle createdAt timestamp
    if (cleanData.createdAt && cleanData.createdAt.toDate) {
        cleanData.createdAt = cleanData.createdAt.toDate().toISOString();
    }

    // Handle updatedAt timestamp
    if (cleanData.updatedAt && cleanData.updatedAt.toDate) {
        cleanData.updatedAt = cleanData.updatedAt.toDate().toISOString();
    }

    // Handle any other timestamp fields
    if (cleanData.themeColor && cleanData.themeColor.assignedAt) {
        cleanData.themeColor.assignedAt = new Date(cleanData.themeColor.assignedAt).toISOString();
    }

    // Create final document with ID
    const docWithId = {
        id: doc.id,
        ...cleanData,
    };

    return JSON.stringify(docWithId);
}

/**
 * Get total user count
 */
async function getTotalUserCount(): Promise<number> {
    const snapshot = await firestoreDb.collection(FirestoreCollections.USERS).get();
    return snapshot.size;
}

/**
 * Paginate through users
 */
async function paginateUsers(): Promise<void> {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📄 PAGINATING THROUGH USER DOCUMENTS...');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    try {
        // Get total count first
        console.log('📊 Getting total user count...');
        const totalUsers = await getTotalUserCount();
        const totalPages = Math.ceil(totalUsers / pageSize);

        console.log(`Found ${totalUsers} total users across ${totalPages} pages`);
        console.log(`Will display up to ${Math.min(maxPages, totalPages)} pages\n`);

        let query = firestoreDb.collection(FirestoreCollections.USERS).orderBy(FieldPath.documentId()).limit(pageSize);

        let pageNumber = 1;
        let lastDoc: DocumentSnapshot | null = null;

        while (pageNumber <= maxPages && pageNumber <= totalPages) {
            console.log(`📄 PAGE ${pageNumber}/${Math.min(maxPages, totalPages)}:`);
            console.log('─'.repeat(80));

            // Apply pagination cursor if we have one
            if (lastDoc) {
                query = firestoreDb.collection(FirestoreCollections.USERS).orderBy(FieldPath.documentId()).startAfter(lastDoc).limit(pageSize);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                console.log('📭 No more users found');
                break;
            }

            snapshot.docs.forEach((doc, index) => {
                const globalIndex = (pageNumber - 1) * pageSize + index + 1;
                console.log(`${formatUserData(doc)}`);
            });

            // Store the last document for pagination
            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            console.log('');

            // If we have more pages to show and haven't hit our max, ask user if they want to continue
            if (pageNumber < Math.min(maxPages, totalPages)) {
                pageNumber++;

                // Add a small delay for readability
                await new Promise((resolve) => setTimeout(resolve, 500));
            } else {
                break;
            }
        }

        // Show summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 PAGINATION SUMMARY:');
        console.log(`  - Total users in database: ${totalUsers}`);
        console.log(`  - Pages displayed: ${Math.min(pageNumber, maxPages)}`);
        console.log(`  - Users shown: ${Math.min(pageNumber * pageSize, totalUsers)}`);

        if (totalPages > maxPages) {
            console.log(`  - Remaining pages: ${totalPages - maxPages}`);
            console.log(`  - To see more pages, increase maxPages parameter`);
        }
        console.log('═══════════════════════════════════════════════════════');
    } catch (error) {
        console.error('❌ Error during pagination:', error);
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

        // Start pagination
        await paginateUsers();

        console.log('✅ User pagination completed successfully!');
    } catch (error) {
        console.error('❌ User pagination failed:', error);
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

export { main as paginateUsers };
