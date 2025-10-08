import type { IAuthService } from './auth';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import * as loggerContext from '../utils/logger-context';
import { logger } from '../logger';
import { CommentDTO, CommentTargetType, CreateCommentRequest, ListCommentsResponse } from '@splitifyd/shared';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { CommentStrategyFactory } from './comments/CommentStrategyFactory';

/**
 * Service for managing comment operations
 */
export class CommentService {
    private readonly strategyFactory: CommentStrategyFactory;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        readonly groupMemberService: GroupMemberService,
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
        return measure.measureDb('CommentService.listComments', async () => this._listComments(targetType, targetId, userId, options));
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
        const timer = new PerformanceTimer();

        loggerContext.LoggerContext.update({ targetType, targetId, userId, operation: 'list-comments', limit: options.limit || 50 });

        const limit = options.limit || 50;
        const { cursor } = options;

        // Verify user has access to view comments on this target
        timer.startPhase('query');
        await this.verifyCommentAccess(targetType, targetId, userId);

        // Use FirestoreReader to get comments with pagination
        const result = await this.firestoreReader.getCommentsForTarget(targetType, targetId, {
            limit,
            cursor,
            orderBy: 'createdAt',
            direction: 'desc',
        });
        timer.endPhase();

        // Reader already returns DTOs with ISO strings - just normalize avatar field
        const comments: CommentDTO[] = result.comments.map((comment) => ({
            ...comment,
            authorAvatar: comment.authorAvatar || undefined,
        }));

        logger.info('comments-listed', {
            targetType,
            targetId,
            count: comments.length,
            timings: timer.getTimings(),
        });

        return {
            comments,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Create a new comment
     */
    async createComment(targetType: CommentTargetType, targetId: string, commentData: CreateCommentRequest, userId: string): Promise<CommentDTO> {
        return measure.measureDb('CommentService.createComment', async () => this._createComment(targetType, targetId, commentData, userId));
    }

    private async _createComment(targetType: CommentTargetType, targetId: string, commentData: CreateCommentRequest, userId: string): Promise<CommentDTO> {
        const timer = new PerformanceTimer();

        loggerContext.LoggerContext.update({ targetType, targetId, userId, operation: 'create-comment' });

        // Verify user has access to comment on this target
        timer.startPhase('query');
        await this.verifyCommentAccess(targetType, targetId, userId);

        // Get user display name for the comment
        const userRecord = await this.authService.getUser(userId);
        if (!userRecord) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
        }
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';

        // Prepare comment data as DTO (with ISO strings)
        const now = new Date().toISOString();
        const commentCreateData: Omit<CommentDTO, 'id'> = {
            authorId: userId,
            authorName,
            authorAvatar: userRecord.photoURL,
            text: commentData.text,
            createdAt: now,
            updatedAt: now,
        };
        timer.endPhase();

        // Create the comment document using FirestoreWriter
        // Writer handles conversion to Firestore Timestamps and schema validation
        timer.startPhase('write');
        const writeResult = await this.firestoreWriter.addComment(targetType, targetId, commentCreateData);

        // Fetch the created comment to return it using FirestoreReader
        // Reader already returns DTO with ISO strings
        const createdComment = await this.firestoreReader.getComment(targetType, targetId, writeResult.id);
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }
        timer.endPhase();

        logger.info('comment-created', {
            targetType,
            targetId,
            commentId: writeResult.id,
            timings: timer.getTimings(),
        });

        // Normalize avatar field (null → undefined for DTO)
        return {
            ...createdComment,
            authorAvatar: createdComment.authorAvatar || undefined,
        };
    }
}
