import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NotificationService } from '../../../services/notification-service';
import { FirestoreWriter } from '../../../services/firestore/FirestoreWriter';
import { FirestoreReader } from '../../../services/firestore/FirestoreReader';
import type { WriteResult, BatchWriteResult } from '../../../services/firestore/IFirestoreWriter';

// Mock the dependencies
vi.mock('../../../services/firestore/FirestoreWriter');
vi.mock('../../../services/firestore/FirestoreReader');
vi.mock('../../../logger');
vi.mock('../../../utils/performance-monitor', () => ({
    PerformanceMonitor: {
        monitorServiceCall: vi.fn((service, method, fn) => fn())
    }
}));

// Mock FieldValue to simulate Firestore behavior
vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: vi.fn((value) => ({ _increment: value })),
        serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
        arrayUnion: vi.fn((value) => ({ _arrayUnion: value })),
        delete: vi.fn(() => ({ _delete: true }))
    },
    Timestamp: {
        now: vi.fn(() => ({ _timestamp: Date.now() }))
    }
}));

describe('NotificationService', () => {
    let notificationService: NotificationService;
    let mockWriter: any;
    let mockReader: any;

    beforeEach(() => {
        mockWriter = {
            bulkUpdate: vi.fn(),
            bulkUpsert: vi.fn(),
            bulkCreate: vi.fn(),
            runTransaction: vi.fn(),
            getFirestore: vi.fn(),
        };
        mockReader = {
            get: vi.fn(),
            getUserNotificationDocument: vi.fn(),
        };

        // Setup constructor mocks
        vi.mocked(FirestoreWriter).mockImplementation(() => mockWriter);
        vi.mocked(FirestoreReader).mockImplementation(() => mockReader);

        notificationService = new NotificationService();
        vi.clearAllMocks();
    });

    describe('updateUserNotification', () => {
        it('should successfully update a single user notification', async () => {
            // Arrange
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            
            const mockBulkUpdateResult = {
                successCount: 1,
                failureCount: 0,
                results: [{ id: 'user1', success: true }]
            };
            mockWriter.bulkUpdate.mockResolvedValue(mockBulkUpdateResult);

            // Act
            const result = await notificationService.updateUserNotification('user1', 'group1', 'transaction');

            // Assert
            expect(result.success).toBe(true);
            expect(result.id).toBe('user1');
            expect(mockWriter.bulkUpdate).toHaveBeenCalledWith(
                new Map([['user-notifications/user1', expect.any(Object)]])
            );

            // Verify the update data structure
            const updateData = mockWriter.bulkUpdate.mock.calls[0][0].get('user-notifications/user1');
            expect(updateData).toMatchObject({
                changeVersion: { _increment: 1 },
                lastModified: { _serverTimestamp: true },
                'groups.group1.lastTransactionChange': { _serverTimestamp: true },
                'groups.group1.transactionChangeCount': { _increment: 1 }
            });
        });

        it('should handle different change types correctly', async () => {
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            
            const mockResult = { successCount: 1, failureCount: 0, results: [] };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            mockWriter.bulkUpdate.mockResolvedValue(mockResult);

            // Test balance change
            await notificationService.updateUserNotification('user1', 'group1', 'balance');
            
            let updateData = mockWriter.bulkUpdate.mock.calls[0][0].get('user-notifications/user1');
            expect(updateData['groups.group1.lastBalanceChange']).toEqual({ _serverTimestamp: true });
            expect(updateData['groups.group1.balanceChangeCount']).toEqual({ _increment: 1 });

            // Clear and test group change
            vi.clearAllMocks();
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            mockWriter.bulkUpdate.mockResolvedValue(mockResult);
            
            await notificationService.updateUserNotification('user1', 'group1', 'group');
            
            updateData = mockWriter.bulkUpdate.mock.calls[0][0].get('user-notifications/user1');
            expect(updateData['groups.group1.lastGroupDetailsChange']).toEqual({ _serverTimestamp: true });
            expect(updateData['groups.group1.groupDetailsChangeCount']).toEqual({ _increment: 1 });
        });

        it('should handle update failure gracefully', async () => {
            // Arrange
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            
            const mockBulkUpsertResult = {
                successCount: 0,
                failureCount: 1,
                results: []
            };
            mockWriter.bulkUpdate.mockResolvedValue(mockBulkUpsertResult);

            // Act
            const result = await notificationService.updateUserNotification('user1', 'group1', 'transaction');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Update operation failed');
        });

        it('should handle exceptions gracefully', async () => {
            // Arrange - Let getUserNotificationDocument throw the error
            mockReader.getUserNotificationDocument.mockRejectedValue(new Error('Firestore error'));

            // Act
            const result = await notificationService.updateUserNotification('user1', 'group1', 'transaction');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Firestore error');
        });
    });

    describe('batchUpdateNotifications', () => {
        it('should successfully update multiple users', async () => {
            // Arrange - Setup all the underlying operations that batchUpdateNotifications calls
            
            // Mock the getUserNotificationDocument to return valid documents for all users
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            
            // Mock all the writer operations
            mockWriter.bulkCreate.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });
            mockWriter.runTransaction.mockResolvedValue({ success: true });
            mockWriter.bulkUpdate.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });

            // Act
            const result = await notificationService.batchUpdateNotifications(
                ['user1', 'user2', 'user3'], 
                'group1', 
                'transaction'
            );

            // Assert
            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
            expect(result.results.length).toBe(3);
        });

        it('should handle empty user list', async () => {
            // Act
            const result = await notificationService.batchUpdateNotifications([], 'group1', 'transaction');

            // Assert
            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(result.results).toEqual([]);
            // No operations should be called for empty list
        });

        it('should process large user lists in batches', async () => {
            // Arrange - Create a list larger than BATCH_SIZE (500)  
            const userIds = Array.from({ length: 1200 }, (_, i) => `user${i}`);
            
            // Mock the getUserNotificationDocument to return valid documents for all users
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            
            // Mock all the writer operations
            mockWriter.bulkCreate.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });
            mockWriter.runTransaction.mockResolvedValue({ success: true });
            mockWriter.bulkUpdate.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });

            // Act
            const result = await notificationService.batchUpdateNotifications(userIds, 'group1', 'transaction');

            // Assert
            expect(result.successCount).toBe(1200); // All users should succeed
            expect(result.failureCount).toBe(0);
        });

        it('should handle batch failures', async () => {
            // Arrange - simulate some users failing by making bulkCreate fail for some
            let callCount = 0;
            mockWriter.bulkCreate.mockImplementation(() => {
                callCount++;
                if (callCount <= 2) {
                    // First two succeed
                    return Promise.resolve({ successCount: 1, failureCount: 0, results: [] });
                } else {
                    // Last two fail
                    return Promise.resolve({ successCount: 0, failureCount: 1, results: [] });
                }
            });
            
            // Mock other writer operations
            mockWriter.runTransaction.mockResolvedValue({ success: true });
            mockWriter.bulkUpdate.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });
            
            // Mock reader operations
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);

            // Act
            const result = await notificationService.batchUpdateNotifications(
                ['user1', 'user2', 'user3', 'user4'], 
                'group1', 
                'transaction'
            );

            // Assert
            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(2);
        });
    });

    describe('initializeUserNotifications', () => {
        it('should create initial notification document for user', async () => {
            // Arrange
            const mockBulkCreateResult = {
                successCount: 1,
                failureCount: 0,
                results: [{ id: 'user1', success: true }]
            };
            mockWriter.bulkCreate.mockResolvedValue(mockBulkCreateResult);

            // Act
            const result = await notificationService.initializeUserNotifications('user1');

            // Assert
            expect(result.success).toBe(true);
            expect(result.id).toBe('user1');
            expect(mockWriter.bulkCreate).toHaveBeenCalledWith(
                'user-notifications',
                [expect.objectContaining({
                    id: 'user1',
                    changeVersion: 0,
                    groups: {},
                    recentChanges: []
                })]
            );
        });

        it('should handle initialization failure', async () => {
            // Arrange
            mockWriter.bulkCreate.mockResolvedValue({ successCount: 0, failureCount: 1, results: [] });

            // Act
            const result = await notificationService.initializeUserNotifications('user1');

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('addUserToGroup', () => {
        it('should add group to user notification document using transaction', async () => {
            // Arrange
            const mockTransactionResult = { success: true };
            mockWriter.runTransaction = vi.fn().mockResolvedValue(mockTransactionResult);

            // Act
            const result = await notificationService.addUserToGroup('user1', 'group1');

            // Assert
            expect(result.success).toBe(true);
            expect(mockWriter.runTransaction).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('removeUserFromGroup', () => {
        it('should remove group from user notification document', async () => {
            // Arrange
            const mockBulkUpdateResult = {
                successCount: 1,
                failureCount: 0,
                results: [{ id: 'user1', success: true }]
            };
            mockWriter.bulkUpdate.mockResolvedValue(mockBulkUpdateResult);

            // Act
            const result = await notificationService.removeUserFromGroup('user1', 'group1');

            // Assert
            expect(result.success).toBe(true);
            expect(mockWriter.bulkUpdate).toHaveBeenCalledWith(
                new Map([['user-notifications/user1', expect.any(Object)]])
            );

            // Verify the update data contains group deletion
            const updateData = mockWriter.bulkUpdate.mock.calls[0][0].get('user-notifications/user1');
            expect(updateData['groups.group1']).toEqual({ _delete: true });
        });
    });

    describe('error handling', () => {
        it('should handle service-level errors gracefully', async () => {
            // Arrange - Return null to trigger the "no notification document" error
            mockReader.getUserNotificationDocument.mockResolvedValue(null);

            // Act
            const result = await notificationService.updateUserNotification('user1', 'group1', 'transaction');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('User user1 has no notification document');
        });

        it('should handle invalid input gracefully', async () => {
            // Test with empty user ID - return null for empty user
            mockReader.getUserNotificationDocument.mockResolvedValue(null);
            
            const result = await notificationService.updateUserNotification('', 'group1', 'transaction');
            
            // Should fail fast with clear error message
            expect(result.success).toBe(false);
            expect(result.error).toBe('User  has no notification document');
        });
    });

    describe('performance monitoring', () => {
        it('should wrap operations with performance monitoring', async () => {
            const { PerformanceMonitor } = await import('../../../utils/performance-monitor');
            const mockPerformanceMonitor = vi.mocked(PerformanceMonitor);
            
            const mockUserDoc = {
                id: 'user1',
                changeVersion: 0,
                groups: {
                    group1: {
                        lastTransactionChange: null,
                        lastBalanceChange: null,
                        lastGroupDetailsChange: null,
                        transactionChangeCount: 0,
                        balanceChangeCount: 0,
                        groupDetailsChangeCount: 0,
                    }
                },
                recentChanges: [],
                lastModified: new Date()
            };
            mockReader.getUserNotificationDocument.mockResolvedValue(mockUserDoc);
            mockWriter.bulkUpdate.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });
            
            await notificationService.updateUserNotification('user1', 'group1', 'transaction');
            
            expect(mockPerformanceMonitor.monitorServiceCall).toHaveBeenCalledWith(
                'NotificationService',
                'updateUserNotification',
                expect.any(Function)
            );
        });
    });
});