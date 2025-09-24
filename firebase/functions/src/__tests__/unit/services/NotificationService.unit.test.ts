import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('NotificationService - Unit Tests', () => {
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
});