#!/usr/bin/env npx tsx
/**
 * Usage:
 *   ./scripts/delete-prod-data.ts <emulator|production> [collectionId...]
 *
 * If collection IDs are supplied, only those collections (minus protected ones) are deleted.
 * Otherwise, every non-protected collection will be purged.
 */
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import type { CollectionReference, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { stdin as input, stdout as output } from 'node:process';
import * as path from 'path';
import { createInterface } from 'readline/promises';
import { initializeFirebase, parseEnvironment, type ScriptEnvironment } from './firebase-init';

const envPath = path.join(__dirname, '../functions/.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const PROTECTED_COLLECTIONS = new Set(['users']);
const BATCH_SIZE = 200;

async function resolveFirestore(env: ScriptEnvironment): Promise<Firestore> {
    if (env.isEmulator) {
        const firebaseModule = await import('../functions/src/firebase');
        return firebaseModule.getFirestore();
    }

    return admin.firestore();
}

async function getCollectionDocumentCount(collection: CollectionReference): Promise<number | null> {
    try {
        const aggregateSnapshot = await collection.count().get();
        return aggregateSnapshot.data().count;
    } catch (error) {
        console.warn(`   ⚠️  Unable to count documents in ${collection.path}: ${(error as Error).message}`);
        return null;
    }
}

async function deleteNestedCollections(doc: QueryDocumentSnapshot): Promise<number> {
    const subcollections = await doc.ref.listCollections();
    let deletedCount = 0;

    for (const sub of subcollections) {
        deletedCount += await deleteCollectionDeep(sub);
    }

    return deletedCount;
}

async function deleteCollectionDeep(collection: CollectionReference): Promise<number> {
    let totalDeleted = 0;

    while (true) {
        const snapshot = await collection.limit(BATCH_SIZE).get();
        if (snapshot.empty) {
            break;
        }

        const batch = collection.firestore.batch();

        for (const doc of snapshot.docs) {
            totalDeleted += await deleteNestedCollections(doc);
            batch.delete(doc.ref);
        }

        await batch.commit();
        totalDeleted += snapshot.size;
        console.log(`      • Deleted ${snapshot.size} document(s) from ${collection.path}`);
    }

    return totalDeleted;
}

async function confirmDestructiveAction(collections: CollectionReference[], projectId: string | undefined): Promise<void> {
    console.log(`\n⚠️  This will delete ALL documents from the following collections (excluding protected ones):`);
    for (const collection of collections) {
        console.log(`   • ${collection.id}`);
    }
    console.log(`\n⚠️  Target Firebase project: ${projectId ?? 'unknown'}`);
    console.log('⚠️  THIS ACTION CANNOT BE UNDONE.');

    const rl = createInterface({ input, output });
    try {
        let answer = (await rl.question('\nType "yes" to continue: ')).trim();
        if (answer.toLowerCase() !== 'yes') {
            throw new Error('Deletion cancelled at first confirmation.');
        }

        answer = (await rl.question('Type "DELETE ALL DATA" to confirm: ')).trim();
        if (answer !== 'DELETE ALL DATA') {
            throw new Error('Deletion cancelled at second confirmation.');
        }
    } finally {
        rl.close();
    }
}

async function wipeCollections(firestore: Firestore, requestedCollectionIds: string[]): Promise<void> {
    const collections = await firestore.listCollections();
    let deletableCollections = collections.filter((collection) => !PROTECTED_COLLECTIONS.has(collection.id));

    if (requestedCollectionIds.length > 0) {
        const requested = new Set(requestedCollectionIds);
        deletableCollections = deletableCollections.filter((collection) => requested.has(collection.id));

        if (deletableCollections.length === 0) {
            console.log('⚠️  No matching collections found for the requested subset (after excluding protected ones).');
            return;
        }
    }

    if (deletableCollections.length === 0) {
        console.log('⚠️  No collections found to delete (other than protected ones).');
        return;
    }

    console.log('📊 Collection summary (protected collections are skipped):');

    for (const collection of collections) {
        const count = await getCollectionDocumentCount(collection);
        const label = PROTECTED_COLLECTIONS.has(collection.id) ? '(protected)' : '';
        const countLabel = count === null ? 'unknown' : count.toString();
        if (requestedCollectionIds.length > 0 && !requestedCollectionIds.includes(collection.id) && !PROTECTED_COLLECTIONS.has(collection.id)) {
            console.log(`   • ${collection.id} ${label} - ${countLabel} document(s) (skipped - not requested)`);
            continue;
        }
        console.log(`   • ${collection.id} ${label} - ${countLabel} document(s)`);
    }

    await confirmDestructiveAction(deletableCollections, firestore.app.options.projectId);

    console.log('\n🗑️  Starting deletion...');
    let totalDeleted = 0;

    for (const collection of deletableCollections) {
        console.log(`   ↳ Deleting collection ${collection.id}...`);
        const deleted = await deleteCollectionDeep(collection);
        totalDeleted += deleted;
        console.log(`     ✅ Finished ${collection.id}: removed ${deleted} document(s)`);
    }

    console.log('\n✅ Deletion complete.');
    console.log(`   • Total documents deleted: ${totalDeleted}`);
    console.log(`   • Protected collections skipped: ${Array.from(PROTECTED_COLLECTIONS).join(', ')}`);
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);
    const env = parseEnvironment(rawArgs);
    const requestedCollections = rawArgs.slice(1).map((name) => name.trim()).filter((name) => name.length > 0);
    const uniqueRequestedCollections = Array.from(new Set(requestedCollections));
    initializeFirebase(env);

    if (env.isEmulator) {
        console.log('⚠️  You are connected to the EMULATOR. This script will clear emulator data only.');
    } else {
        console.log('⚠️  You are connected to PRODUCTION. Ensure you intend to wipe live data.');
    }

    try {
        const firestore = await resolveFirestore(env);
        await wipeCollections(firestore, uniqueRequestedCollections);
    } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('cancelled')) {
            console.log(`❌ ${error.message}`);
            process.exit(0);
        }

        console.error('💥 Failed to delete data:', error);
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

export { main as deleteProdData };
