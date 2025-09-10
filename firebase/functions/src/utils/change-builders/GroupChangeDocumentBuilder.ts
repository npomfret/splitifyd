import { Timestamp } from 'firebase-admin/firestore';
import { IChangeDocumentBuilder } from './IChangeDocumentBuilder';
import { ChangeType, ChangeMetadata } from '../change-detection';

/**
 * Builder for group change documents
 * 
 * Groups are top-level entities that don't require a groupId field since they ARE the group.
 * This builder encapsulates the logic for creating group-specific change documents.
 */
export class GroupChangeDocumentBuilder implements IChangeDocumentBuilder {
    /**
     * Create a standardized change document for a group
     */
    createChangeDocument(
        entityId: string,
        changeType: ChangeType,
        metadata: ChangeMetadata,
        additionalData: Record<string, any> = {}
    ): Record<string, any> {
        const baseDoc = {
            groupId: entityId,
            changeType,
            timestamp: Timestamp.now(),
            metadata,
            ...additionalData,
        };

        return this.removeUndefinedFields(baseDoc);
    }

    /**
     * Create a minimal change document for a group
     */
    createMinimalChangeDocument(
        entityId: string,
        changeType: ChangeType,
        affectedUsers: string[],
        additionalData: Record<string, any> = {}
    ): Record<string, any> {
        const baseDoc: Record<string, any> = {
            id: entityId,
            type: 'group',
            action: changeType,
            timestamp: Timestamp.now(),
            users: affectedUsers,
            ...additionalData,
        };

        return this.removeUndefinedFields(baseDoc);
    }

    /**
     * Get the entity type this builder handles
     */
    getEntityType(): 'group' {
        return 'group';
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