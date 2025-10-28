import type { ActivityFeedAction, ActivityFeedEventType, ActivityFeedItem, ActivityFeedItemDetails, ISOString } from '@splitifyd/shared';
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

const MAX_ITEMS_PER_USER = 10;
const CLEANUP_KEEP_COUNT = 20; // Keep last 20 items, cleanup happens async during reads

export class ActivityFeedService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

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
