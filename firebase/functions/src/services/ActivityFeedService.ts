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

const CLEANUP_KEEP_COUNT = 20; // Keep last 20 items; UI shows 8 at a time with pagination

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
     * Record activity for users (non-transactional, fire-and-forget)
     * Call this AFTER the main transaction has committed
     * Automatically triggers cleanup after writing
     */
    async recordActivityForUsers(
        userIds: UserId[],
        item: CreateActivityItemInput,
    ): Promise<void> {
        if (userIds.length === 0) {
            return;
        }

        const details = item.details ?? {};

        try {
            // Write activity items using a batch for efficiency
            const batch = this.firestoreWriter.createBatch();

            for (const userId of userIds) {
                const activityItem = {
                    userId,
                    groupId: item.groupId,
                    groupName: item.groupName,
                    eventType: item.eventType,
                    action: item.action,
                    actorId: item.actorId,
                    actorName: item.actorName,
                    timestamp: item.timestamp,
                    details,
                };
                this.firestoreWriter.createActivityFeedItemInBatch(batch, userId, null, activityItem);
            }

            await batch.commit();

            // Immediately cleanup old items (fire-and-forget, runs async)
            this.cleanupAfterActivityWrite(userIds);
        } catch (error) {
            // Log but don't fail - activity feed is not critical
            logger.warn('activity-feed-write-failed', {
                userIds,
                error: error instanceof Error ? { name: error.name, message: error.message } : error,
            });
        }
    }

    /**
     * @deprecated Use recordActivityForUsers (non-transactional version)
     * Legacy method for recording activity within a transaction
     * Prefer calling recordActivityForUsers AFTER transaction commits
     */
    recordActivityForUsersInTransaction(
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

    /**
     * Trigger cleanup after activity write (fire-and-forget)
     * This is called automatically by recordActivityForUsers after the transaction commits
     */
    private cleanupAfterActivityWrite(userIds: UserId[]): void {
        for (const userId of userIds) {
            this.cleanupOldActivityItems(userId).catch((error) => {
                logger.warn('activity-feed-cleanup-failed', {
                    userId,
                    error: error instanceof Error ? { name: error.name, message: error.message } : error,
                });
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
     * Deletes fail silently to handle race conditions where parallel cleanups may delete the same items
     */
    private async cleanupOldActivityItems(userId: UserId): Promise<void> {
        try {
            // Loop until we're down to CLEANUP_KEEP_COUNT items
            // Fetch in batches to avoid huge queries
            const batchSize = 100;
            let items = await this.firestoreWriter.getActivityFeedItemsForUser(userId, batchSize);

            while (items.length > CLEANUP_KEEP_COUNT) {
                const itemsToDelete = items.slice(CLEANUP_KEEP_COUNT);

                // Use WriteBatch to delete up to 500 items efficiently in a single operation
                // Split into chunks of 500 (Firestore batch limit)
                const chunks: Array<{ id: string; }>[] = [];
                for (let i = 0; i < itemsToDelete.length; i += 500) {
                    chunks.push(itemsToDelete.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = this.firestoreWriter.createBatch();
                    for (const item of chunk) {
                        this.firestoreWriter.deleteActivityFeedItemInBatch(batch, userId, item.id);
                    }
                    await batch.commit();
                }

                // Fetch again to see if there are more items to delete
                items = await this.firestoreWriter.getActivityFeedItemsForUser(userId, batchSize);
            }
        } catch (error) {
            // Silently ignore errors (document may have been already deleted by parallel cleanup)
            logger.debug('activity-feed-cleanup-failed', {
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
