import { toGroupName } from '@splitifyd/shared';
import type { ActivityFeedAction, ActivityFeedEventType, ActivityFeedItem, ActivityFeedItemDetails, CommentId, ExpenseId, ISOString, SettlementId } from '@splitifyd/shared';
import type { GroupId, GroupName, UserId } from '@splitifyd/shared';
import type { ITransaction } from '../firestore-wrapper';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';

interface CreateActivityItemInput {
    groupId: GroupId;
    groupName: GroupName;
    eventType: ActivityFeedEventType;
    action: ActivityFeedAction;
    actorId: UserId;
    actorName: string;
    timestamp: ISOString;
    details?: ActivityFeedItemDetails;
}

type ActivityFeedDetailsInput = {
    expense?: {
        id: ExpenseId;
        description?: string | null | undefined;
    };
    settlement?: {
        id: SettlementId;
        description?: string | null | undefined;
    };
    comment?: {
        id: CommentId;
        preview?: string | null | undefined;
    };
    targetUser?: {
        id: UserId;
        name?: string | null | undefined;
    };
    previousGroupName?: GroupName | string | null | undefined;
};

const CLEANUP_KEEP_COUNT = 10; // Keep last x items, cleanup happens async during reads

export class ActivityFeedService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

    buildDetails(input: ActivityFeedDetailsInput): ActivityFeedItemDetails {
        const details: ActivityFeedItemDetails = {};

        if (input.expense) {
            details.expenseId = input.expense.id;
            const expenseDescription = input.expense.description?.trim();
            if (expenseDescription) {
                details.expenseDescription = expenseDescription;
            }
        }

        if (input.settlement) {
            details.settlementId = input.settlement.id;
            const settlementDescription = input.settlement.description?.trim();
            if (settlementDescription) {
                details.settlementDescription = settlementDescription;
            }
        }

        if (input.comment) {
            details.commentId = input.comment.id;
            const commentPreview = input.comment.preview?.trim();
            if (commentPreview) {
                details.commentPreview = commentPreview;
            }
        }

        if (input.targetUser) {
            details.targetUserId = input.targetUser.id;
            const targetUserName = input.targetUser.name?.trim();
            if (targetUserName) {
                details.targetUserName = targetUserName;
            }
        }

        const previousGroupNameInput = input.previousGroupName;
        if (previousGroupNameInput) {
            const trimmed = previousGroupNameInput.toString().trim();
            if (trimmed) {
                details.previousGroupName = toGroupName(trimmed);
            }
        }

        return details;
    }

    buildGroupActivityItem(input: {
        groupId: GroupId;
        groupName: GroupName;
        eventType: ActivityFeedEventType;
        action: ActivityFeedAction;
        actorId: UserId;
        actorName: string;
        timestamp: ISOString;
        details?: ActivityFeedItemDetails;
    }): CreateActivityItemInput {
        return {
            groupId: input.groupId,
            groupName: input.groupName,
            eventType: input.eventType,
            action: input.action,
            actorId: input.actorId,
            actorName: input.actorName,
            timestamp: input.timestamp,
            details: input.details,
        };
    }

    /**
     * Record activity for users in a transaction (simplified - no pruning in transaction)
     * Pruning happens asynchronously during reads to avoid transaction overhead
     */
    recordActivityForUsers(
        transaction: ITransaction,
        userIds: UserId[],
        item: CreateActivityItemInput,
    ): void {
        if (userIds.length === 0) {
            return;
        }

        const details = item.details ?? {};

        for (const userId of userIds) {
            this.firestoreWriter.createActivityFeedItemInTransaction(transaction, userId, null, {
                userId,
                groupId: item.groupId,
                groupName: item.groupName,
                eventType: item.eventType,
                action: item.action,
                actorId: item.actorId,
                actorName: item.actorName,
                timestamp: item.timestamp,
                details,
            });
        }
    }

    async getActivityFeedForUser(
        userId: UserId,
        options?: {
            limit?: number;
            cursor?: string;
        },
    ): Promise<{
        items: ActivityFeedItem[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return measureDb('ActivityFeedService.getActivityFeedForUser', async () => {
            const result = await this.firestoreReader.getActivityFeedForUser(userId, options);

            // Async cleanup (fire-and-forget) - prune old items beyond CLEANUP_KEEP_COUNT
            // This happens outside the critical path and doesn't block the response
            this.cleanupOldActivityItems(userId).catch((error) => {
                // Log but don't fail the request
                logger.warn('activity-feed-cleanup-failed', {
                    userId,
                    error: error instanceof Error ? { name: error.name, message: error.message } : error,
                });
            });

            return result;
        });
    }

    /**
     * Async cleanup of old activity feed items (fire-and-forget)
     * Keeps the last CLEANUP_KEEP_COUNT items, deletes older ones
     */
    private async cleanupOldActivityItems(userId: UserId): Promise<void> {
        const items = await this.firestoreWriter.getActivityFeedItemsForUser(userId, CLEANUP_KEEP_COUNT + 10);

        if (items.length > CLEANUP_KEEP_COUNT) {
            const itemsToDelete = items.slice(CLEANUP_KEEP_COUNT);
            const deletePromises = itemsToDelete.map((item: { id: string; }) => this.firestoreWriter.deleteActivityFeedItem(userId, item.id));
            await Promise.all(deletePromises);
        }
    }
}
