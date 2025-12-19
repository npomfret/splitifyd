import type { CommentId, ExpenseId, GroupId, ReactableResourceType, SettlementId, UserId } from '@billsplit-wl/shared';
import { ActivityFeedActions, ActivityFeedEventTypes, ReactableResourceTypes, ReactionCounts, ReactionEmoji, ReactionToggleResponse, toISOString, UserReactionsMap } from '@billsplit-wl/shared';
import { FieldValue } from 'firebase-admin/firestore';
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
 * Reactions are stored directly on parent documents in two denormalized fields:
 * - reactionCounts: { emoji: count } - aggregate counts per emoji
 * - userReactions: { userId: [emoji1, emoji2] } - each user's reactions
 *
 * This denormalized structure enables O(1) reads - no subcollection queries needed.
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
        return measure.measureDb('ReactionService.toggleExpenseReaction', () => this._toggleExpenseReaction(expenseId, emoji, userId));
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

        const result = await this._toggleReaction({
            timer,
            parentCollection: 'expenses',
            parentId: expenseId,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId: expense.groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.EXPENSE,
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
        return measure.measureDb('ReactionService.toggleGroupCommentReaction', () => this._toggleGroupCommentReaction(groupId, commentId, emoji, userId));
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

        const result = await this._toggleReaction({
            timer,
            parentCollection: `groups/${groupId}/comments`,
            parentId: commentId,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.GROUP_COMMENT,
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
        return measure.measureDb('ReactionService.toggleExpenseCommentReaction', () => this._toggleExpenseCommentReaction(expenseId, commentId, emoji, userId));
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

        const result = await this._toggleReaction({
            timer,
            parentCollection: `expenses/${expenseId}/comments`,
            parentId: commentId,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId: expense.groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.EXPENSE_COMMENT,
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
        return measure.measureDb('ReactionService.toggleSettlementReaction', () => this._toggleSettlementReaction(settlementId, emoji, userId));
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

        const result = await this._toggleReaction({
            timer,
            parentCollection: 'settlements',
            parentId: settlementId,
            userId,
            emoji,
            actorName: actorMember.groupDisplayName,
            groupId: settlement.groupId,
            groupName: group.name,
            memberIds,
            resourceType: ReactableResourceTypes.SETTLEMENT,
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
     * Core toggle logic shared by all resource types.
     * Updates both reactionCounts and userReactions on the parent document.
     */
    private async _toggleReaction(params: {
        timer: PerformanceTimer;
        parentCollection: string;
        parentId: string;
        userId: UserId;
        emoji: ReactionEmoji;
        actorName: string;
        groupId: GroupId;
        groupName: string;
        memberIds: UserId[];
        resourceType: ReactableResourceType;
    }): Promise<ReactionToggleResponse> {
        const {
            timer,
            parentCollection,
            parentId,
            userId,
            emoji,
            actorName,
            groupId,
            groupName,
            memberIds,
            resourceType,
        } = params;

        let action: 'added' | 'removed' = 'added';
        let newCount = 0;

        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const parentRef = this.firestoreWriter.getDocumentReferenceInTransaction(
                transaction,
                parentCollection,
                parentId,
            );
            const parentDoc = await transaction.get(parentRef);

            if (!parentDoc.exists) {
                throw Errors.notFound('Resource');
            }

            const parentData = parentDoc.data() as {
                reactionCounts?: ReactionCounts;
                userReactions?: UserReactionsMap;
            };
            const currentCounts: ReactionCounts = parentData?.reactionCounts ?? {};
            const currentUserReactions: UserReactionsMap = parentData?.userReactions ?? {};
            const currentCount = currentCounts[emoji] ?? 0;
            const userEmojis = currentUserReactions[userId] ?? [];

            const now = toISOString(new Date().toISOString());

            // Check if user has already reacted with this emoji
            const hasReacted = userEmojis.includes(emoji);

            if (hasReacted) {
                // Remove the reaction
                action = 'removed';
                newCount = Math.max(0, currentCount - 1);

                // Update reactionCounts
                const newCounts = { ...currentCounts };
                if (newCount === 0) {
                    delete newCounts[emoji];
                } else {
                    newCounts[emoji] = newCount;
                }

                // Update userReactions - remove this emoji from user's list
                const newUserReactions = { ...currentUserReactions };
                const updatedUserEmojis = userEmojis.filter((e) => e !== emoji);
                if (updatedUserEmojis.length === 0) {
                    delete newUserReactions[userId];
                } else {
                    newUserReactions[userId] = updatedUserEmojis;
                }

                transaction.update(parentRef, {
                    reactionCounts: Object.keys(newCounts).length > 0 ? newCounts : null,
                    userReactions: Object.keys(newUserReactions).length > 0 ? newUserReactions : null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } else {
                // Add the reaction
                action = 'added';
                newCount = currentCount + 1;

                // Update reactionCounts
                const newCounts: ReactionCounts = {
                    ...currentCounts,
                    [emoji]: newCount,
                };

                // Update userReactions - add this emoji to user's list
                const newUserReactions: UserReactionsMap = {
                    ...currentUserReactions,
                    [userId]: [...userEmojis, emoji],
                };

                transaction.update(parentRef, {
                    reactionCounts: newCounts,
                    userReactions: newUserReactions,
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
}
