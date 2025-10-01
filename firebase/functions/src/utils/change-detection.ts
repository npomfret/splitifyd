import { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';
import { ChangeDocumentBuilderFactory } from './change-builders';

const builderFactory = new ChangeDocumentBuilderFactory();

export type ChangeType = 'created' | 'updated' | 'deleted';
type ChangePriority = 'high' | 'medium' | 'low';

export interface ChangeMetadata {
    priority: ChangePriority;
    affectedUsers: string[];
    changedFields?: string[];
}

/**
 * Get list of changed fields between two documents
 */
export function getChangedFields(before: DocumentSnapshot | undefined, after: DocumentSnapshot | undefined): string[] {
    if (!before?.exists) return ['*']; // New document
    if (!after?.exists) return ['*']; // Deleted document

    const beforeData = before.data() || {};
    const afterData = after.data() || {};

    return extractChangedFields(beforeData, afterData);
}

/**
 * todo: delete this
 * @deprecated
 */
export function calculatePriority(changeType: ChangeType, changedFields: string[], documentType: 'group' | 'expense' | 'settlement'): ChangePriority {
    // Deletions and creations are always high priority
    if (changeType === 'created' || changeType === 'deleted') {
        return 'high';
    }

    // Define critical fields per document type
    const criticalFields: Record<string, string[]> = {
        group: ['memberIds', 'name', 'deletedAt'],
        expense: ['amount', 'currency', 'paidBy', 'splits', 'participants', 'deletedAt'],
        settlement: ['amount', 'currency', 'payerId', 'payeeId', 'from', 'to'],
    };

    const importantFields: Record<string, string[]> = {
        group: ['description'],
        expense: ['description', 'category', 'date'],
        settlement: ['note', 'date'],
    };

    const critical = criticalFields[documentType] || [];
    const important = importantFields[documentType] || [];

    // Check for critical field changes
    if (changedFields.includes('*') || changedFields.some((field) => critical.includes(field))) {
        return 'high';
    }

    // Check for important field changes
    if (changedFields.some((field) => important.includes(field))) {
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
 * Extract changed fields from group structure
 */
export function getGroupChangedFields(before: DocumentSnapshot | undefined, after: DocumentSnapshot | undefined): string[] {
    if (!before?.exists) return ['*'];
    if (!after?.exists) return ['*'];

    const beforeData = before.data() || {};
    const afterData = after.data() || {};

    return extractChangedFields(afterData, beforeData);
}

/**
 * Determine if a change should trigger a notification based on user context
 */
export function shouldNotifyUser(userId: string, changeUserId: string | undefined, changedFields: string[], priority: ChangePriority): boolean {
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
    const hasNotifiableChange = changedFields.some((field) => !nonNotifiableFields.includes(field));

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
    additionalData: Record<string, any> = {},
): Record<string, any> {
    const builder = builderFactory.getBuilder(entityType);
    return builder.createChangeDocument(entityId, changeType, metadata, additionalData);
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
function createMinimalChangeDocument(entityId: string, entityType: 'group' | 'expense' | 'settlement', changeType: ChangeType, affectedUsers: string[], groupId?: string): Record<string, any> {
    const builder = builderFactory.getBuilder(entityType);
    const additionalData = groupId ? { groupId } : {};
    return builder.createMinimalChangeDocument(entityId, changeType, affectedUsers, additionalData);
}
