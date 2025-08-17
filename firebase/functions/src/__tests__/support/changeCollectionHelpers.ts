import * as admin from 'firebase-admin';
import type { DocumentData } from 'firebase-admin/firestore';
import {db} from "./firebase-emulator";

/**
 * Helper functions for querying change collections in tests
 */

export interface ChangeDocument extends DocumentData {
    changeType: 'created' | 'updated' | 'deleted';
    timestamp: admin.firestore.Timestamp;
    metadata: {
        priority: 'high' | 'medium' | 'low';
        affectedUsers: string[];
        changedFields?: string[];
    };
}

export interface GroupChangeDocument extends ChangeDocument {
    groupId: string;
    changeUserId?: string;
}

export interface ExpenseChangeDocument extends ChangeDocument {
    expenseId: string;
    groupId: string;
    changeUserId?: string;
}

export interface BalanceChangeDocument {
    groupId: string;
    changeType: 'recalculated';
    timestamp: admin.firestore.Timestamp;
    metadata: {
        priority: 'high';
        affectedUsers: string[];
        triggeredBy: 'expense' | 'settlement';
        triggerId: string;
    };
}

/**
 * Poll for a change document matching the specified criteria
 */
export async function pollForChange<T extends DocumentData>(
    collection: 'group-changes' | 'expense-changes' | 'balance-changes',
    matcher: (doc: T) => boolean,
    options: {
        timeout?: number;
        interval?: number;
        groupId?: string;
    } = {}
): Promise<T | null> {
    const { timeout = 3000, interval = 100, groupId } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        let query = db.collection(collection) as unknown as admin.firestore.Query<T>;
        
        // Add groupId filter if provided
        if (groupId) {
            query = query.where('groupId', '==', groupId);
        }
        
        // Order by timestamp descending to get most recent first
        query = query.orderBy('timestamp', 'desc').limit(10);
        
        const snapshot = await query.get();
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (matcher(data)) {
                return data;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    return null;
}

/**
 * Get all change documents for a specific group
 */
export async function getGroupChanges(groupId: string): Promise<GroupChangeDocument[]> {
    const snapshot = await db.collection('group-changes')
        .where('groupId', '==', groupId)
        .orderBy('timestamp', 'desc')
        .get();
    
    return snapshot.docs.map(doc => doc.data() as GroupChangeDocument);
}

/**
 * Get all expense change documents for a specific group
 */
export async function getExpenseChanges(groupId: string): Promise<ExpenseChangeDocument[]> {
    const snapshot = await db.collection('expense-changes')
        .where('groupId', '==', groupId)
        .orderBy('timestamp', 'desc')
        .get();
    
    return snapshot.docs.map(doc => doc.data() as ExpenseChangeDocument);
}

/**
 * Get all balance change documents for a specific group
 */
export async function getBalanceChanges(groupId: string): Promise<BalanceChangeDocument[]> {
    const snapshot = await db.collection('balance-changes')
        .where('groupId', '==', groupId)
        .orderBy('timestamp', 'desc')
        .get();
    
    return snapshot.docs.map(doc => doc.data() as BalanceChangeDocument);
}

/**
 * Clear all change documents for a specific group
 */
export async function clearGroupChangeDocuments(groupId: string): Promise<void> {
    const collections = ['group-changes', 'expense-changes', 'balance-changes'];
    
    for (const collection of collections) {
        const snapshot = await db.collection(collection)
            .where('groupId', '==', groupId)
            .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        
        if (!snapshot.empty) {
            await batch.commit();
        }
    }
}

/**
 * Wait for debouncing to complete (waits for the maximum debounce time)
 */
export async function waitForDebounce(type: 'group' | 'expense' | 'settlement' = 'group'): Promise<void> {
    // Groups: 500ms, Expenses/Settlements: 200ms
    // Add some buffer time
    const debounceTime = type === 'group' ? 600 : 300;
    await new Promise(resolve => setTimeout(resolve, debounceTime));
}

/**
 * Count change documents created in the last N milliseconds
 */
export async function countRecentChanges(
    collection: 'group-changes' | 'expense-changes' | 'balance-changes',
    groupId: string,
    withinMs: number = 1000
): Promise<number> {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - withinMs);
    
    const snapshot = await db.collection(collection)
        .where('groupId', '==', groupId)
        .where('timestamp', '>', cutoff)
        .get();
    
    return snapshot.size;
}