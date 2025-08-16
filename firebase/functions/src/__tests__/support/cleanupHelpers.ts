import * as admin from 'firebase-admin';

/**
 * Utility functions for cleaning up test data from Firebase emulator
 */

/**
 * Clear all documents from a Firestore collection
 */
export async function clearCollection(collectionPath: string): Promise<void> {
    const db = admin.firestore();
    const collection = db.collection(collectionPath);
    const batchSize = 100;
    
    const query = collection.limit(batchSize);
    
    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, batchSize, resolve, reject);
    });
}

async function deleteQueryBatch(
    query: FirebaseFirestore.Query,
    batchSize: number,
    resolve: () => void,
    reject: (err: any) => void
): Promise<void> {
    try {
        const snapshot = await query.get();
        
        // When there are no documents left, we are done
        if (snapshot.size === 0) {
            resolve();
            return;
        }
        
        // Delete documents in a batch
        const batch = admin.firestore().batch();
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
 * Clear all subcollections of a document
 */
export async function clearSubcollections(docPath: string, subcollectionNames: string[]): Promise<void> {
    const promises = subcollectionNames.map(async (subcollection) => {
        const path = `${docPath}/${subcollection}`;
        await clearCollection(path);
    });
    await Promise.all(promises);
}

/**
 * Clear all test data from the emulator
 * This is a nuclear option - clears everything
 */
export async function clearAllTestData(): Promise<void> {
    console.log('Clearing all test data from emulator...');
    
    // Main collections to clear
    const collections = [
        'users',
        'groups', 
        'expenses',
        'settlements',
        'userGroups',
        'balances',
        'shareLinks',
        'settlementBalances'
    ];
    
    // Clear all main collections
    const promises = collections.map(collection => clearCollection(collection));
    await Promise.all(promises);
    
    console.log('Test data cleared successfully');
}

/**
 * Clear specific test users from Firebase Auth
 */
export async function clearTestUsers(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    
    const auth = admin.auth();
    const deletePromises = userIds.map(async (uid) => {
        try {
            await auth.deleteUser(uid);
        } catch (error: any) {
            // Ignore if user doesn't exist
            if (error.code !== 'auth/user-not-found') {
                console.warn(`Failed to delete user ${uid}:`, error.message);
            }
        }
    });
    
    await Promise.all(deletePromises);
}

/**
 * Tracker for resources created during a test
 * Automatically cleans them up when cleanup() is called
 */
export class TestResourceTracker {
    private userIds: Set<string> = new Set();
    private groupIds: Set<string> = new Set();
    private expenseIds: Set<string> = new Set();
    
    trackUser(userId: string): void {
        this.userIds.add(userId);
    }
    
    trackGroup(groupId: string): void {
        this.groupIds.add(groupId);
    }
    
    trackExpense(expenseId: string): void {
        this.expenseIds.add(expenseId);
    }
    
    async cleanup(): Promise<void> {
        const db = admin.firestore();
        const batch = db.batch();
        
        // Delete groups (this should cascade to expenses and other related data)
        this.groupIds.forEach(groupId => {
            batch.delete(db.collection('groups').doc(groupId));
        });
        
        // Delete user documents
        this.userIds.forEach(userId => {
            batch.delete(db.collection('users').doc(userId));
        });
        
        // Commit the batch
        if (this.groupIds.size > 0 || this.userIds.size > 0) {
            await batch.commit();
        }
        
        // Delete auth users
        if (this.userIds.size > 0) {
            await clearTestUsers(Array.from(this.userIds));
        }
        
        // Clear the sets
        this.userIds.clear();
        this.groupIds.clear();
        this.expenseIds.clear();
    }
}

/**
 * Use the Firebase Emulator REST API to clear all data
 * This is the cleanest approach but requires knowing the emulator ports
 */
export async function resetEmulator(): Promise<void> {
    try {
        // Clear Firestore
        const firestoreResponse = await fetch(
            'http://localhost:8080/emulator/v1/projects/demo-test/databases/(default)/documents',
            { method: 'DELETE' }
        );
        
        if (!firestoreResponse.ok) {
            console.warn('Failed to clear Firestore emulator:', firestoreResponse.statusText);
        }
        
        // Note: Firebase Auth emulator doesn't have a clear endpoint, 
        // so we can't clear auth users this way
        
    } catch (error) {
        console.warn('Failed to reset emulator:', error);
    }
}