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
    verifyAccess(targetId: string, userId: UserId): Promise<void>;
}
import type { UserId } from '@splitifyd/shared';
