import * as admin from 'firebase-admin/firestore';

export type ChangeType = 'created' | 'updated' | 'deleted';
export type ChangePriority = 'high' | 'medium' | 'low';

export interface ChangeMetadata {
    priority: ChangePriority;
    affectedUsers: string[];
    changedFields?: string[];
}

/**
 * Debouncing manager for change events
 */
export class ChangeDebouncer {
    private static pendingChanges = new Map<string, NodeJS.Timeout>();
    private static readonly DEFAULT_DELAY = 500; // 500ms default debounce

    static debounce(
        key: string,
        callback: () => Promise<void>,
        delay: number = ChangeDebouncer.DEFAULT_DELAY
    ): void {
        // Clear existing timeout for this key
        const existing = this.pendingChanges.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        // Set new timeout
        const timeoutId = setTimeout(async () => {
            this.pendingChanges.delete(key);
            try {
                await callback();
            } catch (error) {
                console.error(`Error in debounced callback for ${key}:`, error);
            }
        }, delay);

        this.pendingChanges.set(key, timeoutId);
    }

    static clearPending(key: string): void {
        const timeout = this.pendingChanges.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.pendingChanges.delete(key);
        }
    }

    static clearAll(): void {
        this.pendingChanges.forEach(timeout => clearTimeout(timeout));
        this.pendingChanges.clear();
    }
}

/**
 * Get list of changed fields between two documents
 */
export function getChangedFields(
    before: admin.DocumentSnapshot | undefined,
    after: admin.DocumentSnapshot | undefined
): string[] {
    if (!before?.exists) return ['*']; // New document
    if (!after?.exists) return ['*']; // Deleted document

    const beforeData = before.data() || {};
    const afterData = after.data() || {};
    const changedFields: string[] = [];

    // Check all fields in afterData
    Object.keys(afterData).forEach((key) => {
        if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
            changedFields.push(key);
        }
    });

    // Check for deleted fields
    Object.keys(beforeData).forEach((key) => {
        if (!(key in afterData)) {
            changedFields.push(key);
        }
    });

    return changedFields;
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

/**
 * Extract changed fields from nested group structure
 */
export function getGroupChangedFields(
    before: admin.DocumentSnapshot | undefined,
    after: admin.DocumentSnapshot | undefined
): string[] {
    if (!before?.exists) return ['*'];
    if (!after?.exists) return ['*'];

    const beforeData = before.data()?.data || {};
    const afterData = after.data()?.data || {};
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

    return baseDoc;
}