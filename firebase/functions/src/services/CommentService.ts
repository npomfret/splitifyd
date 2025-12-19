import type { AttachmentId, CommentAttachmentRef, CommentId, ExpenseId, GroupId, UserId } from '@billsplit-wl/shared';
import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    CommentDTO,
    CreateExpenseCommentRequest,
    CreateGroupCommentRequest,
    ListCommentsResponse,
    toAttachmentId,
    toCommentId,
    toISOString,
} from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import * as loggerContext from '../utils/logger-context';
import { ActivityFeedService, CreateActivityItemInput } from './ActivityFeedService';
import { ExpenseCommentStrategy } from './comments/ExpenseCommentStrategy';
import { GroupCommentStrategy } from './comments/GroupCommentStrategy';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import type { GroupAttachmentStorage } from './storage/GroupAttachmentStorage';

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
        private readonly attachmentStorage: GroupAttachmentStorage,
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

        // userReactions are now denormalized on the comment document - no N+1 queries needed
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

        // userReactions are now denormalized on the comment document - no N+1 queries needed
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

    /**
     * Resolve attachment IDs to attachment refs by looking up metadata from storage.
     * Validates that all attachments exist and belong to the specified group.
     */
    private async resolveAttachmentRefs(groupId: GroupId, attachmentIds: AttachmentId[] | undefined): Promise<CommentAttachmentRef[]> {
        if (!attachmentIds || attachmentIds.length === 0) {
            return [];
        }

        const attachmentRefs: CommentAttachmentRef[] = [];
        for (const attachmentId of attachmentIds) {
            const metadata = await this.attachmentStorage.getAttachmentMetadata(groupId, attachmentId);
            if (!metadata) {
                throw Errors.validationError('attachmentIds', 'ATTACHMENT_NOT_FOUND');
            }
            attachmentRefs.push({
                attachmentId: toAttachmentId(metadata.attachmentId),
                fileName: metadata.fileName,
                contentType: metadata.contentType,
                sizeBytes: metadata.sizeBytes,
            });
        }
        return attachmentRefs;
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
            notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
            forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
        });

        // Resolve attachment refs if attachmentIds provided
        const attachments = await this.resolveAttachmentRefs(groupId, commentData.attachmentIds);

        const now = toISOString(new Date().toISOString());
        const commentCreateData: Omit<CommentDTO, 'id'> = {
            authorId: userId,
            authorName: actorMember.groupDisplayName,
            text: commentData.text,
            attachments: attachments.length > 0 ? attachments : undefined,
            createdAt: now,
            updatedAt: now,
        };
        const commentPreview = commentData.text.trim().slice(0, 120);
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
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
            throw Errors.serviceError(ErrorDetail.CREATION_FAILED);
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
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(expense.groupId, userId, {
            notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
            forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
        });

        const authorName = actorMember.groupDisplayName;
        const activityActorDisplayName = actorMember.groupDisplayName;

        // Resolve attachment refs if attachmentIds provided (attachments are stored by group)
        const attachments = await this.resolveAttachmentRefs(expense.groupId, commentData.attachmentIds);

        const now = toISOString(new Date().toISOString());
        const commentCreateData: Omit<CommentDTO, 'id'> = {
            authorId: userId,
            authorName,
            text: commentData.text,
            attachments: attachments.length > 0 ? attachments : undefined,
            createdAt: now,
            updatedAt: now,
        };
        const commentPreview = commentData.text.trim().slice(0, 120);
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
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
            throw Errors.serviceError(ErrorDetail.CREATION_FAILED);
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

    /**
     * Delete a group comment and its attachments
     */
    async deleteGroupComment(groupId: GroupId, commentId: CommentId, userId: UserId): Promise<void> {
        return measure.measureDb('CommentService.deleteGroupComment', async () => this.deleteGroupCommentInternal(groupId, commentId, userId));
    }

    /**
     * Delete an expense comment and its attachments
     */
    async deleteExpenseComment(expenseId: ExpenseId, commentId: CommentId, userId: UserId): Promise<void> {
        return measure.measureDb('CommentService.deleteExpenseComment', async () => this.deleteExpenseCommentInternal(expenseId, commentId, userId));
    }

    private async deleteGroupCommentInternal(groupId: GroupId, commentId: CommentId, userId: UserId): Promise<void> {
        loggerContext.LoggerContext.update({ targetType: 'group', groupId, commentId, userId, operation: 'delete-comment' });

        // Verify user has access to the group
        await this.groupCommentStrategy.verifyAccess(groupId, userId);

        // Get the comment to retrieve attachment refs before deletion
        const comment = await this.firestoreReader.getGroupComment(groupId, commentId);
        if (!comment) {
            throw Errors.notFound('Comment', ErrorDetail.COMMENT_NOT_FOUND);
        }

        // Verify user is the author of the comment
        if (comment.authorId !== userId) {
            throw Errors.forbidden(ErrorDetail.NOT_COMMENT_AUTHOR);
        }

        // Delete the comment from Firestore
        await this.firestoreWriter.deleteGroupComment(groupId, commentId);

        // Fire-and-forget attachment deletion
        if (comment.attachments && comment.attachments.length > 0) {
            for (const ref of comment.attachments) {
                this
                    .attachmentStorage
                    .deleteAttachment(groupId, ref.attachmentId)
                    .catch((err) => {
                        logger.warn('Failed to delete comment attachment', { groupId, commentId, attachmentId: ref.attachmentId, error: err });
                    });
            }
        }

        logger.info('group-comment-deleted', { groupId, commentId, attachmentCount: comment.attachments?.length ?? 0 });
    }

    private async deleteExpenseCommentInternal(expenseId: ExpenseId, commentId: CommentId, userId: UserId): Promise<void> {
        loggerContext.LoggerContext.update({ targetType: 'expense', expenseId, commentId, userId, operation: 'delete-comment' });

        // Verify user has access to the expense
        await this.expenseCommentStrategy.verifyAccess(expenseId, userId);

        // Get the expense to find groupId for attachment storage
        const expense = await this.firestoreReader.getExpense(expenseId);
        if (!expense || expense.deletedAt) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        // Get the comment to retrieve attachment refs before deletion
        const comment = await this.firestoreReader.getExpenseComment(expenseId, commentId);
        if (!comment) {
            throw Errors.notFound('Comment', ErrorDetail.COMMENT_NOT_FOUND);
        }

        // Verify user is the author of the comment
        if (comment.authorId !== userId) {
            throw Errors.forbidden(ErrorDetail.NOT_COMMENT_AUTHOR);
        }

        // Delete the comment from Firestore (also decrements expense's commentCount)
        await this.firestoreWriter.deleteExpenseComment(expenseId, commentId);

        // Fire-and-forget attachment deletion (attachments are stored by group)
        if (comment.attachments && comment.attachments.length > 0) {
            for (const ref of comment.attachments) {
                this
                    .attachmentStorage
                    .deleteAttachment(expense.groupId, ref.attachmentId)
                    .catch((err) => {
                        logger.warn('Failed to delete comment attachment', { expenseId, commentId, attachmentId: ref.attachmentId, error: err });
                    });
            }
        }

        logger.info('expense-comment-deleted', { expenseId, commentId, attachmentCount: comment.attachments?.length ?? 0 });
    }
}
