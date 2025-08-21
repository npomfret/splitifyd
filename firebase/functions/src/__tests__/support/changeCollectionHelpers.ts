import * as admin from 'firebase-admin';
import type { DocumentData } from 'firebase-admin/firestore';
import {db} from "./firebase-emulator";
import { FirestoreCollections, ChangeCollectionName } from '../../shared/shared-types';

/**
 * Helper functions for querying change collections in tests
 */

// New minimal change document structure
export interface MinimalChangeDocument extends DocumentData {
    id: string;
    type: 'group' | 'expense' | 'settlement';
    action: 'created' | 'updated' | 'deleted';
    timestamp: admin.firestore.Timestamp;
    users: string[];
    groupId?: string; // Only for expense/settlement
}

export interface MinimalBalanceChangeDocument extends DocumentData {
    groupId: string;
    type: 'balance';
    action: 'recalculated';
    timestamp: admin.firestore.Timestamp;
    users: string[];
}

// Type aliases for test compatibility
export interface GroupChangeDocument extends MinimalChangeDocument {
    type: 'group';
}

export interface ExpenseChangeDocument extends MinimalChangeDocument {
    type: 'expense';
    groupId: string;
}

export interface SettlementChangeDocument extends MinimalChangeDocument {
    type: 'settlement';
    groupId: string;
}

export interface BalanceChangeDocument extends MinimalBalanceChangeDocument {}

/**
 * @deprecated use the ApiDriver instead
 */
export async function pollForChange<T extends DocumentData>(
    collection: ChangeCollectionName,
    matcher: (doc: T) => boolean,
    options: {
        timeout?: number;
        interval?: number;
        groupId?: string;
        initialDelay?: number; // Delay before first poll
        debug?: boolean; // Enable diagnostic logging
    } = {}
): Promise<T | null> {
    const { 
        timeout = 10000,  // Increased default timeout for trigger tests
        interval = 250,   // Increased interval to reduce database load
        groupId, 
        initialDelay = 500,  // Wait for triggers to initialize
        debug = false 
    } = options;
    
    const startTime = Date.now();
    let attempts = 0;
    let allDocsSeen: T[] = [];
    
    // Initial delay to let triggers fire
    if (initialDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, initialDelay));
    }
    
    while (Date.now() - startTime < timeout) {
        attempts++;
        let query = db.collection(collection) as unknown as admin.firestore.Query<T>;
        
        // Add groupId filter if provided
        if (groupId) {
            // GROUP_CHANGES uses 'id' field, others use 'groupId'
            const filterField = collection === FirestoreCollections.GROUP_CHANGES ? 'id' : 'groupId';
            query = query.where(filterField, '==', groupId);
        }
        
        // Order by timestamp descending to get most recent first
        query = query.orderBy('timestamp', 'desc').limit(20); // Increased limit
        
        const snapshot = await query.get();
        
        if (debug && snapshot.size > 0) {
            console.log(`[pollForChange] Attempt ${attempts}: Found ${snapshot.size} documents in ${collection}`);
        }
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            allDocsSeen.push(data);
            
            if (debug) {
                console.log(`[pollForChange] Checking document:`, {
                    id: data.id,
                    type: data.type,
                    action: data.action,
                    groupId: data.groupId,
                    timestamp: data.timestamp?.toMillis()
                });
            }
            
            if (matcher(data)) {
                if (debug) {
                    console.log(`[pollForChange] Match found after ${attempts} attempts, ${Date.now() - startTime}ms`);
                }
                return data;
            }
        }
        
        // Use exponential backoff for retries (up to 1 second)
        const nextInterval = Math.min(interval * Math.pow(1.5, Math.floor(attempts / 3)), 1000);
        await new Promise(resolve => setTimeout(resolve, nextInterval));
    }
    
    if (debug) {
        console.log(`[pollForChange] Timeout after ${attempts} attempts. Documents seen:`, allDocsSeen);
    }
    
    return null;
}

