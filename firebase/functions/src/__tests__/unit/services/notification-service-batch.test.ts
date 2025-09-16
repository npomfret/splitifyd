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
                { id: 'user2', success: true },
            ],
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
                { id: 'user3', success: true },
            ],
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
                { id: 'user2', success: true },
            ],
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
            results: [{ id: userId, success: true }],
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
            results: [{ id: userId, success: true }],
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
            setUserNotifications: vi.fn(),
        };

        notificationService = new NotificationService(mockFirestoreReader, mockFirestoreWriter);
    });

    test('should process multiple change types atomically for each user', async () => {
        // Arrange
        const userIds = ['user1', 'user2', 'user3'];
        const groupId = 'test-group-123';
        const changeTypes: ChangeType[] = ['transaction', 'balance'];

        // Mock: setUserNotifications returns success
        mockFirestoreWriter.setUserNotifications.mockResolvedValue({ id: 'test', success: true });

        // Act
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should call setUserNotifications for each user with merge:true (no defensive reads)
        expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(3);

        // Check that each call contains both change types in atomic update with merge:true
        const updateCalls = mockFirestoreWriter.setUserNotifications.mock.calls;
        updateCalls.forEach(([userId, updates, merge]: [string, any, boolean]) => {
            expect(merge).toBe(true); // Should use merge:true for upsert behavior
            expect(updates).toEqual(
                expect.objectContaining({
                    changeVersion: expect.any(Object), // FieldValue.increment(2) for both types
                    groups: {
                        [groupId]: expect.objectContaining({
                            lastTransactionChange: expect.any(Object),
                            transactionChangeCount: expect.any(Object),
                            lastBalanceChange: expect.any(Object),
                            balanceChangeCount: expect.any(Object),
                        }),
                    },
                }),
            );
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

        // Mock: user1 and user3 succeed, user2 fails (simulated network error)
        mockFirestoreWriter.setUserNotifications
            .mockResolvedValueOnce({ id: 'user1', success: true })
            .mockResolvedValueOnce({ id: 'user2', success: false }) // Simulated failure
            .mockResolvedValueOnce({ id: 'user3', success: true });

        // Act
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should process all users, with proper success/failure handling
        expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(3); // All users attempted
        expect(result.successCount).toBe(2); // user1 and user3 succeeded
        expect(result.failureCount).toBe(1); // user2 failed
    });

    test('should work with single change type', async () => {
        // Arrange
        const userIds = ['user1'];
        const groupId = 'test-group-single';
        const changeTypes: ChangeType[] = ['group'];

        mockFirestoreWriter.setUserNotifications.mockResolvedValue({ id: 'user1', success: true });

        // Act
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should process single change type correctly
        expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(1);
        const [userId, updates, merge] = mockFirestoreWriter.setUserNotifications.mock.calls[0];

        expect(merge).toBe(true);
        expect(updates).toEqual(
            expect.objectContaining({
                changeVersion: expect.any(Object), // FieldValue.increment(1)
                groups: {
                    [groupId]: expect.objectContaining({
                        lastGroupDetailsChange: expect.any(Object),
                        groupDetailsChangeCount: expect.any(Object),
                    }),
                },
            }),
        );

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
    });

    test('CRITICAL: Phase 5 atomicity fix - should replace two separate calls', async () => {
        // Arrange: This is exactly what the change-tracker.ts should do
        const userIds = ['user1', 'user2'];
        const groupId = 'expense-or-settlement-group';
        const changeTypes: ChangeType[] = ['transaction', 'balance']; // Previously two separate calls!

        mockFirestoreWriter.setUserNotifications.mockResolvedValue({ id: 'test', success: true });

        // Act: Single atomic call instead of two separate ones
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Assert: Should make exactly ONE atomic update per user with BOTH change types
        expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(2);

        // Verify both calls contain atomic updates for both change types with merge:true
        const updateCalls = mockFirestoreWriter.setUserNotifications.mock.calls;
        updateCalls.forEach(([userId, updates, merge]: [string, any, boolean]) => {
            expect(merge).toBe(true); // Should use upsert behavior
            expect(updates).toEqual(
                expect.objectContaining({
                    changeVersion: expect.any(Object), // FieldValue.increment(2) for both types
                    groups: {
                        [groupId]: expect.objectContaining({
                            lastTransactionChange: expect.any(Object),
                            transactionChangeCount: expect.any(Object),
                            lastBalanceChange: expect.any(Object),
                            balanceChangeCount: expect.any(Object),
                        }),
                    },
                }),
            );
        });

        // Both users should be updated successfully
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);

        console.log('✅ OPTIMIZED: Atomic notification update with merge:true - no defensive reads needed');
    });
});
