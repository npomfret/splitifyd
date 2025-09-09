import {DocumentSnapshot, Timestamp} from 'firebase-admin/firestore';
import {z} from 'zod';
import {getAuth, getFirestore} from '../firebase';
import {ApiError} from '../utils/errors';
import {HTTP_STATUS} from '../constants';
import {createOptimisticTimestamp, timestampToISO} from '../utils/dateHelpers';
import {logger} from '../logger';
import {LoggerContext} from '../utils/logger-context';
import {Comment, CommentApiResponse, CommentTargetType, CommentTargetTypes, CreateCommentRequest, ListCommentsResponse,} from '@splitifyd/shared';
import {isGroupMemberAsync} from '../utils/groupHelpers';
import { measureDb } from '../monitoring/measure';
import {CommentDataSchema, CommentDocumentSchema} from '../schemas/comment';
import {FirestoreCollections} from '@splitifyd/shared';
import type {IFirestoreReader} from './firestore/IFirestoreReader';

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
    constructor(private readonly firestoreReader: IFirestoreReader) {
    }

    /**
     * Verify user has access to comment on the target entity
     */
    private async verifyCommentAccess(targetType: CommentTargetType, targetId: string, userId: string, groupId?: string): Promise<void> {
        if (targetType === CommentTargetTypes.GROUP) {
            // For group comments, verify user is a group member
            const group = await this.firestoreReader.getGroup(targetId);
            if (!group) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            if (!(await isGroupMemberAsync(group.id, userId))) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
            }
        } else if (targetType === CommentTargetTypes.EXPENSE) {
            // For expense comments, verify expense exists and user is in the group
            if (!groupId) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required for expense comments');
            }

            const expense = await this.firestoreReader.getExpense(targetId);
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }

            // Verify user is a member of the group that the expense belongs to
            const group = await this.firestoreReader.getGroup(groupId);
            if (!group) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

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
        return measureDb('CommentService.listComments', async () => this._listComments(targetType, targetId, userId, options));
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
            const expense = await this.firestoreReader.getExpense(targetId);
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }
            resolvedGroupId = expense.groupId;
        }

        // Verify user has access to view comments on this target
        await this.verifyCommentAccess(targetType, targetId, userId, resolvedGroupId);

        // Use FirestoreReader to get comments with pagination
        const result = await this.firestoreReader.getCommentsForTarget(targetType, targetId, {
            limit,
            cursor,
            orderBy: 'createdAt',
            direction: 'desc'
        });

        // Transform ParsedComment objects to CommentApiResponse format
        const comments: CommentApiResponse[] = result.comments.map((comment) => ({
            id: comment.id,
            authorId: comment.authorId,
            authorName: comment.authorName,
            authorAvatar: comment.authorAvatar || undefined,
            text: comment.text,
            createdAt: timestampToISO(comment.createdAt as Timestamp),
            updatedAt: timestampToISO(comment.updatedAt as Timestamp),
        }));

        return {
            comments,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Get Firestore collection reference for comments on a target
     */
    private getCommentsCollection(targetType: CommentTargetType, targetId: string) {
        if (targetType === CommentTargetTypes.GROUP) {
            return getFirestore().collection(FirestoreCollections.GROUPS)
                .doc(targetId)
                .collection(FirestoreCollections.COMMENTS);
        } else if (targetType === CommentTargetTypes.EXPENSE) {
            return getFirestore().collection(FirestoreCollections.EXPENSES)
                .doc(targetId)
                .collection(FirestoreCollections.COMMENTS);
        } else {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_TYPE', `Unsupported comment target type: ${targetType}`);
        }
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
        return measureDb('CommentService.createComment', async () => this._createComment(targetType, targetId, commentData, userId, groupId));
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
            const expense = await this.firestoreReader.getExpense(targetId);
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }
            resolvedGroupId = expense.groupId;
        }

        // Verify user has access to comment on this target
        await this.verifyCommentAccess(targetType, targetId, userId, resolvedGroupId);

        // Get user display name for the comment
        const userRecord = await getAuth().getUser(userId);
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';

        // Prepare comment data
        const now = createOptimisticTimestamp();
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

        // Fetch the created comment to return it using FirestoreReader
        const createdComment = await this.firestoreReader.getCommentByReference(commentDocRef);
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }

        // Convert timestamps to ISO strings for the API response
        return {
            id: createdComment.id,
            authorId: createdComment.authorId,
            authorName: createdComment.authorName,
            authorAvatar: createdComment.authorAvatar || undefined,
            text: createdComment.text,
            createdAt: timestampToISO(createdComment.createdAt as Timestamp),
            updatedAt: timestampToISO(createdComment.updatedAt as Timestamp),
        };
    }
}