/**
 * Clear all change documents for a specific group
 */
export async function clearGroupChangeDocuments(groupId: string): Promise<void> {
    const collections = [FirestoreCollections.GROUP_CHANGES, FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];
    
    for (const collection of collections) {
        // GROUP_CHANGES uses 'id' field, others use 'groupId'
        const filterField = collection === FirestoreCollections.GROUP_CHANGES ? 'id' : 'groupId';
        const snapshot = await db.collection(collection)
            .where(filterField, '==', groupId)
            .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        
        if (!snapshot.empty) {
            await batch.commit();
        }
    }
}

/**
 * Wait for triggers to complete processing (waits for async operations)
 * @deprecated this is bullshit
 */
export async function waitForTriggerProcessing(type: 'group' | 'expense' | 'settlement' = 'group'): Promise<void> {
    // Allow time for triggers to process and create change documents
    // Different wait times based on complexity
    const waitTime = type === 'group' ? 600 : 300;
    await new Promise(resolve => setTimeout(resolve, waitTime));
}


/**
 * Count change documents created in the last N milliseconds
 */
export async function countRecentChanges(
    collection: ChangeCollectionName,
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

/**
 * Create a matcher that checks for an exact settlement change document
 * This ensures we're finding the specific document created by our test
 */
export function createExactSettlementChangeMatcher(
    settlementId: string,
    groupId: string,
    expectedAction: 'created' | 'updated' | 'deleted',
    expectedUsers: string[]
): (doc: any) => boolean {
    return (doc: any) => {
        // Check all required fields match exactly
        if (doc.id !== settlementId) return false;
        if (doc.groupId !== groupId) return false;
        if (doc.type !== 'settlement') return false;
        if (doc.action !== expectedAction) return false;
        
        // Check users array contains all expected users (order doesn't matter)
        if (!doc.users || !Array.isArray(doc.users)) return false;
        
        // Sort both arrays to compare regardless of order
        const sortedExpected = [...expectedUsers].sort();
        const sortedActual = [...doc.users].sort();
        
        if (sortedActual.length !== sortedExpected.length) return false;
        
        for (let i = 0; i < sortedExpected.length; i++) {
            if (sortedActual[i] !== sortedExpected[i]) return false;
        }
        
        // Ensure timestamp is recent (within last 30 seconds)
        if (!doc.timestamp) return false;
        const timestampMs = doc.timestamp.toMillis();
        const thirtySecondsAgo = Date.now() - 30000;
        if (timestampMs < thirtySecondsAgo) return false;
        
        return true;
    };
}

/**
 * Create a matcher that checks for an exact balance change document
 * This ensures we're finding the specific document created by our test
 */
export function createExactBalanceChangeMatcher(
    groupId: string,
    expectedUsers: string[]
): (doc: any) => boolean {
    return (doc: any) => {
        // Check all required fields match exactly
        if (doc.groupId !== groupId) return false;
        if (doc.type !== 'balance') return false;
        if (doc.action !== 'recalculated') return false;
        
        // Check users array contains all expected users (order doesn't matter)
        if (!doc.users || !Array.isArray(doc.users)) return false;
        
        // Sort both arrays to compare regardless of order
        const sortedExpected = [...expectedUsers].sort();
        const sortedActual = [...doc.users].sort();
        
        if (sortedActual.length !== sortedExpected.length) return false;
        
        for (let i = 0; i < sortedExpected.length; i++) {
            if (sortedActual[i] !== sortedExpected[i]) return false;
        }
        
        // Ensure timestamp is recent (within last 30 seconds)
        if (!doc.timestamp) return false;
        const timestampMs = doc.timestamp.toMillis();
        const thirtySecondsAgo = Date.now() - 30000;
        if (timestampMs < thirtySecondsAgo) return false;
        
        return true;
    };
}
