import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    CommentDTO,
    CommentTargetType,
    CommentTargetTypes,
    CreateExpenseCommentRequest,
    CreateGroupCommentRequest,
    ListCommentsResponse,
} from '@splitifyd/shared';
import type { ExpenseId, GroupId, UserId } from '@splitifyd/shared';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError } from '../utils/errors';
import * as loggerContext from '../utils/logger-context';
import { ActivityFeedService } from './ActivityFeedService';
import type { IAuthService } from './auth';
import { ExpenseCommentStrategy } from './comments/ExpenseCommentStrategy';
import { GroupCommentStrategy } from './comments/GroupCommentStrategy';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
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
        private readonly authService: IAuthService,
        private readonly activityFeedService: ActivityFeedService,
    ) {
        this.groupCommentStrategy = new GroupCommentStrategy(firestoreReader, groupMemberService);
        this.expenseCommentStrategy = new ExpenseCommentStrategy(firestoreReader, groupMemberService);
    }

    /**
     * Verify user has access to comment on the target entity
     */
    private async verifyCommentAccess(targetType: CommentTargetType, targetId: GroupId | ExpenseId, userId: UserId): Promise<void> {
        switch (targetType) {
            case CommentTargetTypes.GROUP:
                await this.groupCommentStrategy.verifyAccess(targetId as GroupId, userId);
                return;
            case CommentTargetTypes.EXPENSE:
                await this.expenseCommentStrategy.verifyAccess(targetId as ExpenseId, userId);
                return;
            default:
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'UNSUPPORTED_COMMENT_TARGET', `Unsupported comment target type: ${targetType}`);
        }
    }

    /**
     * List comments for a target with pagination
     */
    async listComments(
        targetType: CommentTargetType,
        targetId: GroupId | ExpenseId,
        userId: UserId,
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
        targetId: GroupId | ExpenseId,
        userId: UserId,
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

        loggerContext.LoggerContext.update({ targetType: CommentTargetTypes.GROUP, groupId, userId, operation: 'create-comment' });

        timer.startPhase('query');
        await this.verifyCommentAccess(CommentTargetTypes.GROUP, groupId, userId);

        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const [memberIds, member] = await Promise.all([
            this.firestoreReader.getAllGroupMemberIds(groupId),
            this.firestoreReader.getGroupMember(groupId, userId),
        ]);

        if (!member) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
        }

        let actorDisplayName = member.groupDisplayName;

        const userRecord = await this.authService.getUser(userId);
        if (!userRecord) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
        }
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';
        actorDisplayName = actorDisplayName || authorName || 'Unknown member';

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

        timer.startPhase('write');
        const commentId = await this.firestoreWriter.runTransaction(async (transaction) => {
            const commentRef = this.firestoreWriter.createCommentInTransaction(transaction, CommentTargetTypes.GROUP, groupId, commentCreateData);

            const details: Record<string, any> = {
                commentId: commentRef.id,
                commentPreview,
            };

            this.activityFeedService.recordActivityForUsers(
                transaction,
                memberIds,
                {
                    groupId,
                    groupName: group.name,
                    eventType: ActivityFeedEventTypes.COMMENT_ADDED,
                    action: ActivityFeedActions.COMMENT,
                    actorId: userId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details,
                },
            );

            return commentRef.id;
        });

        const createdComment = await this.firestoreReader.getComment(CommentTargetTypes.GROUP, groupId, commentId);
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }
        timer.endPhase();

        logger.info('comment-created', {
            targetType: CommentTargetTypes.GROUP,
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

        loggerContext.LoggerContext.update({ targetType: CommentTargetTypes.EXPENSE, expenseId, userId, operation: 'create-comment' });

        timer.startPhase('query');
        await this.verifyCommentAccess(CommentTargetTypes.EXPENSE, expenseId, userId);

        const expense = await this.firestoreReader.getExpense(expenseId);
        if (!expense || expense.deletedAt) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
        }

        const group = await this.firestoreReader.getGroup(expense.groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const [memberIds, member] = await Promise.all([
            this.firestoreReader.getAllGroupMemberIds(expense.groupId),
            this.firestoreReader.getGroupMember(expense.groupId, userId),
        ]);

        if (!member) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
        }

        let actorDisplayName = member.groupDisplayName;

        const userRecord = await this.authService.getUser(userId);
        if (!userRecord) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
        }
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';
        actorDisplayName = actorDisplayName || authorName || 'Unknown member';

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

        timer.startPhase('write');
        const commentId = await this.firestoreWriter.runTransaction(async (transaction) => {
            const commentRef = this.firestoreWriter.createCommentInTransaction(transaction, CommentTargetTypes.EXPENSE, expenseId, commentCreateData);

            const details: Record<string, any> = {
                commentId: commentRef.id,
                commentPreview,
                expenseId,
            };

            if (expense.description) {
                details.expenseDescription = expense.description;
            }

            this.activityFeedService.recordActivityForUsers(
                transaction,
                memberIds,
                {
                    groupId: expense.groupId,
                    groupName: group.name,
                    eventType: ActivityFeedEventTypes.COMMENT_ADDED,
                    action: ActivityFeedActions.COMMENT,
                    actorId: userId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details,
                },
            );

            return commentRef.id;
        });

        const createdComment = await this.firestoreReader.getComment(CommentTargetTypes.EXPENSE, expenseId, commentId);
        if (!createdComment) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'COMMENT_CREATION_FAILED', 'Failed to retrieve created comment');
        }
        timer.endPhase();

        logger.info('comment-created', {
            targetType: CommentTargetTypes.EXPENSE,
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
