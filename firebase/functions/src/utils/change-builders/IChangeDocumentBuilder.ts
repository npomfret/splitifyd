import { ChangeType, ChangeMetadata } from '../change-detection';

/**
 * Strategy interface for building change documents for different entity types
 * 
 * This interface eliminates conditional type logic by encapsulating entity-specific
 * change document creation logic within dedicated builders. Each entity type
 * (group, expense, settlement) has its own builder that knows how to construct
 * the appropriate change documents with the correct fields.
 */
export interface IChangeDocumentBuilder {
    /**
     * Create a standardized change document for this entity type
     * 
     * @param entityId - The ID of the entity that changed
     * @param changeType - Type of change (created, updated, deleted)
     * @param metadata - Change metadata including priority and affected users
     * @param additionalData - Optional additional data to include
     * @returns Change document with entity-specific fields
     * @throws Error if required fields are missing for this entity type
     */
    createChangeDocument(
        entityId: string,
        changeType: ChangeType,
        metadata: ChangeMetadata,
        additionalData?: Record<string, any>
    ): Record<string, any>;

    /**
     * Create a minimal change document optimized for trigger-based refresh
     * 
     * @param entityId - The ID of the entity that changed
     * @param changeType - Type of change (created, updated, deleted)
     * @param affectedUsers - List of users who should be notified
     * @param additionalData - Optional additional data (may include groupId for expense/settlement)
     * @returns Minimal change document with entity-specific fields
     * @throws Error if required fields are missing for this entity type
     */
    createMinimalChangeDocument(
        entityId: string,
        changeType: ChangeType,
        affectedUsers: string[],
        additionalData?: Record<string, any>
    ): Record<string, any>;

    /**
     * Get the entity type this builder handles
     * @returns The entity type string
     */
    getEntityType(): 'group' | 'expense' | 'settlement';
}