/**
 * Inspect user documents in Firestore to understand their current structure
 * Usage: npx tsx scripts/inspect-users.ts staging
 */

import * as admin from 'firebase-admin';
import { getEnvironment, initializeFirebase } from './firebase-init';

async function main() {
    const env = getEnvironment(process.argv.slice(2));

    console.log('🔍 Inspecting user documents...');
    console.log(`   Environment: ${env.environment}`);
    console.log(`   Instance: ${env.instanceName}`);
    console.log('');

    await initializeFirebase(env);

    const db = admin.firestore();
    const usersCollection = db.collection('users');

    // Get first page of users (limit 10)
    const snapshot = await usersCollection.limit(10).get();

    console.log(`Found ${snapshot.size} user documents:\n`);

    for (const doc of snapshot.docs) {
        console.log('━'.repeat(60));
        console.log(`Document ID: ${doc.id}`);
        console.log('─'.repeat(60));

        const data = doc.data();

        // Pretty print the document structure
        console.log(JSON.stringify(data, (key, value) => {
            // Handle Firestore Timestamp objects
            if (value && typeof value === 'object' && value.constructor?.name === 'Timestamp') {
                return `[Timestamp: ${value.toDate().toISOString()}]`;
            }
            return value;
        }, 2));

        console.log('');
    }

    console.log('━'.repeat(60));
    console.log(`Total documents inspected: ${snapshot.size}`);
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
