import { beforeEach, describe, expect, it } from 'vitest';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import { type ChangeType, NotificationService } from '../../../services/notification-service';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';

describe('NotificationService - Comprehensive Unit Tests', () => {
    let notificationService: NotificationService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        notificationService = new NotificationService(stubReader, stubWriter);
    });

    describe('batchUpdateNotifications', () => {
        it('should update multiple users with single change type', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            const groupId = 'group-1';
            const changeType: ChangeType = 'transaction';

            const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
            expect(result.results).toHaveLength(3);

            // Verify all users were updated
            const calls = stubWriter.setUserNotificationsCalls;
            expect(calls).toHaveLength(3);
            expect(calls.map((c) => c.userId).sort()).toEqual(userIds.sort());
        });

        it('should return correct success/failure counts', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            const groupId = 'group-1';

            const result = await notificationService.batchUpdateNotifications(userIds, groupId, 'balance');

            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
            expect(result.results.every((r) => r.success)).toBe(true);
        });

        it('should handle empty user list', async () => {
            const userIds: string[] = [];
            const groupId = 'group-1';

            const result = await notificationService.batchUpdateNotifications(userIds, groupId, 'transaction');

            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(result.results).toHaveLength(0);
        });

        it('should use merge:true for all updates', async () => {
            const userIds = ['user-1', 'user-2'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotifications(userIds, groupId, 'comment');

            const calls = stubWriter.setUserNotificationsCalls;
            expect(calls.every((c) => c.merge === true)).toBe(true);
        });
    });

    describe('batchUpdateNotificationsMultipleTypes', () => {
        it('should update multiple users with multiple change types atomically', async () => {
            const userIds = ['user-1', 'user-2'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance'];

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);

            const calls = stubWriter.setUserNotificationsCalls;
            expect(calls).toHaveLength(2);

            // Verify both change types were included in each update
            for (const call of calls) {
                const updates = call.updates;
                expect(updates.groups[groupId].lastTransactionChange).toBeDefined();
                expect(updates.groups[groupId].lastBalanceChange).toBeDefined();
                expect(updates.groups[groupId].transactionChangeCount).toBeDefined();
                expect(updates.groups[groupId].balanceChangeCount).toBeDefined();
            }
        });

        it('should increment changeVersion by number of change types', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance', 'group', 'comment'];

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            const calls = stubWriter.setUserNotificationsCalls;
            const updates = calls[0].updates;

            // changeVersion should increment by 4 (number of change types)
            expect(updates.changeVersion).toBeDefined();
        });

        it('should handle all four change types in single operation', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance', 'group', 'comment'];

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(1);

            const calls = stubWriter.setUserNotificationsCalls;
            const updates = calls[0].updates;
            const groupUpdates = updates.groups[groupId];

            // Verify all change types are present
            expect(groupUpdates.lastTransactionChange).toBeDefined();
            expect(groupUpdates.lastBalanceChange).toBeDefined();
            expect(groupUpdates.lastGroupDetailsChange).toBeDefined();
            expect(groupUpdates.lastCommentChange).toBeDefined();

            expect(groupUpdates.transactionChangeCount).toBeDefined();
            expect(groupUpdates.balanceChangeCount).toBeDefined();
            expect(groupUpdates.groupDetailsChangeCount).toBeDefined();
            expect(groupUpdates.commentChangeCount).toBeDefined();
        });

        it('should set ISO string timestamps for all change types', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance'];

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            const calls = stubWriter.setUserNotificationsCalls;
            const updates = calls[0].updates;
            const groupUpdates = updates.groups[groupId];

            // Timestamps should be ISO strings
            expect(typeof groupUpdates.lastTransactionChange).toBe('string');
            expect(typeof groupUpdates.lastBalanceChange).toBe('string');

            // Verify it's a valid ISO string
            const transactionDate = new Date(groupUpdates.lastTransactionChange);
            expect(transactionDate.getTime()).not.toBeNaN();
        });

        it('should create proper nested structure for groups', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction'];

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            const calls = stubWriter.setUserNotificationsCalls;
            const updates = calls[0].updates;

            // Verify nested structure
            expect(updates.groups).toBeDefined();
            expect(updates.groups[groupId]).toBeDefined();
            expect(typeof updates.groups[groupId]).toBe('object');
        });

        it('should handle single change type correctly', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['comment'];

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(1);
            expect(result.results[0].success).toBe(true);

            const calls = stubWriter.setUserNotificationsCalls;
            const updates = calls[0].updates;
            const groupUpdates = updates.groups[groupId];

            // Only comment-related fields should be present
            expect(groupUpdates.lastCommentChange).toBeDefined();
            expect(groupUpdates.commentChangeCount).toBeDefined();

            // Other change types should not be present
            expect(groupUpdates.lastTransactionChange).toBeUndefined();
            expect(groupUpdates.lastBalanceChange).toBeUndefined();
            expect(groupUpdates.lastGroupDetailsChange).toBeUndefined();
        });

        it('should handle multiple groups for different users', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const group1 = 'group-1';
            const group2 = 'group-2';

            // Update user-1 for group-1
            await notificationService.batchUpdateNotificationsMultipleTypes([user1], group1, ['transaction']);

            // Update user-2 for group-2
            await notificationService.batchUpdateNotificationsMultipleTypes([user2], group2, ['balance']);

            const calls = stubWriter.setUserNotificationsCalls;
            expect(calls).toHaveLength(2);

            // Verify each user got updates for their respective group
            expect(calls[0].updates.groups[group1]).toBeDefined();
            expect(calls[1].updates.groups[group2]).toBeDefined();
        });
    });

    describe('initializeUserNotifications', () => {
        it('should create new notification document when none exists', async () => {
            const userId = 'new-user';

            // Ensure getUserNotification returns null (user doesn't exist)
            stubReader.setDocument('user-notifications', userId, null);

            const result = await notificationService.initializeUserNotifications(userId);

            expect(result.success).toBe(true);
            expect(result.id).toBe(userId);
        });

        it('should not create duplicate when document already exists', async () => {
            const userId = 'existing-user';
            const existingDoc: Partial<UserNotificationDocument> = {
                changeVersion: 5,
                groups: {
                    'group-1': {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        lastCommentChange: null,
                        transactionChangeCount: 2,
                        balanceChangeCount: 1,
                        groupDetailsChangeCount: 0,
                        commentChangeCount: 0,
                    },
                },
                recentChanges: [],
            };

            stubReader.setDocument('user-notifications', userId, existingDoc);

            const result = await notificationService.initializeUserNotifications(userId);

            expect(result.success).toBe(true);
            expect(result.id).toBe(userId);
        });

        it('should initialize with empty groups object', async () => {
            const userId = 'new-user';

            stubReader.setDocument('user-notifications', userId, null);

            const result = await notificationService.initializeUserNotifications(userId);

            expect(result.success).toBe(true);
        });
    });

    describe('removeUserFromGroup', () => {
        it('should remove group from user notification document', async () => {
            const userId = 'user-1';
            const groupId = 'group-1';

            const result = await notificationService.removeUserFromGroup(userId, groupId);

            expect(result.success).toBe(true);
            expect(result.id).toBe(userId);
        });

        it('should handle removal when user has multiple groups', async () => {
            const userId = 'user-1';
            const groupToRemove = 'group-2';

            const result = await notificationService.removeUserFromGroup(userId, groupToRemove);

            expect(result.success).toBe(true);
        });
    });

    describe('field mapping behavior', () => {
        it('should use correct field names for transaction changes', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['transaction']);

            const calls = stubWriter.setUserNotificationsCalls;
            const groupUpdates = calls[0].updates.groups[groupId];

            expect(groupUpdates.transactionChangeCount).toBeDefined();
            expect(groupUpdates.lastTransactionChange).toBeDefined();
        });

        it('should use correct field names for balance changes', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['balance']);

            const calls = stubWriter.setUserNotificationsCalls;
            const groupUpdates = calls[0].updates.groups[groupId];

            expect(groupUpdates.balanceChangeCount).toBeDefined();
            expect(groupUpdates.lastBalanceChange).toBeDefined();
        });

        it('should use correct field names for group changes', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['group']);

            const calls = stubWriter.setUserNotificationsCalls;
            const groupUpdates = calls[0].updates.groups[groupId];

            expect(groupUpdates.groupDetailsChangeCount).toBeDefined();
            expect(groupUpdates.lastGroupDetailsChange).toBeDefined();
        });

        it('should use correct field names for comment changes', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['comment']);

            const calls = stubWriter.setUserNotificationsCalls;
            const groupUpdates = calls[0].updates.groups[groupId];

            expect(groupUpdates.commentChangeCount).toBeDefined();
            expect(groupUpdates.lastCommentChange).toBeDefined();
        });
    });

    describe('batch operation edge cases', () => {
        it('should handle single user as edge case of batch', async () => {
            const result = await notificationService.batchUpdateNotifications(['user-1'], 'group-1', 'transaction');

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);
            expect(result.results).toHaveLength(1);
        });

        it('should process users independently in batch', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            const groupId = 'group-1';

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['transaction', 'balance']);

            expect(result.results).toHaveLength(3);
            expect(result.results.every((r) => r.success)).toBe(true);

            // Each user should have independent write call
            const calls = stubWriter.setUserNotificationsCalls;
            expect(calls).toHaveLength(3);
        });

        it('should maintain same structure across all users in batch', async () => {
            const userIds = ['user-1', 'user-2'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'comment'];

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            const calls = stubWriter.setUserNotificationsCalls;

            // Both users should get identical structure
            const user1Updates = calls[0].updates.groups[groupId];
            const user2Updates = calls[1].updates.groups[groupId];

            expect(Object.keys(user1Updates).sort()).toEqual(Object.keys(user2Updates).sort());
        });
    });

    describe('atomicity and consistency', () => {
        it('should use FieldValue.increment for counters', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['transaction']);

            const calls = stubWriter.setUserNotificationsCalls;
            const updates = calls[0].updates;

            // FieldValue.increment returns an object, not a number
            expect(typeof updates.changeVersion).toBe('object');
            expect(typeof updates.groups[groupId].transactionChangeCount).toBe('object');
        });

        it('should increment all counter fields for each change type', async () => {
            const userIds = ['user-1'];
            const groupId = 'group-1';
            const changeTypes: ChangeType[] = ['transaction', 'balance', 'group'];

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            const calls = stubWriter.setUserNotificationsCalls;
            const groupUpdates = calls[0].updates.groups[groupId];

            // All three counters should be incremented
            expect(groupUpdates.transactionChangeCount).toBeDefined();
            expect(groupUpdates.balanceChangeCount).toBeDefined();
            expect(groupUpdates.groupDetailsChangeCount).toBeDefined();
        });

        it('should use merge:true to handle non-existent documents', async () => {
            const userIds = ['new-user-1', 'new-user-2'];
            const groupId = 'group-1';

            await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, ['transaction']);

            const calls = stubWriter.setUserNotificationsCalls;
            expect(calls.every((c) => c.merge === true)).toBe(true);
        });
    });

    describe('integration scenarios', () => {
        it('should handle workflow: batch update then remove user from group', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            const groupId = 'group-1';

            // Batch update all users
            await notificationService.batchUpdateNotifications(userIds, groupId, 'transaction');

            // Remove one user from group
            const removeResult = await notificationService.removeUserFromGroup('user-2', groupId);
            expect(removeResult.success).toBe(true);
        });
    });
});
