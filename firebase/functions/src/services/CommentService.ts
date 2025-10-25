import { ActivityFeedActions, ActivityFeedEventTypes, CommentDTO, CommentTargetType, CommentTargetTypes, CreateCommentRequest, ListCommentsResponse } from '@splitifyd/shared';
import type { GroupName } from '@splitifyd/shared';
import type { GroupId } from '@splitifyd/shared';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError } from '../utils/errors';
import * as loggerContext from '../utils/logger-context';
import { ActivityFeedService } from './ActivityFeedService';
import type { IAuthService } from './auth';
import { CommentStrategyFactory } from './comments/CommentStrategyFactory';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';

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
        private readonly activityFeedService: ActivityFeedService,
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

        const defaultLimit = Math.min(options.limit ?? 8, 100);
        loggerContext.LoggerContext.update({ targetType, targetId, userId, operation: 'list-comments', limit: defaultLimit });

        const limit = defaultLimit;
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

        let groupId: GroupId;
        let groupName: GroupName;
        let expenseDescription: string | undefined;

        if (targetType === CommentTargetTypes.GROUP) {
            const group = await this.firestoreReader.getGroup(targetId);
            if (!group) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }
            groupId = group.id;
            groupName = group.name;
        } else if (targetType === CommentTargetTypes.EXPENSE) {
            const expense = await this.firestoreReader.getExpense(targetId);
            if (!expense || expense.deletedAt) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
            }

            const group = await this.firestoreReader.getGroup(expense.groupId);
            if (!group) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            groupId = expense.groupId;
            groupName = group.name;
            expenseDescription = expense.description;
        } else {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'UNSUPPORTED_TARGET', 'Unsupported comment target type');
        }

        const [memberIds, member] = await Promise.all([
            this.firestoreReader.getAllGroupMemberIds(groupId),
            this.firestoreReader.getGroupMember(groupId, userId),
        ]);

        if (!member) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
        }

        let actorDisplayName = member.groupDisplayName;

        // Get user display name for the comment
        const userRecord = await this.authService.getUser(userId);
        if (!userRecord) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
        }
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';
        actorDisplayName = actorDisplayName || authorName || 'Unknown member';

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
        const commentPreview = commentData.text.trim().slice(0, 120);
        timer.endPhase();

        // Create the comment document using FirestoreWriter
        // Writer handles conversion to Firestore Timestamps and schema validation
        timer.startPhase('write');
        const commentId = await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            // Fetch existing activity feed items for all members (required for pruning logic)
            const existingActivityItems = await this.activityFeedService.fetchExistingItemsForUsers(transaction, memberIds);

            // ===== WRITE PHASE: All writes happen after reads =====

            const commentRef = this.firestoreWriter.createCommentInTransaction(transaction, targetType, targetId, commentCreateData);

            const details: Record<string, any> = {
                commentId: commentRef.id,
                commentPreview,
            };

            if (targetType === CommentTargetTypes.EXPENSE) {
                details.expenseId = targetId;
                if (expenseDescription) {
                    details.expenseDescription = expenseDescription;
                }
            }

            // Record activity feed items using pre-fetched data
            this.activityFeedService.recordActivityForUsersWithExistingItems(
                transaction,
                memberIds,
                {
                    groupId,
                    groupName,
                    eventType: ActivityFeedEventTypes.COMMENT_ADDED,
                    action: ActivityFeedActions.COMMENT,
                    actorId: userId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details,
                },
                existingActivityItems,
            );

            return commentRef.id;
        });

        // Fetch the created comment to return it using FirestoreReader
        // Reader already returns DTO with ISO strings
        const createdComment = await this.firestoreReader.getComment(targetType, targetId, commentId);
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }
        timer.endPhase();

        logger.info('comment-created', {
            targetType,
            targetId,
            commentId,
            timings: timer.getTimings(),
        });

        // Normalize avatar field (null → undefined for DTO)
        return {
            ...createdComment,
            authorAvatar: createdComment.authorAvatar || undefined,
        };
    }
}
