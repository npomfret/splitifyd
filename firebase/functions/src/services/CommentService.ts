import { DocumentSnapshot, Query, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import {firebaseAuth, firestoreDb} from '../firebase';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createServerTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import {
    FirestoreCollections,
    CommentTargetTypes,
    CommentTargetType,
    Comment,
    CommentApiResponse,
    CreateCommentRequest,
    ListCommentsResponse,
} from '@splitifyd/shared';
import { isGroupMemberAsync } from '../utils/groupHelpers';
import { transformGroupDocument } from '../groups/handlers';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { CommentDocumentSchema, CommentDataSchema } from '../schemas/comment';

/**
 * Type for comment data before it's saved to Firestore (without id)
 */
type CommentCreateData = Omit<Comment, 'id' | 'authorAvatar'> & {
    authorAvatar: string | null; // Firestore doesn't allow undefined, so we use null
};

/**
 * Service for managing comment operations
 */
export class CommentService {
    private groupsCollection = firestoreDb.collection(FirestoreCollections.GROUPS);
    private expensesCollection = firestoreDb.collection(FirestoreCollections.EXPENSES);

    /**
     * Get reference to comments subcollection based on target type
     */
    private getCommentsCollection(targetType: CommentTargetType, targetId: string) {
        if (targetType === CommentTargetTypes.GROUP) {
            return this.groupsCollection.doc(targetId).collection(FirestoreCollections.COMMENTS);
        } else if (targetType === CommentTargetTypes.EXPENSE) {
            return this.expensesCollection.doc(targetId).collection(FirestoreCollections.COMMENTS);
        } else {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_TYPE', 'Invalid target type');
        }
    }

    /**
     * Verify user has access to comment on the target entity
     */
    private async verifyCommentAccess(targetType: CommentTargetType, targetId: string, userId: string, groupId?: string): Promise<void> {
        if (targetType === CommentTargetTypes.GROUP) {
            // For group comments, verify user is a group member
            const groupDoc = await this.groupsCollection.doc(targetId).get();
            if (!groupDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const group = transformGroupDocument(groupDoc);
            if (!(await isGroupMemberAsync(group.id, userId))) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
            }
        } else if (targetType === CommentTargetTypes.EXPENSE) {
            // For expense comments, verify expense exists and user is in the group
            if (!groupId) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required for expense comments');
            }

            const expenseDoc = await this.expensesCollection.doc(targetId).get();
            if (!expenseDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }

            const expense = expenseDoc.data();
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }

            // Verify user is a member of the group that the expense belongs to
            const groupDoc = await this.groupsCollection.doc(groupId).get();
            if (!groupDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const group = transformGroupDocument(groupDoc);
            if (!(await isGroupMemberAsync(group.id, userId))) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
            }

            // Verify the expense actually belongs to this group
            if (expense.groupId !== groupId) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'EXPENSE_GROUP_MISMATCH', 'Expense does not belong to the specified group');
            }
        }
    }

    /**
     * Transform Firestore comment document to Comment interface
     */
    private transformCommentDocument(doc: DocumentSnapshot): Comment {
        const rawData = doc.data();
        if (!rawData) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_DATA_NULL', 'Comment document data is null');
        }

        // Validate and parse comment data structure with Zod
        const dataWithId = { ...rawData, id: doc.id };
        try {
            const validatedComment = CommentDocumentSchema.parse(dataWithId);
            return {
                id: validatedComment.id,
                authorId: validatedComment.authorId,
                authorName: validatedComment.authorName,
                authorAvatar: validatedComment.authorAvatar || undefined,
                text: validatedComment.text,
                createdAt: validatedComment.createdAt,
                updatedAt: validatedComment.updatedAt,
            };
        } catch (error) {
            logger.error('Comment document validation failed', error as Error, {
                commentId: doc.id,
                validationErrors: error instanceof z.ZodError ? error.issues : undefined,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_COMMENT_DATA', 'Comment document structure is invalid');
        }
    }

    /**
     * Get a single comment with validation
     */
    async getComment(targetType: CommentTargetType, targetId: string, commentId: string, userId: string, groupId?: string): Promise<CommentApiResponse> {
        // Verify access to the target entity
        await this.verifyCommentAccess(targetType, targetId, userId, groupId);

        const commentsCollection = this.getCommentsCollection(targetType, targetId);
        const commentDoc = await commentsCollection.doc(commentId).get();

        if (!commentDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'COMMENT_NOT_FOUND', 'Comment not found');
        }

        const comment = this.transformCommentDocument(commentDoc);

        return {
            ...comment,
            createdAt: timestampToISO(comment.createdAt as Timestamp),
            updatedAt: timestampToISO(comment.updatedAt as Timestamp),
        };
    }

    /**
     * List comments for a target with pagination
     */
    async listComments(
        targetType: CommentTargetType,
        targetId: string,
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            groupId?: string;
        } = {},
    ): Promise<ListCommentsResponse> {
        return PerformanceMonitor.monitorServiceCall(
            'CommentService',
            'listComments',
            async () => this._listComments(targetType, targetId, userId, options),
            { targetType, targetId, userId, limit: options.limit }
        );
    }

    private async _listComments(
        targetType: CommentTargetType,
        targetId: string,
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            groupId?: string;
        } = {},
    ): Promise<ListCommentsResponse> {
        LoggerContext.update({ targetType, targetId, userId, operation: 'list-comments', limit: options.limit || 50 });
        
        const limit = options.limit || 50;
        const { cursor, groupId } = options;

        // For expense comments, verify we have the groupId and the expense exists
        let resolvedGroupId = groupId;
        if (targetType === CommentTargetTypes.EXPENSE) {
            const expenseDoc = await this.expensesCollection.doc(targetId).get();
            if (!expenseDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }
            const expense = expenseDoc.data();
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }
            resolvedGroupId = expense.groupId;
        }

        // Verify user has access to view comments on this target
        await this.verifyCommentAccess(targetType, targetId, userId, resolvedGroupId);

        // Build the query
        const commentsCollection = this.getCommentsCollection(targetType, targetId);
        let query: Query = commentsCollection.orderBy('createdAt', 'desc').limit(limit + 1); // Fetch one extra to check if there are more

        // Apply cursor-based pagination if provided
        if (cursor) {
            try {
                const cursorDoc = await commentsCollection.doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            } catch (error) {
                logger.info('Invalid cursor provided', { cursor, error });
                // Continue without cursor if it's invalid
            }
        }

        // Execute the query
        const snapshot = await query.get();
        const docs = snapshot.docs;

        // Determine if there are more comments
        const hasMore = docs.length > limit;
        const commentsToReturn = hasMore ? docs.slice(0, limit) : docs;

        // Transform documents to Comment API response objects
        const comments: CommentApiResponse[] = commentsToReturn.map((doc) => {
            const comment = this.transformCommentDocument(doc);
            return {
                ...comment,
                createdAt: timestampToISO(comment.createdAt as Timestamp),
                updatedAt: timestampToISO(comment.updatedAt as Timestamp),
            };
        });

        return {
            comments,
            hasMore,
            nextCursor: hasMore && commentsToReturn.length > 0 ? commentsToReturn[commentsToReturn.length - 1].id : undefined,
        };
    }

    /**
     * Create a new comment
     */
    async createComment(
        targetType: CommentTargetType,
        targetId: string,
        commentData: CreateCommentRequest,
        userId: string,
        groupId?: string,
    ): Promise<CommentApiResponse> {
        return PerformanceMonitor.monitorServiceCall(
            'CommentService',
            'createComment',
            async () => this._createComment(targetType, targetId, commentData, userId, groupId),
            { targetType, targetId, userId }
        );
    }

    private async _createComment(
        targetType: CommentTargetType,
        targetId: string,
        commentData: CreateCommentRequest,
        userId: string,
        groupId?: string,
    ): Promise<CommentApiResponse> {
        LoggerContext.update({ targetType, targetId, userId, operation: 'create-comment' });
        
        // For expense comments, resolve the groupId from the expense
        let resolvedGroupId = groupId;
        if (targetType === CommentTargetTypes.EXPENSE) {
            const expenseDoc = await this.expensesCollection.doc(targetId).get();
            if (!expenseDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }
            const expense = expenseDoc.data();
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }
            resolvedGroupId = expense.groupId;
        }

        // Verify user has access to comment on this target
        await this.verifyCommentAccess(targetType, targetId, userId, resolvedGroupId);

        // Get user display name for the comment
        const userRecord = await firebaseAuth.getUser(userId);
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';

        // Prepare comment data
        const now = createServerTimestamp();
        const commentCreateData: CommentCreateData = {
            authorId: userId,
            authorName,
            authorAvatar: userRecord.photoURL || null,
            text: commentData.text,
            createdAt: now,
            updatedAt: now,
        };

        // Validate comment data structure before writing to Firestore
        const validatedComment = CommentDataSchema.parse(commentCreateData);

        // Create the comment document
        const commentsCollection = this.getCommentsCollection(targetType, targetId);
        const commentDocRef = await commentsCollection.add(validatedComment);

        // Fetch the created comment to return it
        const createdCommentDoc = await commentDocRef.get();
        const createdComment = this.transformCommentDocument(createdCommentDoc);

        // Convert timestamps to ISO strings for the API response
        return {
            ...createdComment,
            createdAt: timestampToISO(createdComment.createdAt as Timestamp),
            updatedAt: timestampToISO(createdComment.updatedAt as Timestamp),
        };
    }
}