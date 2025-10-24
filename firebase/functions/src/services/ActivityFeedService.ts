import type { ActivityFeedEventType, ActivityFeedItem, ActivityFeedItemDetails } from '@splitifyd/shared';
import type { GroupId, GroupName, UserId } from '@splitifyd/shared';
import type { ITransaction } from '../firestore-wrapper';
import { measureDb } from '../monitoring/measure';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';

interface CreateActivityItemInput {
    groupId: GroupId;
    groupName: GroupName;
    eventType: ActivityFeedEventType;
    actorId: UserId;
    actorName: string;
    timestamp: string;
    details?: ActivityFeedItemDetails;
}

const MAX_ITEMS_PER_USER = 10;
const PRUNE_FETCH_LIMIT = MAX_ITEMS_PER_USER + 10;

export class ActivityFeedService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

    /**
     * Fetch existing activity feed items for users (must be called BEFORE any writes in transaction)
     */
    async fetchExistingItemsForUsers(
        transaction: ITransaction,
        userIds: string[],
    ): Promise<Map<string, Array<{ id: string; }>>> {
        const existingItemsMap = new Map<string, Array<{ id: string; }>>();

        for (const userId of userIds) {
            const existingSnapshots = await this.firestoreWriter.getActivityFeedItemsForUserInTransaction(
                transaction,
                userId,
                PRUNE_FETCH_LIMIT,
            );
            existingItemsMap.set(
                userId,
                existingSnapshots.map((snap) => ({ id: snap.id })),
            );
        }

        return existingItemsMap;
    }

    /**
     * Record activity for users using pre-fetched existing items (call AFTER reads, during writes phase)
     */
    recordActivityForUsersWithExistingItems(
        transaction: ITransaction,
        userIds: string[],
        item: CreateActivityItemInput,
        existingItemsMap: Map<string, Array<{ id: string; }>>,
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
                actorId: item.actorId,
                actorName: item.actorName,
                timestamp: item.timestamp,
                details,
            });

            const existingItems = existingItemsMap.get(userId) ?? [];
            if (existingItems.length >= MAX_ITEMS_PER_USER) {
                const itemsToDelete = existingItems.slice(MAX_ITEMS_PER_USER - 1);
                for (const item of itemsToDelete) {
                    this.firestoreWriter.deleteActivityFeedItemInTransaction(transaction, userId, item.id);
                }
            }
        }
    }

    async getActivityFeedForUser(
        userId: string,
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
            return this.firestoreReader.getActivityFeedForUser(userId, options);
        });
    }
}
