import { StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { type ChangeType, NotificationService } from '../../../services/notification-service';

describe('NotificationService - Comprehensive Unit Tests', () => {
    let db: StubFirestoreDatabase;
    let reader: FirestoreReader;
    let writer: FirestoreWriter;
    let notificationService: NotificationService;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        reader = new FirestoreReader(db);
        writer = new FirestoreWriter(db);
        notificationService = new NotificationService(reader, writer);
    });

    // Helper function to read user notification documents directly from the database
    async function getUserNotification(userId: string): Promise<UserNotificationDocument | null> {
        const doc = await db.doc(`user-notifications/${userId}`).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data() as UserNotificationDocument;
    }

    describe('initializeUserNotifications', () => {
        it('should create initial notification document for new user', async () => {
            const userId = 'user-1';

            const result = await notificationService.initializeUserNotifications(userId);

            expect(result.success).toBe(true);
            expect(result.id).toBe(userId);

            const doc = await getUserNotification(userId);
            expect(doc).toBeDefined();
            expect(doc?.groups).toEqual({});
            expect(doc?.recentChanges).toEqual([]);
            expect(doc?.changeVersion).toBe(0);
            expect(doc?.lastModified).toBeDefined();
        });

        it('should not overwrite existing notification document', async () => {
            const userId = 'user-1';

            // Create initial document
            await notificationService.initializeUserNotifications(userId);

            // Update it with some data
            await notificationService.batchUpdateNotifications([userId], 'group-1', 'transaction');

            // Try to initialize again
            const result = await notificationService.initializeUserNotifications(userId);

            expect(result.success).toBe(true);

            // Verify original data is preserved
            const doc = await getUserNotification(userId);
            expect(doc?.groups?.['group-1']).toBeDefined();
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);
        });

        it('should handle multiple users independently', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';

            await notificationService.initializeUserNotifications(user1);
            await notificationService.initializeUserNotifications(user2);

            const doc1 = await getUserNotification(user1);
            const doc2 = await getUserNotification(user2);

            expect(doc1).toBeDefined();
            expect(doc2).toBeDefined();
            expect(doc1?.groups).toEqual({});
            expect(doc2?.groups).toEqual({});
        });
    });

    describe('batchUpdateNotifications - single change type', () => {
        it('should create and update notification for single user with transaction change', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            await notificationService.batchUpdateNotifications([userId], groupId, 'transaction');

            const doc = await getUserNotification(userId);
            expect(doc).toBeDefined();
            expect(doc?.changeVersion).toBe(1);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(doc?.groups?.['group-1']?.lastTransactionChange).toBeDefined();
            expect(doc?.groups?.['group-1']?.lastTransactionChange).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('should increment counters on subsequent updates', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            // First update
            await notificationService.batchUpdateNotifications([userId], groupId, 'transaction');

            let doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(1);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);

            // Second update
            await notificationService.batchUpdateNotifications([userId], groupId, 'transaction');

            doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(2);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(2);

            // Third update
            await notificationService.batchUpdateNotifications([userId], groupId, 'balance');

            doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(3);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(2); // Unchanged
            expect(doc?.groups?.['group-1']?.balanceChangeCount).toBe(1); // New counter
        });

        it('should preserve other groups when updating one group', async () => {
            const userId = 'user-1';
            const group1 = 'group-1';
            const group2 = 'group-2';

            // Update group-1
            await notificationService.batchUpdateNotifications([userId], group1, 'transaction');

            let doc = await getUserNotification(userId);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);

            // Update group-2
            await notificationService.batchUpdateNotifications([userId], group2, 'balance');

            doc = await getUserNotification(userId);

            // Verify both groups exist and are independent
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(doc?.groups?.['group-1']?.balanceChangeCount).toBeUndefined();

            expect(doc?.groups?.['group-2']?.balanceChangeCount).toBe(1);
            expect(doc?.groups?.['group-2']?.transactionChangeCount).toBeUndefined();
        });

        it('should handle all change types correctly', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            const changeTypes: ChangeType[] = ['transaction', 'balance', 'group', 'comment'];

            for (const changeType of changeTypes) {
                await notificationService.batchUpdateNotifications([userId], groupId, changeType);
            }

            const doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(4);

            const group = doc?.groups?.['group-1'];
            expect(group?.transactionChangeCount).toBe(1);
            expect(group?.lastTransactionChange).toBeDefined();

            expect(group?.balanceChangeCount).toBe(1);
            expect(group?.lastBalanceChange).toBeDefined();

            expect(group?.groupDetailsChangeCount).toBe(1);
            expect(group?.lastGroupDetailsChange).toBeDefined();

            expect(group?.commentChangeCount).toBe(1);
            expect(group?.lastCommentChange).toBeDefined();
        });

        it('should batch update multiple users atomically', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            const groupId = 'group-1';

            const result = await notificationService.batchUpdateNotifications(userIds, groupId, 'transaction');

            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);

            // Verify all users were updated
            for (const userId of userIds) {
                const doc = await getUserNotification(userId);
                expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);
                expect(doc?.changeVersion).toBe(1);
            }
        });
    });

    describe('batchUpdateNotificationsMultipleTypes', () => {
        it('should update multiple change types atomically for single user', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance'];

            await notificationService.batchUpdateNotificationsMultipleTypes([userId], groupId, changeTypes);

            const doc = await getUserNotification(userId);

            // Global version incremented by number of change types
            expect(doc?.changeVersion).toBe(2);

            const group = doc?.groups?.['group-1'];
            expect(group?.transactionChangeCount).toBe(1);
            expect(group?.lastTransactionChange).toBeDefined();
            expect(group?.balanceChangeCount).toBe(1);
            expect(group?.lastBalanceChange).toBeDefined();
        });

        it('should update all four change types simultaneously', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance', 'group', 'comment'];

            await notificationService.batchUpdateNotificationsMultipleTypes([userId], groupId, changeTypes);

            const doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(4);

            const group = doc?.groups?.['group-1'];
            expect(group?.transactionChangeCount).toBe(1);
            expect(group?.balanceChangeCount).toBe(1);
            expect(group?.groupDetailsChangeCount).toBe(1);
            expect(group?.commentChangeCount).toBe(1);
        });

        it('should handle multiple users with multiple change types', async () => {
            const userIds = ['user-1', 'user-2', 'user-3', 'user-4'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance', 'comment'];

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(4);
            expect(result.failureCount).toBe(0);

            // Verify all users received all change types
            for (const userId of userIds) {
                const doc = await getUserNotification(userId);
                expect(doc?.changeVersion).toBe(3);

                const group = doc?.groups?.['group-1'];
                expect(group?.transactionChangeCount).toBe(1);
                expect(group?.balanceChangeCount).toBe(1);
                expect(group?.commentChangeCount).toBe(1);
                expect(group?.groupDetailsChangeCount).toBeUndefined();
            }
        });

        it('should preserve existing data when updating with multiple types', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            // Initial update with transaction
            await notificationService.batchUpdateNotifications([userId], groupId, 'transaction');

            let doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(1);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);

            // Update with multiple types including transaction
            await notificationService.batchUpdateNotificationsMultipleTypes([userId], groupId, ['transaction', 'balance', 'comment']);

            doc = await getUserNotification(userId);

            // Global version: 1 + 3 = 4
            expect(doc?.changeVersion).toBe(4);

            const group = doc?.groups?.['group-1'];
            // Transaction counter: 1 + 1 = 2
            expect(group?.transactionChangeCount).toBe(2);
            expect(group?.balanceChangeCount).toBe(1);
            expect(group?.commentChangeCount).toBe(1);
        });

        it('should preserve other groups when updating with multiple types', async () => {
            const userId = 'user-1';

            // Setup: Create notifications for multiple groups
            await notificationService.batchUpdateNotifications([userId], 'group-1', 'transaction');
            await notificationService.batchUpdateNotifications([userId], 'group-2', 'balance');
            await notificationService.batchUpdateNotifications([userId], 'group-3', 'comment');

            let doc = await getUserNotification(userId);
            const initialVersion = doc?.changeVersion || 0;
            expect(initialVersion).toBe(3);

            // Update group-2 with multiple types
            await notificationService.batchUpdateNotificationsMultipleTypes([userId], 'group-2', ['transaction', 'group']);

            doc = await getUserNotification(userId);

            // Verify group-1 and group-3 are unchanged
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(doc?.groups?.['group-1']?.balanceChangeCount).toBeUndefined();

            expect(doc?.groups?.['group-3']?.commentChangeCount).toBe(1);
            expect(doc?.groups?.['group-3']?.transactionChangeCount).toBeUndefined();

            // Verify group-2 was updated correctly
            expect(doc?.groups?.['group-2']?.balanceChangeCount).toBe(1); // From initial setup
            expect(doc?.groups?.['group-2']?.transactionChangeCount).toBe(1); // New
            expect(doc?.groups?.['group-2']?.groupDetailsChangeCount).toBe(1); // New

            // Global version: 3 + 2 = 5
            expect(doc?.changeVersion).toBe(5);
        });
    });

    describe('removeUserFromGroup', () => {
        it('should remove group entry from user notification document', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            // Setup: Create notification for user in group
            await notificationService.batchUpdateNotifications([userId], groupId, 'transaction');

            let doc = await getUserNotification(userId);
            expect(doc?.groups?.['group-1']).toBeDefined();

            // Remove user from group
            await notificationService.removeUserFromGroup(userId, groupId);

            doc = await getUserNotification(userId);
            expect(doc?.groups?.['group-1']).toBeUndefined();
        });

        it('should preserve other groups when removing one group', async () => {
            const userId = 'user-1';

            // Setup: Create notifications for multiple groups
            await notificationService.batchUpdateNotifications([userId], 'group-1', 'transaction');
            await notificationService.batchUpdateNotifications([userId], 'group-2', 'balance');
            await notificationService.batchUpdateNotifications([userId], 'group-3', 'comment');

            let doc = await getUserNotification(userId);
            expect(Object.keys(doc?.groups || {})).toHaveLength(3);

            // Remove group-2
            await notificationService.removeUserFromGroup(userId, 'group-2');

            doc = await getUserNotification(userId);
            expect(doc?.groups?.['group-1']).toBeDefined();
            expect(doc?.groups?.['group-2']).toBeUndefined();
            expect(doc?.groups?.['group-3']).toBeDefined();
            expect(Object.keys(doc?.groups || {})).toHaveLength(2);
        });

        it('should handle removing non-existent group gracefully', async () => {
            const userId = 'user-1';

            // Create notification document
            await notificationService.initializeUserNotifications(userId);

            // Remove group that was never added
            await notificationService.removeUserFromGroup(userId, 'non-existent-group');

            const doc = await getUserNotification(userId);
            expect(doc?.groups).toEqual({});
        });
    });

    describe('Complex scenarios', () => {
        it('should handle rapid consecutive updates correctly', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            // Simulate rapid updates
            await Promise.all([
                notificationService.batchUpdateNotifications([userId], groupId, 'transaction'),
                notificationService.batchUpdateNotifications([userId], groupId, 'transaction'),
                notificationService.batchUpdateNotifications([userId], groupId, 'transaction'),
            ]);

            const doc = await getUserNotification(userId);
            expect(doc?.changeVersion).toBe(3);
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(3);
        });

        it('should handle user in multiple groups with different change types', async () => {
            const userId = 'user-1';

            // User participates in 5 different groups with different activities
            await notificationService.batchUpdateNotifications([userId], 'group-1', 'transaction');
            await notificationService.batchUpdateNotifications([userId], 'group-2', 'balance');
            await notificationService.batchUpdateNotifications([userId], 'group-3', 'comment');
            await notificationService.batchUpdateNotifications([userId], 'group-4', 'group');
            await notificationService.batchUpdateNotifications([userId], 'group-5', 'transaction');

            // Update some groups multiple times
            await notificationService.batchUpdateNotifications([userId], 'group-1', 'balance');
            await notificationService.batchUpdateNotifications([userId], 'group-3', 'transaction');

            const doc = await getUserNotification(userId);

            expect(doc?.changeVersion).toBe(7);
            expect(Object.keys(doc?.groups || {})).toHaveLength(5);

            // Verify each group has correct data
            expect(doc?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(doc?.groups?.['group-1']?.balanceChangeCount).toBe(1);

            expect(doc?.groups?.['group-2']?.balanceChangeCount).toBe(1);
            expect(doc?.groups?.['group-2']?.transactionChangeCount).toBeUndefined();

            expect(doc?.groups?.['group-3']?.commentChangeCount).toBe(1);
            expect(doc?.groups?.['group-3']?.transactionChangeCount).toBe(1);
        });

        it('should handle batch operation with mixed new and existing users', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';
            const groupId = 'group-1';

            // Pre-create notifications for user-1 and user-2
            await notificationService.initializeUserNotifications(user1);
            await notificationService.batchUpdateNotifications([user1], groupId, 'transaction');

            await notificationService.initializeUserNotifications(user2);

            // Batch update all three users (user-3 doesn't exist yet)
            const result = await notificationService.batchUpdateNotifications([user1, user2, user3], groupId, 'balance');

            expect(result.successCount).toBe(3);

            // Verify user-1 has both transaction and balance
            const doc1 = await getUserNotification(user1);
            expect(doc1?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(doc1?.groups?.['group-1']?.balanceChangeCount).toBe(1);

            // Verify user-2 only has balance
            const doc2 = await getUserNotification(user2);
            expect(doc2?.groups?.['group-1']?.balanceChangeCount).toBe(1);
            expect(doc2?.groups?.['group-1']?.transactionChangeCount).toBeUndefined();

            // Verify user-3 was created and has balance
            const doc3 = await getUserNotification(user3);
            expect(doc3?.groups?.['group-1']?.balanceChangeCount).toBe(1);
        });

        it('should maintain data integrity across multiple operations', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            const groupId = 'group-shared';

            // All users get transaction notification
            await notificationService.batchUpdateNotifications(userIds, groupId, 'transaction');

            // User-1 and User-2 get balance notification
            await notificationService.batchUpdateNotifications([userIds[0], userIds[1]], groupId, 'balance');

            // Only User-1 gets comment notification
            await notificationService.batchUpdateNotifications([userIds[0]], groupId, 'comment');

            // Verify each user's state
            const doc1 = await getUserNotification(userIds[0]);
            expect(doc1?.changeVersion).toBe(3);
            expect(doc1?.groups?.[groupId]?.transactionChangeCount).toBe(1);
            expect(doc1?.groups?.[groupId]?.balanceChangeCount).toBe(1);
            expect(doc1?.groups?.[groupId]?.commentChangeCount).toBe(1);

            const doc2 = await getUserNotification(userIds[1]);
            expect(doc2?.changeVersion).toBe(2);
            expect(doc2?.groups?.[groupId]?.transactionChangeCount).toBe(1);
            expect(doc2?.groups?.[groupId]?.balanceChangeCount).toBe(1);
            expect(doc2?.groups?.[groupId]?.commentChangeCount).toBeUndefined();

            const doc3 = await getUserNotification(userIds[2]);
            expect(doc3?.changeVersion).toBe(1);
            expect(doc3?.groups?.[groupId]?.transactionChangeCount).toBe(1);
            expect(doc3?.groups?.[groupId]?.balanceChangeCount).toBeUndefined();
            expect(doc3?.groups?.[groupId]?.commentChangeCount).toBeUndefined();
        });
    });
});
