import type { CommentId, ExpenseId, GroupId, ReactableResourceType, SettlementId, UserId } from '@billsplit-wl/shared';
import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    ReactableResourceTypes,
    ReactionCounts,
    ReactionEmoji,
    ReactionToggleResponse,
    toISOString,
} from '@billsplit-wl/shared';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { LoggerContext } from '../utils/logger-context';
import { ActivityFeedService, CreateActivityItemInput } from './ActivityFeedService';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';

/**
 * Service for managing emoji reactions on expenses, comments, and settlements.
 *
 * Reactions are stored in subcollections under each resource:
 * - expenses/{expenseId}/reactions/{userId}_{emoji}
 * - groups/{groupId}/comments/{commentId}/reactions/{userId}_{emoji}
 * - expenses/{expenseId}/comments/{commentId}/reactions/{userId}_{emoji}
 * - settlements/{settlementId}/reactions/{userId}_{emoji}
 *
 * Aggregate counts are stored on parent documents in `reactionCounts` field.
 */
export class ReactionService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
        private readonly activityFeedService: ActivityFeedService,
    ) {}

    /**
     * Toggle a reaction on an expense
     */
    async toggleExpenseReaction(
        expenseId: ExpenseId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        return measure.measureDb('ReactionService.toggleExpenseReaction', () =>
            this._toggleExpenseReaction(expenseId, emoji, userId),
        );
    }

    private async _toggleExpenseReaction(
        expenseId: ExpenseId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        const timer = new PerformanceTimer();
        LoggerContext.update({ operation: 'toggle-expense-reaction', expenseId, emoji });

        timer.startPhase('query');
        const expense = await this.firestoreReader.getExpense(expenseId);
        if (!expense || expense.deletedAt) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        const { group, memberIds, actorMember } = await this.groupMemberService.getGroupAccessContext(
            expense.groupId,
            userId,
            {
                notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
                forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
            },
        );
        timer.endPhase();

        const reactionPath = this.buildExpenseReactionPath(expenseId, userId, emoji);
        const parentPath = `${FirestoreCollections.EXPENSES}/${expenseId}`;

        const result = await this._toggleReaction({
            timer,
            reactionPath,
            parentPath,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId: expense.groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.EXPENSE,
            resourceDescription: expense.description,
        });

        logger.info('expense-reaction-toggled', {
            expenseId,
            emoji,
            action: result.action,
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Toggle a reaction on a group comment
     */
    async toggleGroupCommentReaction(
        groupId: GroupId,
        commentId: CommentId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        return measure.measureDb('ReactionService.toggleGroupCommentReaction', () =>
            this._toggleGroupCommentReaction(groupId, commentId, emoji, userId),
        );
    }

    private async _toggleGroupCommentReaction(
        groupId: GroupId,
        commentId: CommentId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        const timer = new PerformanceTimer();
        LoggerContext.update({ operation: 'toggle-group-comment-reaction', groupId, commentId, emoji });

        timer.startPhase('query');
        const { group, memberIds, actorMember } = await this.groupMemberService.getGroupAccessContext(
            groupId,
            userId,
            {
                notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
                forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
            },
        );

        const comment = await this.firestoreReader.getGroupComment(groupId, commentId);
        if (!comment) {
            throw Errors.notFound('Comment', ErrorDetail.COMMENT_NOT_FOUND);
        }
        timer.endPhase();

        const reactionPath = this.buildGroupCommentReactionPath(groupId, commentId, userId, emoji);
        const parentPath = `${FirestoreCollections.GROUPS}/${groupId}/${FirestoreCollections.COMMENTS}/${commentId}`;

        const result = await this._toggleReaction({
            timer,
            reactionPath,
            parentPath,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.GROUP_COMMENT,
            resourceDescription: comment.text.slice(0, 50),
        });

        logger.info('group-comment-reaction-toggled', {
            groupId,
            commentId,
            emoji,
            action: result.action,
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Toggle a reaction on an expense comment
     */
    async toggleExpenseCommentReaction(
        expenseId: ExpenseId,
        commentId: CommentId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        return measure.measureDb('ReactionService.toggleExpenseCommentReaction', () =>
            this._toggleExpenseCommentReaction(expenseId, commentId, emoji, userId),
        );
    }

    private async _toggleExpenseCommentReaction(
        expenseId: ExpenseId,
        commentId: CommentId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        const timer = new PerformanceTimer();
        LoggerContext.update({ operation: 'toggle-expense-comment-reaction', expenseId, commentId, emoji });

        timer.startPhase('query');
        const expense = await this.firestoreReader.getExpense(expenseId);
        if (!expense || expense.deletedAt) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        const { group, memberIds, actorMember } = await this.groupMemberService.getGroupAccessContext(
            expense.groupId,
            userId,
            {
                notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
                forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
            },
        );

        const comment = await this.firestoreReader.getExpenseComment(expenseId, commentId);
        if (!comment) {
            throw Errors.notFound('Comment', ErrorDetail.COMMENT_NOT_FOUND);
        }
        timer.endPhase();

        const reactionPath = this.buildExpenseCommentReactionPath(expenseId, commentId, userId, emoji);
        const parentPath = `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.COMMENTS}/${commentId}`;

        const result = await this._toggleReaction({
            timer,
            reactionPath,
            parentPath,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId: expense.groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.EXPENSE_COMMENT,
            resourceDescription: comment.text.slice(0, 50),
        });

        logger.info('expense-comment-reaction-toggled', {
            expenseId,
            commentId,
            emoji,
            action: result.action,
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Toggle a reaction on a settlement
     */
    async toggleSettlementReaction(
        settlementId: SettlementId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        return measure.measureDb('ReactionService.toggleSettlementReaction', () =>
            this._toggleSettlementReaction(settlementId, emoji, userId),
        );
    }

    private async _toggleSettlementReaction(
        settlementId: SettlementId,
        emoji: ReactionEmoji,
        userId: UserId,
    ): Promise<ReactionToggleResponse> {
        const timer = new PerformanceTimer();
        LoggerContext.update({ operation: 'toggle-settlement-reaction', settlementId, emoji });

        timer.startPhase('query');
        const settlement = await this.firestoreReader.getSettlement(settlementId);
        if (!settlement || settlement.deletedAt) {
            throw Errors.notFound('Settlement', ErrorDetail.SETTLEMENT_NOT_FOUND);
        }

        const { group, memberIds, actorMember } = await this.groupMemberService.getGroupAccessContext(
            settlement.groupId,
            userId,
            {
                notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
                forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
            },
        );
        timer.endPhase();

        const reactionPath = this.buildSettlementReactionPath(settlementId, userId, emoji);
        const parentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;

        const result = await this._toggleReaction({
            timer,
            reactionPath,
            parentPath,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId: settlement.groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.SETTLEMENT,
            resourceDescription: settlement.note,
        });

        logger.info('settlement-reaction-toggled', {
            settlementId,
            emoji,
            action: result.action,
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Core toggle logic shared by all resource types
     */
    private async _toggleReaction(params: {
        timer: PerformanceTimer;
        reactionPath: string;
        parentPath: string;
        userId: UserId;
        emoji: ReactionEmoji;
        actorName: string;
        groupId: GroupId;
        groupName: string;
        memberIds: UserId[];
        resourceType: ReactableResourceType;
        resourceDescription: string | null | undefined;
    }): Promise<ReactionToggleResponse> {
        const {
            timer,
            reactionPath,
            parentPath,
            userId,
            emoji,
            actorName,
            groupId,
            groupName,
            memberIds,
            resourceType,
            resourceDescription,
        } = params;

        let action: 'added' | 'removed' = 'added';
        let newCount = 0;

        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const reactionRef = this.firestoreWriter.getDocumentReferenceInTransaction(
                transaction,
                reactionPath.split('/').slice(0, -1).join('/'),
                reactionPath.split('/').pop()!,
            );

            const reactionDoc = await transaction.get(reactionRef);
            const parentRef = this.firestoreWriter.getDocumentReferenceInTransaction(
                transaction,
                parentPath.split('/').slice(0, -1).join('/'),
                parentPath.split('/').pop()!,
            );
            const parentDoc = await transaction.get(parentRef);

            if (!parentDoc.exists) {
                throw Errors.notFound('Resource');
            }

            const parentData = parentDoc.data() as { reactionCounts?: ReactionCounts; };
            const currentCounts: ReactionCounts = parentData?.reactionCounts ?? {};
            const currentCount = currentCounts[emoji] ?? 0;

            const now = toISOString(new Date().toISOString());

            if (reactionDoc.exists) {
                action = 'removed';
                newCount = Math.max(0, currentCount - 1);

                transaction.delete(reactionRef);

                const newCounts = { ...currentCounts };
                if (newCount === 0) {
                    delete newCounts[emoji];
                } else {
                    newCounts[emoji] = newCount;
                }

                transaction.update(parentRef, {
                    reactionCounts: Object.keys(newCounts).length > 0 ? newCounts : null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } else {
                action = 'added';
                newCount = currentCount + 1;

                const reactionData = {
                    userId,
                    emoji,
                    createdAt: Timestamp.now(),
                };
                transaction.set(reactionRef, reactionData);

                const newCounts: ReactionCounts = {
                    ...currentCounts,
                    [emoji]: newCount,
                };

                transaction.update(parentRef, {
                    reactionCounts: newCounts,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }

            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId,
                groupName: groupName as any,
                eventType: action === 'added'
                    ? ActivityFeedEventTypes.REACTION_ADDED
                    : ActivityFeedEventTypes.REACTION_REMOVED,
                action: action === 'added' ? ActivityFeedActions.ADD : ActivityFeedActions.REMOVE,
                actorId: userId,
                actorName,
                timestamp: now,
                details: {
                    reactionEmoji: emoji,
                    reactableResourceType: resourceType,
                },
            });
            activityRecipients = memberIds;
        });
        timer.endPhase();

        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
            });
        }

        return {
            action,
            emoji,
            newCount,
        };
    }

    private buildReactionId(userId: UserId, emoji: ReactionEmoji): string {
        return `${userId}_${emoji}`;
    }

    private buildExpenseReactionPath(expenseId: ExpenseId, userId: UserId, emoji: ReactionEmoji): string {
        const reactionId = this.buildReactionId(userId, emoji);
        return `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.REACTIONS}/${reactionId}`;
    }

    private buildGroupCommentReactionPath(
        groupId: GroupId,
        commentId: CommentId,
        userId: UserId,
        emoji: ReactionEmoji,
    ): string {
        const reactionId = this.buildReactionId(userId, emoji);
        return `${FirestoreCollections.GROUPS}/${groupId}/${FirestoreCollections.COMMENTS}/${commentId}/${FirestoreCollections.REACTIONS}/${reactionId}`;
    }

    private buildExpenseCommentReactionPath(
        expenseId: ExpenseId,
        commentId: CommentId,
        userId: UserId,
        emoji: ReactionEmoji,
    ): string {
        const reactionId = this.buildReactionId(userId, emoji);
        return `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.COMMENTS}/${commentId}/${FirestoreCollections.REACTIONS}/${reactionId}`;
    }

    private buildSettlementReactionPath(settlementId: SettlementId, userId: UserId, emoji: ReactionEmoji): string {
        const reactionId = this.buildReactionId(userId, emoji);
        return `${FirestoreCollections.SETTLEMENTS}/${settlementId}/${FirestoreCollections.REACTIONS}/${reactionId}`;
    }
}
