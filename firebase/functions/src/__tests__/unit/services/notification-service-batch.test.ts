/**
 * Unit Tests for NotificationService.batchUpdateNotifications
 *
 * These tests verify that the batch update method correctly:
 * 1. Calls updateUserNotification for each user in the list
 * 2. Handles both successful and failed updates
 * 3. Returns correct success/failure counts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../../../services/notification-service';

describe('NotificationService.batchUpdateNotifications', () => {
    let notificationService: NotificationService;
    let mockFirestoreReader: any;
    let mockFirestoreWriter: any;
    let mockUpdateUserNotification: any;

    beforeEach(() => {
        mockFirestoreReader = {};
        mockFirestoreWriter = {};

        // Create NotificationService instance
        notificationService = new NotificationService(mockFirestoreReader, mockFirestoreWriter);

        // Mock the updateUserNotification method
        mockUpdateUserNotification = vi.spyOn(notificationService, 'updateUserNotification');
    });

    test('should call updateUserNotification for each user in shared expense', async () => {
        // Arrange
        const userIds = ['user1', 'user2'];
        const groupId = 'test-group-123';
        const changeType = 'transaction';

        // Mock successful updates
        mockUpdateUserNotification.mockResolvedValue({ id: 'test', success: true });

        // Act
        const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

        // Assert: Should call updateUserNotification for each user
        expect(mockUpdateUserNotification).toHaveBeenCalledTimes(2);
        expect(mockUpdateUserNotification).toHaveBeenCalledWith('user1', groupId, changeType);
        expect(mockUpdateUserNotification).toHaveBeenCalledWith('user2', groupId, changeType);

        // Should return success for all users
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);
    });

    test('should handle failure for specific users', async () => {
        // Arrange
        const userIds = ['user1', 'user2', 'user3'];
        const groupId = 'test-group-456';
        const changeType = 'balance';

        // Mock: user1 succeeds, user2 fails, user3 succeeds
        mockUpdateUserNotification
            .mockResolvedValueOnce({ id: 'user1', success: true })
            .mockRejectedValueOnce(new Error('User2 notification failed'))
            .mockResolvedValueOnce({ id: 'user3', success: true });

        // Act
        const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

        // Assert: Should attempt all users despite one failure
        expect(mockUpdateUserNotification).toHaveBeenCalledTimes(3);

        // Since the current implementation doesn't handle failures properly,
        // this test will reveal if that's where the bug is
        console.log('🐛 BATCH TEST - Result:', result);
    });

    test('BUG REPRODUCTION: User2 should be updated in shared expense scenario', async () => {
        // Arrange: Exact scenario from failing integration test
        const userIds = ['user1', 'user2']; // Both users from shared expense
        const groupId = 'multi-user-test-group';
        const changeType = 'transaction';

        // Mock: User1 succeeds, User2 should also succeed
        mockUpdateUserNotification.mockResolvedValue({ id: 'test', success: true });

        // Act
        const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

        // Assert: CRITICAL - Both users must be processed
        expect(mockUpdateUserNotification).toHaveBeenCalledTimes(2);
        expect(mockUpdateUserNotification).toHaveBeenCalledWith('user1', groupId, changeType);
        expect(mockUpdateUserNotification).toHaveBeenCalledWith('user2', groupId, changeType);

        console.log('🐛 BUG TEST - batchUpdateNotifications called updateUserNotification for:');
        mockUpdateUserNotification.mock.calls.forEach((call: any, index: number) => {
            console.log(`  ${index + 1}. User: ${call[0]}, Group: ${call[1]}, Type: ${call[2]}`);
        });

        // If this passes, the bug is in updateUserNotification or deeper
        expect(result.successCount).toBe(2);
    });
});
