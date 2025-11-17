import type { ExpenseId, GroupId, UserId } from '@splitifyd/shared';
import { ActivityFeedActions, ActivityFeedEventTypes, CommentDTO, CreateExpenseCommentRequest, CreateGroupCommentRequest, ListCommentsResponse, toCommentId, toISOString } from '@splitifyd/shared';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError } from '../utils/errors';
import * as loggerContext from '../utils/logger-context';
import { ActivityFeedService } from './ActivityFeedService';
import { ExpenseCommentStrategy } from './comments/ExpenseCommentStrategy';
import { GroupCommentStrategy } from './comments/GroupCommentStrategy';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';

/**
 * Service for managing comment operations
 */
export class CommentService {
    private readonly groupCommentStrategy: GroupCommentStrategy;
    private readonly expenseCommentStrategy: ExpenseCommentStrategy;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        readonly groupMemberService: GroupMemberService,
        private readonly activityFeedService: ActivityFeedService,
    ) {
        this.groupCommentStrategy = new GroupCommentStrategy(firestoreReader, groupMemberService);
        this.expenseCommentStrategy = new ExpenseCommentStrategy(firestoreReader, groupMemberService);
    }

    async listGroupComments(groupId: GroupId, userId: UserId, options: { limit?: number; cursor?: string; } = {}): Promise<ListCommentsResponse> {
        return measure.measureDb('CommentService.listGroupComments', async () => this.listGroupCommentsInternal(groupId, userId, options));
    }

    async listExpenseComments(expenseId: ExpenseId, userId: UserId, options: { limit?: number; cursor?: string; } = {}): Promise<ListCommentsResponse> {
        return measure.measureDb('CommentService.listExpenseComments', async () => this.listExpenseCommentsInternal(expenseId, userId, options));
    }

    private async listGroupCommentsInternal(groupId: GroupId, userId: UserId, options: { limit?: number; cursor?: string; } = {}): Promise<ListCommentsResponse> {
        const timer = new PerformanceTimer();

        const limit = Math.min(options.limit ?? 8, 100);
        loggerContext.LoggerContext.update({ targetType: 'group', groupId, userId, operation: 'list-comments', limit });

        timer.startPhase('query');
        await this.groupCommentStrategy.verifyAccess(groupId, userId);

        const result = await this.firestoreReader.getGroupComments(groupId, {
            limit,
            cursor: options.cursor,
            orderBy: 'createdAt',
            direction: 'desc',
        });
        timer.endPhase();

        const comments: CommentDTO[] = result.comments.map((comment) => ({
            ...comment,
            authorAvatar: comment.authorAvatar || undefined,
        }));

        return {
            comments,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    private async listExpenseCommentsInternal(expenseId: ExpenseId, userId: UserId, options: { limit?: number; cursor?: string; } = {}): Promise<ListCommentsResponse> {
        const timer = new PerformanceTimer();

        const limit = Math.min(options.limit ?? 8, 100);
        loggerContext.LoggerContext.update({ targetType: 'expense', targetId: expenseId, userId, operation: 'list-comments', limit });

        timer.startPhase('query');
        await this.expenseCommentStrategy.verifyAccess(expenseId, userId);

        const result = await this.firestoreReader.getExpenseComments(expenseId, {
            limit,
            cursor: options.cursor,
            orderBy: 'createdAt',
            direction: 'desc',
        });
        timer.endPhase();

        const comments: CommentDTO[] = result.comments.map((comment) => ({
            ...comment,
            authorAvatar: comment.authorAvatar || undefined,
        }));

        return {
            comments,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Create a new comment on a group
     */
    async createGroupComment(groupId: GroupId, commentData: CreateGroupCommentRequest, userId: UserId): Promise<CommentDTO> {
        return measure.measureDb('CommentService.createGroupComment', async () => this.createGroupCommentInternal(groupId, commentData, userId));
    }

    /**
     * Create a new comment on an expense
     */
    async createExpenseComment(expenseId: ExpenseId, commentData: CreateExpenseCommentRequest, userId: UserId): Promise<CommentDTO> {
        return measure.measureDb('CommentService.createExpenseComment', async () => this.createExpenseCommentInternal(expenseId, commentData, userId));
    }

    private async createGroupCommentInternal(groupId: GroupId, commentData: CreateGroupCommentRequest, userId: UserId): Promise<CommentDTO> {
        const timer = new PerformanceTimer();

        loggerContext.LoggerContext.update({ targetType: 'group', groupId, userId, operation: 'create-comment' });

        timer.startPhase('query');
        await this.groupCommentStrategy.verifyAccess(groupId, userId);

        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(groupId, userId, {
            notFoundErrorFactory: () => new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found'),
            forbiddenErrorFactory: () => new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group'),
        });

        const now = toISOString(new Date().toISOString());
        const commentCreateData: Omit<CommentDTO, 'id'> = {
            authorId: userId,
            authorName: actorMember.groupDisplayName,
            text: commentData.text,
            createdAt: now,
            updatedAt: now,
        };
        const commentPreview = commentData.text.trim().slice(0, 120);
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: any = null;
        let activityRecipients: UserId[] = [];

        timer.startPhase('write');
        const commentId = await this.firestoreWriter.runTransaction(async (transaction) => {
            const commentRef = this.firestoreWriter.createGroupCommentInTransaction(transaction, groupId, commentCreateData);
            const activityCommentId = toCommentId(commentRef.id);

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId,
                groupName: group.name,
                eventType: ActivityFeedEventTypes.COMMENT_ADDED,
                action: ActivityFeedActions.COMMENT,
                actorId: userId,
                actorName: actorMember.groupDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    comment: {
                        id: activityCommentId,
                        preview: commentPreview,
                    },
                }),
            });
            activityRecipients = memberIds;

            return commentRef.id;
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        timer.startPhase('refetch');
        const createdComment = await this.firestoreReader.getGroupComment(groupId, toCommentId(commentId));
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }
        timer.endPhase();

        logger.info('comment-created', {
            targetType: 'group',
            groupId,
            commentId,
            timings: timer.getTimings(),
        });

        return {
            ...createdComment,
            authorAvatar: createdComment.authorAvatar || undefined,
        };
    }

    private async createExpenseCommentInternal(expenseId: ExpenseId, commentData: CreateExpenseCommentRequest, userId: UserId): Promise<CommentDTO> {
        const timer = new PerformanceTimer();

        loggerContext.LoggerContext.update({ targetType: 'expense', expenseId, userId, operation: 'create-comment' });

        timer.startPhase('query');
        await this.expenseCommentStrategy.verifyAccess(expenseId, userId);

        const expense = await this.firestoreReader.getExpense(expenseId);
        if (!expense || expense.deletedAt) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
        }

        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(expense.groupId, userId, {
            notFoundErrorFactory: () => new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found'),
            forbiddenErrorFactory: () => new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group'),
        });

        const authorName = actorMember.groupDisplayName;
        const activityActorDisplayName = actorMember.groupDisplayName;

        const now = toISOString(new Date().toISOString());
        const commentCreateData: Omit<CommentDTO, 'id'> = {
            authorId: userId,
            authorName,
            text: commentData.text,
            createdAt: now,
            updatedAt: now,
        };
        const commentPreview = commentData.text.trim().slice(0, 120);
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: any = null;
        let activityRecipients: UserId[] = [];

        timer.startPhase('write');
        const commentId = await this.firestoreWriter.runTransaction(async (transaction) => {
            const commentRef = this.firestoreWriter.createExpenseCommentInTransaction(transaction, expenseId, commentCreateData);
            const activityCommentId = toCommentId(commentRef.id);

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: expense.groupId,
                groupName: group.name,
                eventType: ActivityFeedEventTypes.COMMENT_ADDED,
                action: ActivityFeedActions.COMMENT,
                actorId: userId,
                actorName: activityActorDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    comment: {
                        id: activityCommentId,
                        preview: commentPreview,
                    },
                    expense: {
                        id: expenseId,
                        description: expense.description,
                    },
                }),
            });
            activityRecipients = memberIds;

            return commentRef.id;
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        timer.startPhase('refetch');
        const createdComment = await this.firestoreReader.getExpenseComment(expenseId, toCommentId(commentId));
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }
        timer.endPhase();

        logger.info('comment-created', {
            targetType: 'expense',
            expenseId,
            commentId,
            timings: timer.getTimings(),
        });

        return {
            ...createdComment,
            authorAvatar: createdComment.authorAvatar || undefined,
        };
    }
}
