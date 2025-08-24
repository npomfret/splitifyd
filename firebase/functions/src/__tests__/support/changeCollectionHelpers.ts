import * as admin from 'firebase-admin';
import type { DocumentData } from 'firebase-admin/firestore';

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

