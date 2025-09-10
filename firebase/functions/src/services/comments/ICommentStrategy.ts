import { CommentTargetType } from '@splitifyd/shared';

/**
 * Strategy interface for handling comment operations on different target types
 * 
 * This interface encapsulates the type-specific logic for commenting on different entities
 * (groups, expenses, settlements, etc.) and eliminates the need for type-dispatching
 * conditionals in the CommentService.
 */
export interface ICommentStrategy {
    /**
     * Verify that a user has access to comment on the target entity
     * 
     * @param targetId - ID of the target entity (group ID, expense ID, etc.)
     * @param userId - ID of the user attempting to comment
     * @throws ApiError if access is denied or entity not found
     */
    verifyAccess(targetId: string, userId: string): Promise<void>;

    /**
     * Resolve the group ID associated with the target entity
     * 
     * For groups: returns the targetId directly
     * For expenses: returns the expense's groupId
     * For settlements: returns the settlement's groupId
     * 
     * @param targetId - ID of the target entity
     * @returns The group ID associated with the target
     * @throws ApiError if entity not found or deleted
     */
    resolveGroupId(targetId: string): Promise<string>;

    /**
     * Get the Firestore collection path for comments on this target type
     * 
     * @param targetId - ID of the target entity
     * @returns Firestore collection path string
     */
    getCollectionPath(targetId: string): string;
}