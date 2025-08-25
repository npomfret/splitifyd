import * as admin from 'firebase-admin/firestore';
import {removeUndefinedFields} from './firestore-helpers';
import {DocumentData} from "firebase-admin/firestore";

export type ChangeType = 'created' | 'updated' | 'deleted';
export type ChangePriority = 'high' | 'medium' | 'low';

export interface ChangeMetadata {
    priority: ChangePriority;
    affectedUsers: string[];
    changedFields?: string[];
}


/**
 * Get list of changed fields between two documents
 */
export function getChangedFields(before: admin.DocumentSnapshot | undefined, after: admin.DocumentSnapshot | undefined): string[] {
    if (!before?.exists) return ['*']; // New document
    if (!after?.exists) return ['*']; // Deleted document

    const beforeData = before.data() || {};
    const afterData = after.data() || {};

    return extractChangedFields(beforeData, afterData);
}

/**
 * Calculate priority based on changed fields and change type
 */
export function calculatePriority(
    changeType: ChangeType,
    changedFields: string[],
    documentType: 'group' | 'expense' | 'settlement'
): ChangePriority {
    // Deletions and creations are always high priority
    if (changeType === 'created' || changeType === 'deleted') {
        return 'high';
    }

    // Define critical fields per document type
    const criticalFields: Record<string, string[]> = {
        group: ['memberIds', 'name', 'deletedAt'],
        expense: ['amount', 'currency', 'paidBy', 'splits', 'participants', 'deletedAt'],
        settlement: ['amount', 'currency', 'payerId', 'payeeId', 'from', 'to']
    };

    const importantFields: Record<string, string[]> = {
        group: ['description'],
        expense: ['description', 'category', 'date'],
        settlement: ['note', 'date']
    };

    const critical = criticalFields[documentType] || [];
    const important = importantFields[documentType] || [];

    // Check for critical field changes
    if (changedFields.includes('*') || changedFields.some(field => critical.includes(field))) {
        return 'high';
    }

    // Check for important field changes
    if (changedFields.some(field => important.includes(field))) {
        return 'medium';
    }

    // All other changes are low priority
    return 'low';
}

function extractChangedFields(afterData: DocumentData, beforeData: DocumentData) {
    const changedFields: string[] = [];

    // Compare nested data fields
    Object.keys(afterData).forEach((key) => {
        if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
            changedFields.push(key);
        }
    });

    Object.keys(beforeData).forEach((key) => {
        if (!(key in afterData)) {
            changedFields.push(key);
        }
    });

    return changedFields;
}

/**
 * Extract changed fields from nested group structure
 */
export function getGroupChangedFields(before: admin.DocumentSnapshot | undefined, after: admin.DocumentSnapshot | undefined): string[] {
    if (!before?.exists) return ['*'];
    if (!after?.exists) return ['*'];

    const beforeData = before.data()?.data || {};
    const afterData = after.data()?.data || {};

    return extractChangedFields(afterData, beforeData);
}

/**
 * Determine if a change should trigger a notification based on user context
 */
export function shouldNotifyUser(
    userId: string,
    changeUserId: string | undefined,
    changedFields: string[],
    priority: ChangePriority
): boolean {
    // Always notify for high priority changes
    if (priority === 'high') {
        return true;
    }

    // For medium priority, only notify if change was made by another user
    if (priority === 'medium') {
        return changeUserId !== userId;
    }

    // For low priority changes, check if it's a field that affects the user
    const nonNotifiableFields = ['lastViewed', 'analytics', 'metadata', 'updatedAt'];
    const hasNotifiableChange = changedFields.some(field => !nonNotifiableFields.includes(field));

    // Only notify for low priority if:
    // 1. Change was made by another user AND
    // 2. At least one changed field is notifiable
    return changeUserId !== userId && hasNotifiableChange;
}

/**
 * Create a standardized change document
 */
export function createChangeDocument(
    entityId: string,
    entityType: 'group' | 'expense' | 'settlement',
    changeType: ChangeType,
    metadata: ChangeMetadata,
    additionalData: Record<string, any> = {}
): Record<string, any> {
    const baseDoc = {
        [`${entityType}Id`]: entityId,
        changeType,
        timestamp: admin.Timestamp.now(),
        metadata,
        ...additionalData
    };

    // Add entity-specific fields
    if (entityType === 'expense' || entityType === 'settlement') {
        // These types should include groupId
        if (!additionalData.groupId) {
            throw new Error(`${entityType} change document must include groupId`);
        }
    }

    // Remove all undefined fields recursively to prevent Firestore errors
    return removeUndefinedFields(baseDoc);
}

/**
 * Create a minimal change document optimized for trigger-based refresh
 * Contains only the essential information needed to trigger client refreshes
 *
 * Structure:
 * {
 *   id: "abc123",           // Entity ID
 *   type: "group",          // Entity type: group, expense, or settlement
 *   action: "updated",      // Action: created, updated, or deleted
 *   timestamp: Timestamp,   // When the change occurred
 *   users: ["user1", ...],  // Affected users who should refresh
 *   groupId?: "group123"    // For expense/settlement changes only
 * }
 */
export function createMinimalChangeDocument(
    entityId: string,
    entityType: 'group' | 'expense' | 'settlement',
    changeType: ChangeType,
    affectedUsers: string[],
    groupId?: string
): Record<string, any> {
    const baseDoc: Record<string, any> = {
        id: entityId,
        type: entityType,
        action: changeType,
        timestamp: admin.Timestamp.now(),
        users: affectedUsers
    };

    // Add groupId for expense and settlement changes
    if (entityType === 'expense' || entityType === 'settlement') {
        if (!groupId) {
            throw new Error(`${entityType} change document must include groupId`);
        }
        baseDoc.groupId = groupId;
    }

    return removeUndefinedFields(baseDoc);
}

/**
 * Create a minimal balance change document
 * Balances are always recalculated, never created/updated/deleted
 *
 * Structure:
 * {
 *   groupId: "abc123",      // Group whose balances changed
 *   type: "balance",        // Always "balance"
 *   action: "recalculated", // Always "recalculated"
 *   timestamp: Timestamp,   // When the change occurred
 *   users: ["user1", ...]   // Affected users who should refresh
 * }
 */
export function createMinimalBalanceChangeDocument(
    groupId: string,
    affectedUsers: string[]
): Record<string, any> {
    return removeUndefinedFields({
        groupId,
        type: 'balance',
        action: 'recalculated',
        timestamp: admin.Timestamp.now(),
        users: affectedUsers
    });
}