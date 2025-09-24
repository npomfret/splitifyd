import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { NotificationService, type ChangeType } from '../../../services/notification-service';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';

// Mock logger
vi.mock('firebase-functions', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../../monitoring/measure', () => ({
    measureDb: vi.fn((name, fn) => fn()),
}));

describe('NotificationService - Consolidated Unit Tests', () => {
    let notificationService: NotificationService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        notificationService = new NotificationService(stubReader, stubWriter);
        vi.clearAllMocks();
    });

    describe('updateUserNotification', () => {
        it('should update single user notification successfully', async () => {
            const userId = 'user123';
            const groupId = 'group456';
            const changeType = 'transaction';

            stubWriter.setUserNotifications = vi.fn().mockResolvedValue({
                success: true,
                id: `notifications/${userId}`,
            });

            const result = await notificationService.updateUserNotification(userId, groupId, changeType);

            expect(result.success).toBe(true);
            expect(stubWriter.setUserNotifications).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({
                    changeVersion: expect.any(Object), // FieldValue.increment(1)
                    groups: {
                        [groupId]: {
                            lastTransactionChange: expect.any(Object), // FieldValue.serverTimestamp()
                            transactionChangeCount: expect.any(Object), // FieldValue.increment(1)
                        },
                    },
                }),
                true
            );
        });

        it('should handle different change types correctly', async () => {
            const userId = 'user123';
            const groupId = 'group456';

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: `notifications/${userId}`,
            });
            stubWriter.setUserNotifications = mockFn;

            // Test transaction change type
            await notificationService.updateUserNotification(userId, groupId, 'transaction');
            let lastCall = mockFn.mock.calls[0][1];
            expect(lastCall.groups[groupId]).toHaveProperty('lastTransactionChange');
            expect(lastCall.groups[groupId]).toHaveProperty('transactionChangeCount');

            // Test balance change type
            await notificationService.updateUserNotification(userId, groupId, 'balance');
            lastCall = mockFn.mock.calls[1][1];
            expect(lastCall.groups[groupId]).toHaveProperty('lastBalanceChange');
            expect(lastCall.groups[groupId]).toHaveProperty('balanceChangeCount');

            // Test group change type
            await notificationService.updateUserNotification(userId, groupId, 'group');
            lastCall = mockFn.mock.calls[2][1];
            expect(lastCall.groups[groupId]).toHaveProperty('lastGroupDetailsChange');
            expect(lastCall.groups[groupId]).toHaveProperty('groupDetailsChangeCount');
        });
    });

    describe('batchUpdateNotifications', () => {
        it('should update multiple users with single change type', async () => {
            const userIds = ['user1', 'user2', 'user3'];
            const groupId = 'group456';
            const changeType = 'balance';

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });
            stubWriter.setUserNotifications = mockFn;

            const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
            expect(mockFn).toHaveBeenCalledTimes(3);

            // Verify each user was updated with correct data
            userIds.forEach((userId, index) => {
                const call = mockFn.mock.calls[index];
                expect(call[0]).toBe(userId);
                expect(call[1].groups[groupId]).toHaveProperty('lastBalanceChange');
                expect(call[1].groups[groupId]).toHaveProperty('balanceChangeCount');
                expect(call[2]).toBe(true); // merge flag
            });
        });

        it('should handle partial failures in batch operations', async () => {
            const userIds = ['user1', 'user2', 'user3'];
            const groupId = 'group456';
            const changeType = 'transaction';

            // Mock second user to fail
            const mockFn = vi.fn()
                .mockResolvedValueOnce({ success: true, id: 'user1-id' })
                .mockResolvedValueOnce({ success: false, error: 'Firestore error' })
                .mockResolvedValueOnce({ success: true, id: 'user3-id' });
            stubWriter.setUserNotifications = mockFn;

            const result = await notificationService.batchUpdateNotifications(userIds, groupId, changeType);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(1);
            expect(result.results).toHaveLength(3);
            expect(result.results[0].success).toBe(true);
            expect(result.results[1].success).toBe(false);
            expect(result.results[2].success).toBe(true);
        });
    });

    describe('batchUpdateNotificationsMultipleTypes', () => {
        it('should update multiple users with multiple change types atomically', async () => {
            const userIds = ['user1', 'user2'];
            const groupId = 'group456';
            const changeTypes: ChangeType[] = ['transaction', 'balance', 'group'];

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });
            stubWriter.setUserNotifications = mockFn;

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(mockFn).toHaveBeenCalledTimes(2);

            // Verify first user update contains all change types
            const firstUserCall = mockFn.mock.calls[0];
            const firstUserUpdates = firstUserCall[1];

            expect(firstUserUpdates.changeVersion).toBeDefined(); // FieldValue.increment(3)
            expect(firstUserUpdates.groups[groupId]).toHaveProperty('lastTransactionChange');
            expect(firstUserUpdates.groups[groupId]).toHaveProperty('transactionChangeCount');
            expect(firstUserUpdates.groups[groupId]).toHaveProperty('lastBalanceChange');
            expect(firstUserUpdates.groups[groupId]).toHaveProperty('balanceChangeCount');
            expect(firstUserUpdates.groups[groupId]).toHaveProperty('lastGroupDetailsChange');
            expect(firstUserUpdates.groups[groupId]).toHaveProperty('groupDetailsChangeCount');
        });

        it('should handle empty change types array', async () => {
            const userIds = ['user1'];
            const groupId = 'group456';
            const changeTypes: ChangeType[] = [];

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });
            stubWriter.setUserNotifications = mockFn;

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(1);

            // Should still update with basic structure but no field changes
            const call = mockFn.mock.calls[0];
            const updates = call[1];
            expect(updates.changeVersion).toBeDefined(); // FieldValue.increment(0)
            expect(updates.groups[groupId]).toEqual({});
        });

        it('should handle exceptions during individual user updates', async () => {
            const userIds = ['user1', 'user2'];
            const groupId = 'group456';
            const changeTypes: ChangeType[] = ['transaction'];

            // Mock first user to throw exception
            const mockFn = vi.fn()
                .mockRejectedValueOnce(new Error('Database connection failed'))
                .mockResolvedValueOnce({ success: true, id: 'user2-id' });
            stubWriter.setUserNotifications = mockFn;

            const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(1);
            expect(result.results).toHaveLength(2);
            expect(result.results[0].success).toBe(false);
            expect(result.results[0].id).toBe('user1');
            expect(result.results[1].success).toBe(true);
        });
    });

    describe('field mapping validation', () => {
        it('should use correct field names for each change type', async () => {
            const userId = 'user123';
            const groupId = 'group456';

            stubWriter.setUserNotifications = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });

            // Test all change types to verify field mapping
            const testCases = [
                {
                    changeType: 'transaction' as const,
                    expectedFields: ['lastTransactionChange', 'transactionChangeCount'],
                },
                {
                    changeType: 'balance' as const,
                    expectedFields: ['lastBalanceChange', 'balanceChangeCount'],
                },
                {
                    changeType: 'group' as const,
                    expectedFields: ['lastGroupDetailsChange', 'groupDetailsChangeCount'],
                },
            ];

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });
            stubWriter.setUserNotifications = mockFn;

            for (const testCase of testCases) {
                await notificationService.updateUserNotification(userId, groupId, testCase.changeType);

                const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
                const updates = lastCall[1];

                testCase.expectedFields.forEach(fieldName => {
                    expect(updates.groups[groupId]).toHaveProperty(fieldName);
                });
            }
        });
    });

    describe('performance and consistency', () => {
        it('should use merge:true for efficient upserts', async () => {
            const userId = 'user123';
            const groupId = 'group456';

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });
            stubWriter.setUserNotifications = mockFn;

            await notificationService.updateUserNotification(userId, groupId, 'transaction');

            // Verify merge flag is always true for efficient upserts
            const call = mockFn.mock.calls[0];
            expect(call[2]).toBe(true); // merge parameter
        });

        it('should create proper nested structure for new documents', async () => {
            const userId = 'new-user';
            const groupId = 'new-group';

            const mockFn = vi.fn().mockResolvedValue({
                success: true,
                id: 'mock-id',
            });
            stubWriter.setUserNotifications = mockFn;

            await notificationService.updateUserNotification(userId, groupId, 'balance');

            const call = mockFn.mock.calls[0];
            const updates = call[1];

            // Should initialize groups object structure
            expect(updates.groups).toBeDefined();
            expect(updates.groups[groupId]).toBeDefined();
            expect(updates.changeVersion).toBeDefined();
        });
    });

    // ================================
    // Batch Tests (from notification-service-batch.test.ts)
    // ================================

    describe('Batch Update Delegation Tests', () => {
        let mockBatchUpdateNotificationsMultipleTypes: any;

        beforeEach(() => {
            // Mock the underlying method that the old method now delegates to
            mockBatchUpdateNotificationsMultipleTypes = vi.spyOn(notificationService, 'batchUpdateNotificationsMultipleTypes');
        });

        test('should delegate batchUpdateNotifications to batchUpdateNotificationsMultipleTypes', async () => {
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
        });
    });

    describe('Legacy updateUserNotification Method', () => {
        let mockBatchUpdateNotificationsMultipleTypes: any;

        beforeEach(() => {
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
        });
    });

    describe('Atomic batchUpdateNotificationsMultipleTypes', () => {
        let mockFirestoreReader: any;
        let mockFirestoreWriter: any;
        let atomicNotificationService: NotificationService;

        beforeEach(() => {
            mockFirestoreReader = {
                getUserNotification: vi.fn(),
            };
            mockFirestoreWriter = {
                updateUserNotification: vi.fn(),
                setUserNotifications: vi.fn(),
            };

            atomicNotificationService = new NotificationService(mockFirestoreReader, mockFirestoreWriter);
        });

        test('should process multiple change types atomically for each user', async () => {
            // Arrange
            const userIds = ['user1', 'user2', 'user3'];
            const groupId = 'test-group-123';
            const changeTypes: ChangeType[] = ['transaction', 'balance'];

            // Mock: setUserNotifications returns success
            mockFirestoreWriter.setUserNotifications.mockResolvedValue({ id: 'test', success: true });

            // Act
            const result = await atomicNotificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            // Assert: Should call setUserNotifications for each user with merge:true (no defensive reads)
            expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(3);

            // Check that each call contains both change types in atomic update with merge:true
            const updateCalls = mockFirestoreWriter.setUserNotifications.mock.calls;
            updateCalls.forEach(([_, updates, merge]: [string, any, boolean]) => {
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
            const result = await atomicNotificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

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
            const result = await atomicNotificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            // Assert: Should process single change type correctly
            expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(1);
            const [_, updates, merge] = mockFirestoreWriter.setUserNotifications.mock.calls[0];

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
            const result = await atomicNotificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

            // Assert: Should make exactly ONE atomic update per user with BOTH change types
            expect(mockFirestoreWriter.setUserNotifications).toHaveBeenCalledTimes(2);

            // Verify both calls contain atomic updates for both change types with merge:true
            const updateCalls = mockFirestoreWriter.setUserNotifications.mock.calls;
            updateCalls.forEach(([_, updates, merge]: [string, any, boolean]) => {
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
        });
    });
});