import type { IAuthService } from './auth';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createOptimisticTimestamp, assertTimestampAndConvert } from '../utils/dateHelpers';
import { LoggerContext } from '../utils/logger-context';
import { Comment, CommentApiResponse, CommentTargetType, CreateCommentRequest, ListCommentsResponse } from '@splitifyd/shared';
import { measureDb } from '../monitoring/measure';
import { CommentDataSchema } from '../schemas';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { CommentStrategyFactory } from './comments/CommentStrategyFactory';

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
    private readonly strategyFactory: CommentStrategyFactory;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
        private readonly authService: IAuthService,
    ) {
        this.strategyFactory = new CommentStrategyFactory(firestoreReader, groupMemberService);
    }

    /**
     * Verify user has access to comment on the target entity
     */
    private async verifyCommentAccess(targetType: CommentTargetType, targetId: string, userId: string): Promise<void> {
        const strategy = this.strategyFactory.getStrategy(targetType);
        await strategy.verifyAccess(targetId, userId);
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
        const { cursor } = options;

        // Verify user has access to view comments on this target
        await this.verifyCommentAccess(targetType, targetId, userId);

        // Use FirestoreReader to get comments with pagination
        const result = await this.firestoreReader.getCommentsForTarget(targetType, targetId, {
            limit,
            cursor,
            orderBy: 'createdAt',
            direction: 'desc',
        });

        // Transform ParsedComment objects to CommentApiResponse format
        const comments: CommentApiResponse[] = result.comments.map((comment) => ({
            id: comment.id,
            authorId: comment.authorId,
            authorName: comment.authorName,
            authorAvatar: comment.authorAvatar || undefined,
            text: comment.text,
            createdAt: assertTimestampAndConvert(comment.createdAt, 'createdAt'),
            updatedAt: assertTimestampAndConvert(comment.updatedAt, 'updatedAt'),
        }));

        return {
            comments,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Create a new comment
     */
    async createComment(targetType: CommentTargetType, targetId: string, commentData: CreateCommentRequest, userId: string): Promise<CommentApiResponse> {
        return measureDb('CommentService.createComment', async () => this._createComment(targetType, targetId, commentData, userId));
    }

    private async _createComment(targetType: CommentTargetType, targetId: string, commentData: CreateCommentRequest, userId: string): Promise<CommentApiResponse> {
        LoggerContext.update({ targetType, targetId, userId, operation: 'create-comment' });

        // Verify user has access to comment on this target
        await this.verifyCommentAccess(targetType, targetId, userId);

        // Get user display name for the comment
        const userRecord = await this.authService.getUser(userId);
        if (!userRecord) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
        }
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

        // Create the comment document using FirestoreWriter
        const writeResult = await this.firestoreWriter.addComment(targetType, targetId, validatedComment);

        // Fetch the created comment to return it using FirestoreReader
        const createdComment = await this.firestoreReader.getComment(targetType, targetId, writeResult.id);
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
            createdAt: assertTimestampAndConvert(createdComment.createdAt, 'createdAt'),
            updatedAt: assertTimestampAndConvert(createdComment.updatedAt, 'updatedAt'),
        };
    }
}
