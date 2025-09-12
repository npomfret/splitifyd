/**
 * Unit Tests for NotificationService.batchUpdateNotifications
 *
 * These tests verify that the batch update method correctly:
 * 1. Calls updateUserNotification for each user in the list
 * 2. Handles both successful and failed updates
 * 3. Returns correct success/failure counts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NotificationService, type ChangeType } from '../../../services/notification-service';

describe('NotificationService.batchUpdateNotifications', () => {
    let notificationService: NotificationService;
    let mockFirestoreReader: any;
    let mockFirestoreWriter: any;
    let mockBatchUpdateNotificationsMultipleTypes: any;

    beforeEach(() => {
        mockFirestoreReader = {};
        mockFirestoreWriter = {};

        // Create NotificationService instance
        notificationService = new NotificationService(mockFirestoreReader, mockFirestoreWriter);

        // Mock the underlying method that the old method now delegates to
        mockBatchUpdateNotificationsMultipleTypes = vi.spyOn(notificationService, 'batchUpdateNotificationsMultipleTypes');
    });

    test('should delegate to batchUpdateNotificationsMultipleTypes with single change type', async () => {
        // Arrange
        const userIds = ['user1', 'user2'];
        const groupId = 'test-group-123';
        const changeType = 'transaction';

        // Mock successful updates
        mockBatchUpdateNotificationsMultipleTypes.mockResolvedValue({ 
            successCount: 2, 
            failureCount: 0,
            results: [
                { id: 'user1', success: true },
                { id: 'user2', success: true }
            ]
        });

        // Act
        const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

        // Assert: Should delegate to the new atomic method with single change type in array
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledTimes(1);
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledWith(userIds, groupId, [changeType]);

        // Should return success for all users
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);
    });

    test('should handle delegation with mixed success and failure', async () => {
        // Arrange
        const userIds = ['user1', 'user2', 'user3'];
        const groupId = 'test-group-456';
        const changeType = 'balance';

        // Mock mixed success/failure response
        mockBatchUpdateNotificationsMultipleTypes.mockResolvedValue({
            successCount: 2,
            failureCount: 1,
            results: [
                { id: 'user1', success: true },
                { id: 'user2', success: false },
                { id: 'user3', success: true }
            ]
        });

        // Act
        const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

        // Assert: Should delegate correctly
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledWith(userIds, groupId, [changeType]);
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
    });

    test('should maintain backward compatibility for existing callers', async () => {
        // Arrange: This test verifies that code using the old method still works
        const userIds = ['user1', 'user2'];
        const groupId = 'multi-user-test-group';
        const changeType = 'transaction';

        mockBatchUpdateNotificationsMultipleTypes.mockResolvedValue({
            successCount: 2,
            failureCount: 0,
            results: [
                { id: 'user1', success: true },
                { id: 'user2', success: true }
            ]
        });

        // Act: Call the old method
        const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

        // Assert: Should work exactly like before for existing callers
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledWith(userIds, groupId, [changeType]);
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);

        console.log('✅ REFACTOR: Old batchUpdateNotifications method delegates correctly');
    });
});

describe('NotificationService.updateUserNotification (legacy method)', () => {
    let notificationService: NotificationService;
    let mockFirestoreReader: any;
    let mockFirestoreWriter: any;
    let mockBatchUpdateNotificationsMultipleTypes: any;

    beforeEach(() => {
        mockFirestoreReader = {};
        mockFirestoreWriter = {};

        notificationService = new NotificationService(mockFirestoreReader, mockFirestoreWriter);

        // Mock the underlying method that the old method now delegates to
        mockBatchUpdateNotificationsMultipleTypes = vi.spyOn(notificationService, 'batchUpdateNotificationsMultipleTypes');
    });

    test('should delegate to batchUpdateNotificationsMultipleTypes with single user and type', async () => {
        // Arrange
        const userId = 'user1';
        const groupId = 'test-group-123';
        const changeType = 'transaction';

        // Mock successful update
        mockBatchUpdateNotificationsMultipleTypes.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            results: [{ id: userId, success: true }]
        });

        // Act
        const result = await notificationService.updateUserNotification(userId, groupId, changeType);

        // Assert: Should delegate to the batch method with single user and single change type in arrays
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledTimes(1);
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledWith([userId], groupId, [changeType]);

        // Should return the single result from batch of 1
        expect(result.success).toBe(true);
        expect(result.id).toBe(userId);
    });

    test('should maintain backward compatibility for single user updates', async () => {
        // Arrange
        const userId = 'user1';
        const groupId = 'test-group-456';
        const changeType = 'balance';

        mockBatchUpdateNotificationsMultipleTypes.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            results: [{ id: userId, success: true }]
        });

        // Act: Call the old method
        const result = await notificationService.updateUserNotification(userId, groupId, changeType);

        // Assert: Should work exactly like before for existing callers
        expect(mockBatchUpdateNotificationsMultipleTypes).toHaveBeenCalledWith([userId], groupId, [changeType]);
        expect(result.success).toBe(true);

        console.log('✅ REFACTOR: Old updateUserNotification method delegates to batch correctly');
    });
});

describe('NotificationService.batchUpdateNotificationsMultipleTypes', () => {
    let notificationService: NotificationService;
    let mockFirestoreReader: any;
    let mockFirestoreWriter: any;

    beforeEach(() => {
        mockFirestoreReader = {
            getUserNotification: vi.fn(),
        };
        mockFirestoreWriter = {
            updateUserNotification: vi.fn(),
        };

        notificationService = new NotificationService(mockFirestoreReader, mockFirestoreWriter);
    });

    test('should process multiple change types atomically for each user', async () => {
        // Arrange
        const userIds = ['user1', 'user2', 'user3'];
        const groupId = 'test-group-123';
        const changeTypes: ChangeType[] = ['transaction', 'balance'];

        // Mock: All users have the group
        mockFirestoreReader.getUserNotification.mockResolvedValue({
            groups: { [groupId]: {} }
        });
        mockFirestoreWriter.updateUserNotification.mockResolvedValue({ id: 'test', success: true });

        // Act
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should call updateUserNotification for each user with atomic updates
        expect(mockFirestoreWriter.updateUserNotification).toHaveBeenCalledTimes(3);
        
        // Check that each call contains both change types in atomic update
        const updateCalls = mockFirestoreWriter.updateUserNotification.mock.calls;
        updateCalls.forEach(([userId, updates]: [string, any]) => {
            expect(updates).toEqual(expect.objectContaining({
                changeVersion: expect.any(Object), // FieldValue.increment(2) for both types
                [`groups.${groupId}.lastTransactionChange`]: expect.any(Object),
                [`groups.${groupId}.transactionChangeCount`]: expect.any(Object),
                [`groups.${groupId}.lastBalanceChange`]: expect.any(Object),
                [`groups.${groupId}.balanceChangeCount`]: expect.any(Object),
            }));
        });

        // Should return success for all users
        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
    });

    test('should handle mixed success and failure correctly', async () => {
        // Arrange
        const userIds = ['user1', 'user2', 'user3'];
        const groupId = 'test-group-456';
        const changeTypes: ChangeType[] = ['transaction', 'balance'];

        // Mock: user1 succeeds, user2 fails (user not in group), user3 succeeds
        mockFirestoreReader.getUserNotification
            .mockResolvedValueOnce({ groups: { [groupId]: {} } }) // user1 has group
            .mockResolvedValueOnce({ groups: {} }) // user2 doesn't have group
            .mockResolvedValueOnce({ groups: { [groupId]: {} } }); // user3 has group
        
        mockFirestoreWriter.updateUserNotification.mockResolvedValue({ id: 'test', success: true });

        // Act
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should process all users, with user2 skipped gracefully
        expect(mockFirestoreWriter.updateUserNotification).toHaveBeenCalledTimes(2); // Only user1 and user3 get written
        expect(result.successCount).toBe(3); // All count as success (user2 gracefully skipped)
        expect(result.failureCount).toBe(0);
    });

    test('should work with single change type', async () => {
        // Arrange
        const userIds = ['user1'];
        const groupId = 'test-group-single';
        const changeTypes: ChangeType[] = ['group'];

        mockFirestoreReader.getUserNotification.mockResolvedValue({
            groups: { [groupId]: {} }
        });
        mockFirestoreWriter.updateUserNotification.mockResolvedValue({ id: 'user1', success: true });

        // Act
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should process single change type correctly
        expect(mockFirestoreWriter.updateUserNotification).toHaveBeenCalledTimes(1);
        const [userId, updates] = mockFirestoreWriter.updateUserNotification.mock.calls[0];
        
        expect(updates).toEqual(expect.objectContaining({
            changeVersion: expect.any(Object), // FieldValue.increment(1)
            [`groups.${groupId}.lastGroupDetailsChange`]: expect.any(Object),
            [`groups.${groupId}.groupDetailsChangeCount`]: expect.any(Object),
        }));
        
        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
    });

    test('CRITICAL: Phase 5 atomicity fix - should replace two separate calls', async () => {
        // Arrange: This is exactly what the change-tracker.ts should do
        const userIds = ['user1', 'user2'];
        const groupId = 'expense-or-settlement-group';
        const changeTypes: ChangeType[] = ['transaction', 'balance']; // Previously two separate calls!

        mockFirestoreReader.getUserNotification.mockResolvedValue({
            groups: { [groupId]: {} }
        });
        mockFirestoreWriter.updateUserNotification.mockResolvedValue({ id: 'test', success: true });

        // Act: Single atomic call instead of two separate ones
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should make exactly ONE atomic update per user with BOTH change types
        expect(mockFirestoreWriter.updateUserNotification).toHaveBeenCalledTimes(2);
        
        // Verify both calls contain atomic updates for both change types
        const updateCalls = mockFirestoreWriter.updateUserNotification.mock.calls;
        updateCalls.forEach(([userId, updates]: [string, any]) => {
            expect(updates).toEqual(expect.objectContaining({
                changeVersion: expect.any(Object), // FieldValue.increment(2) for both types
                [`groups.${groupId}.lastTransactionChange`]: expect.any(Object),
                [`groups.${groupId}.transactionChangeCount`]: expect.any(Object),
                [`groups.${groupId}.lastBalanceChange`]: expect.any(Object),
                [`groups.${groupId}.balanceChangeCount`]: expect.any(Object),
            }));
        });

        // Both users should be updated successfully
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);

        console.log('✅ PHASE 5: Atomic notification update validated - single method handles all logic');
    });
});
