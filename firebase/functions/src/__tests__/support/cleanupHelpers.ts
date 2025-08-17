import {db} from "./firebase-emulator";

/**
 * Utility functions for cleaning up test data from Firebase emulator
 */

/**
 * Clear all documents from a Firestore collection
 */
export async function clearCollection(collectionPath: string): Promise<void> {
    const collection = db.collection(collectionPath);
    const batchSize = 100;

    const query = collection.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, batchSize, resolve, reject);
    });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, batchSize: number, resolve: () => void, reject: (err: any) => void): Promise<void> {
    try {
        const snapshot = await query.get();

        // When there are no documents left, we are done
        if (snapshot.size === 0) {
            resolve();
            return;
        }

        // Delete documents in a batch
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        // Recurse on the next process tick, to avoid exploding the stack
        process.nextTick(() => {
            deleteQueryBatch(query, batchSize, resolve, reject);
        });
    } catch (err) {
        reject(err);
    }
}

/**
 * Clear all test data from the emulator
 * This is a nuclear option - clears everything
 */
export async function clearAllTestData(): Promise<void> {
    console.log('Clearing all test data from emulator...');

    // Main collections to clear (including new change tracking collections)
    const collections = [
        'users', 
        'groups', 
        'expenses', 
        'settlements', 
        'userGroups', 
        'balances', 
        'shareLinks', 
        'settlementBalances',
        'group-changes',
        'expense-changes', 
        'balance-changes'
    ];

    // Clear all main collections
    const promises = collections.map((collection) => clearCollection(collection));
    await Promise.all(promises);

    console.log('Test data cleared successfully');
}
