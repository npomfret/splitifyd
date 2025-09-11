import { Timestamp } from 'firebase-admin/firestore';
import { IChangeDocumentBuilder } from './IChangeDocumentBuilder';
import { ChangeType, ChangeMetadata } from '../change-detection';

/**
 * Builder for expense change documents
 *
 * Expenses are child entities of groups and MUST include a groupId field in all
 * change documents. This builder encapsulates that requirement and ensures
 * proper validation.
 */
export class ExpenseChangeDocumentBuilder implements IChangeDocumentBuilder {
    /**
     * Create a standardized change document for an expense
     *
     * @throws Error if groupId is not provided in additionalData
     */
    createChangeDocument(entityId: string, changeType: ChangeType, metadata: ChangeMetadata, additionalData: Record<string, any> = {}): Record<string, any> {
        if (!additionalData.groupId) {
            throw new Error('expense change document must include groupId');
        }

        const baseDoc = {
            expenseId: entityId,
            changeType,
            timestamp: Timestamp.now(),
            metadata,
            ...additionalData,
        };

        return this.removeUndefinedFields(baseDoc);
    }

    /**
     * Create a minimal change document for an expense
     *
     * @throws Error if groupId is not provided in additionalData
     */
    createMinimalChangeDocument(entityId: string, changeType: ChangeType, affectedUsers: string[], additionalData: Record<string, any> = {}): Record<string, any> {
        const groupId = additionalData.groupId;
        if (!groupId) {
            throw new Error('expense change document must include groupId');
        }

        const baseDoc: Record<string, any> = {
            id: entityId,
            type: 'expense',
            action: changeType,
            timestamp: Timestamp.now(),
            users: affectedUsers,
            groupId,
            ...additionalData,
        };

        return this.removeUndefinedFields(baseDoc);
    }

    /**
     * Get the entity type this builder handles
     */
    getEntityType(): 'expense' {
        return 'expense';
    }

    /**
     * Recursively removes undefined values from an object before saving to Firestore.
     * Firestore doesn't allow undefined values, so we need to filter them out.
     */
    private removeUndefinedFields(obj: any): any {
        if (obj === null || obj === undefined) {
            return null;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.removeUndefinedFields(item));
        }

        if (typeof obj === 'object' && obj.constructor === Object) {
            const cleaned: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined) {
                    cleaned[key] = this.removeUndefinedFields(value);
                }
            }
            return cleaned;
        }

        return obj;
    }
}
