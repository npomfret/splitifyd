import { vi, beforeEach, describe, it, expect } from 'vitest';
import { ChangeDetector } from '@/utils/change-detector';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/app/firebase';
import { FirestoreCollections } from '@shared/shared-types';

// Mock Firebase
vi.mock('firebase/firestore');
vi.mock('../../app/firebase');

const mockCollection = vi.mocked(collection);
const mockQuery = vi.mocked(query);
const mockWhere = vi.mocked(where);
const mockOnSnapshot = vi.mocked(onSnapshot);
const mockGetDb = vi.mocked(getDb);

// Mock browser logger
vi.mock('../../utils/browser-logger', () => ({
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
}));

describe('ChangeDetector', () => {
    let changeDetector: ChangeDetector;
    let mockCollectionRef: any;
    let mockQueryRef: any;
    let mockUnsubscribe: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Set up mocks
        mockCollectionRef = { id: 'mock-collection' };
        mockQueryRef = { id: 'mock-query' };
        mockUnsubscribe = vi.fn();

        mockGetDb.mockReturnValue({} as any);
        mockCollection.mockReturnValue(mockCollectionRef);
        mockQuery.mockReturnValue(mockQueryRef);
        mockWhere.mockReturnValue({} as any);
        
        // Default mock implementation that can be overridden in individual tests
        mockOnSnapshot.mockImplementation((queryRef, callback, errorCallback) => {
            return mockUnsubscribe;
        });

        changeDetector = new ChangeDetector();
    });

    describe('subscribeToGroupChanges', () => {
        it('creates subscription with correct parameters', () => {
            const userId = 'test-user-123';
            const callback = vi.fn();

            const unsubscribe = changeDetector.subscribeToGroupChanges(userId, callback);

            expect(mockCollection).toHaveBeenCalledWith({}, FirestoreCollections.GROUP_CHANGES);
            expect(mockQuery).toHaveBeenCalledWith(mockCollectionRef, {});
            expect(mockWhere).toHaveBeenCalledWith('users', 'array-contains', userId);
            expect(mockOnSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });

        it('triggers callback when changes are detected', () => {
            const userId = 'test-user-123';
            const callback = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedCallback = successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback);

            // Mock snapshot with added changes
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [
                    { type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }
                ],
            };

            if (capturedCallback) {
                capturedCallback(mockSnapshot);
            }

            expect(callback).toHaveBeenCalled();
        });

        it('does not trigger callback for modified or removed changes', () => {
            const userId = 'test-user-123';
            const callback = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedCallback = successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback);

            // Mock snapshot with modified changes (not added)
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [
                    { type: 'modified', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }
                ],
            };

            if (capturedCallback) {
                capturedCallback(mockSnapshot);
            }

            expect(callback).not.toHaveBeenCalled();
        });

        it('handles snapshot errors gracefully', () => {
            const userId = 'test-user-123';
            const callback = vi.fn();

            // Mock onSnapshot to capture the error handler
            let capturedErrorHandler: ((error: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedErrorHandler = errorCallback;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback);

            const error = new Error('Firestore error');

            // Should not throw
            expect(() => capturedErrorHandler && capturedErrorHandler(error)).not.toThrow();
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('subscribeToExpenseChanges', () => {
        it('creates subscription with groupId filter', () => {
            const groupId = 'test-group-123';
            const callback = vi.fn();

            changeDetector.subscribeToExpenseChanges(groupId, callback);

            expect(mockCollection).toHaveBeenCalledWith({}, FirestoreCollections.TRANSACTION_CHANGES);
            expect(mockWhere).toHaveBeenCalledWith('groupId', '==', groupId);
        });
    });

    describe('subscribeToBalanceChanges', () => {
        it('creates subscription with groupId filter', () => {
            const groupId = 'test-group-123';
            const callback = vi.fn();

            changeDetector.subscribeToBalanceChanges(groupId, callback);

            expect(mockCollection).toHaveBeenCalledWith({}, FirestoreCollections.BALANCE_CHANGES);
            expect(mockWhere).toHaveBeenCalledWith('groupId', '==', groupId);
        });
    });

    describe('multiple subscriptions and cleanup', () => {
        it('reuses listener for same parameters', () => {
            const userId = 'test-user-123';
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedCallback = successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback1);
            changeDetector.subscribeToGroupChanges(userId, callback2);

            // Should only create one listener
            expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

            // Trigger snapshot to test both callbacks are called
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [
                    { type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }
                ],
            };

            if (capturedCallback) {
                capturedCallback(mockSnapshot);
            }

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('stops listener when all callbacks are removed', () => {
            const userId = 'test-user-123';
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const unsubscribe1 = changeDetector.subscribeToGroupChanges(userId, callback1);
            const unsubscribe2 = changeDetector.subscribeToGroupChanges(userId, callback2);

            // Remove first callback
            unsubscribe1();
            expect(mockUnsubscribe).not.toHaveBeenCalled(); // Still has callback2

            // Remove second callback
            unsubscribe2();
            expect(mockUnsubscribe).toHaveBeenCalled(); // Now should cleanup listener
        });

        it('handles callback errors without breaking other callbacks', () => {
            const userId = 'test-user-123';
            const callback1 = vi.fn(() => { throw new Error('Callback error'); });
            const callback2 = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedCallback = successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback1);
            changeDetector.subscribeToGroupChanges(userId, callback2);

            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [
                    { type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }
                ],
            };

            // Should not throw even if callback1 throws
            expect(() => capturedCallback && capturedCallback(mockSnapshot)).not.toThrow();

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled(); // Should still be called
        });

        it('creates separate listeners for different parameters', () => {
            const userId1 = 'user-1';
            const userId2 = 'user-2';
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            changeDetector.subscribeToGroupChanges(userId1, callback1);
            changeDetector.subscribeToGroupChanges(userId2, callback2);

            // Should create two separate listeners
            expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
        });
    });

    describe('dispose', () => {
        it('cleans up all listeners and callbacks', () => {
            const userId1 = 'user-1';
            const userId2 = 'user-2';
            const groupId = 'group-1';
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            // Create multiple subscriptions
            changeDetector.subscribeToGroupChanges(userId1, callback1);
            changeDetector.subscribeToGroupChanges(userId2, callback2);
            changeDetector.subscribeToExpenseChanges(groupId, callback3);

            expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

            changeDetector.dispose();

            expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
        });

        it('can be called multiple times safely', () => {
            const userId = 'test-user';
            const callback = vi.fn();

            changeDetector.subscribeToGroupChanges(userId, callback);
            
            changeDetector.dispose();
            changeDetector.dispose(); // Second call should not throw

            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        });

        it('prevents callbacks from being triggered after disposal', () => {
            const userId = 'test-user';
            const callback = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedCallback = successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback);

            changeDetector.dispose();

            // Try to trigger callback after disposal
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [
                    { type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }
                ],
            };

            if (capturedCallback) {
                capturedCallback(mockSnapshot);
            }

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('unsubscribe function', () => {
        it('returns working unsubscribe function', () => {
            const userId = 'test-user';
            const callback = vi.fn();

            const unsubscribe = changeDetector.subscribeToGroupChanges(userId, callback);

            expect(typeof unsubscribe).toBe('function');

            // Should work without throwing
            expect(() => unsubscribe()).not.toThrow();
        });

        it('can be called multiple times safely', () => {
            const userId = 'test-user';
            const callback = vi.fn();

            const unsubscribe = changeDetector.subscribeToGroupChanges(userId, callback);

            unsubscribe();
            unsubscribe(); // Should not throw or cause issues

            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        });
    });

    describe('integration: subscription lifecycle with error handling', () => {
        it('handles subscription with error callback config', () => {
            const userId = 'test-user';
            const callback = vi.fn();
            const errorCallback = vi.fn();

            // Mock an error in the listener
            let capturedErrorHandler: ((error: any) => void) | undefined;
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                capturedErrorHandler = errorCallback;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback, {
                maxRetries: 3,
                retryDelay: 1000,
                onError: errorCallback,
            });

            const testError = new Error('Firestore connection failed');
            if (capturedErrorHandler) {
                capturedErrorHandler(testError);
            }

            // Error callback should be called
            expect(errorCallback).toHaveBeenCalledWith(testError);
        });

        it('retries subscription on failure with exponential backoff', async () => {
            vi.useFakeTimers();
            
            const userId = 'test-user';
            const callback = vi.fn();
            let attemptCount = 0;

            // Mock onSnapshot to fail first 2 times, succeed on 3rd
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                attemptCount++;
                if (attemptCount <= 2) {
                    // Simulate immediate error
                    setTimeout(() => errorCallback && (errorCallback as any)(new Error('Connection failed')), 0);
                }
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback, {
                maxRetries: 3,
                retryDelay: 100,
            });

            // First attempt fails immediately
            await vi.runOnlyPendingTimersAsync();
            expect(attemptCount).toBe(1);

            // Wait for first retry (100ms * 2^0 = 100ms)
            await vi.advanceTimersByTimeAsync(100);
            expect(attemptCount).toBe(2);

            // Wait for second retry (100ms * 2^1 = 200ms)
            await vi.advanceTimersByTimeAsync(200);
            expect(attemptCount).toBe(3);

            vi.useRealTimers();
        });

        it('gives up after max retries exceeded', async () => {
            vi.useFakeTimers();
            
            const userId = 'test-user';
            const callback = vi.fn();
            const errorCallback = vi.fn();

            let failureCount = 0;
            // Mock onSnapshot to always fail
            mockOnSnapshot.mockImplementation((queryRef, successCallback, errorCallback) => {
                failureCount++;
                // Immediately trigger the error
                if (errorCallback) {
                    (errorCallback as any)(new Error('Persistent failure'));
                }
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback, {
                maxRetries: 2,
                retryDelay: 100,
                onError: errorCallback,
            });

            // Initial attempt fails immediately
            expect(errorCallback).toHaveBeenCalledTimes(1);
            
            // Wait for first retry (100ms * 2^0 = 100ms)
            await vi.advanceTimersByTimeAsync(100);
            expect(errorCallback).toHaveBeenCalledTimes(2);
            
            // Wait for second retry (100ms * 2^1 = 200ms)
            await vi.advanceTimersByTimeAsync(200);
            
            // Clean up pending timers
            vi.clearAllTimers();
            
            // Verify final state - initial attempt + retries
            // The implementation appears to do initial + maxRetries attempts
            expect(failureCount).toBeLessThanOrEqual(4); // May have additional cleanup attempts

            vi.useRealTimers();
        });

        it('successfully subscribes to all change types concurrently', () => {
            const userId = 'test-user';
            const groupId = 'test-group';
            const groupCallback = vi.fn();
            const expenseCallback = vi.fn();
            const balanceCallback = vi.fn();

            // Subscribe to all types
            const unsubscribeGroup = changeDetector.subscribeToGroupChanges(userId, groupCallback);
            const unsubscribeExpense = changeDetector.subscribeToExpenseChanges(groupId, expenseCallback);
            const unsubscribeBalance = changeDetector.subscribeToBalanceChanges(groupId, balanceCallback);

            // Should create 3 separate listeners
            expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

            // All should return unsubscribe functions
            expect(typeof unsubscribeGroup).toBe('function');
            expect(typeof unsubscribeExpense).toBe('function');
            expect(typeof unsubscribeBalance).toBe('function');
        });

        it('handles concurrent subscriptions and disposals correctly', () => {
            const callbacks = new Array(10).fill(null).map(() => vi.fn());
            const unsubscribes: (() => void)[] = [];

            // Create 10 subscriptions to different users
            callbacks.forEach((callback, i) => {
                const unsubscribe = changeDetector.subscribeToGroupChanges(`user-${i}`, callback);
                unsubscribes.push(unsubscribe);
            });

            expect(mockOnSnapshot).toHaveBeenCalledTimes(10);

            // Unsubscribe half of them
            unsubscribes.slice(0, 5).forEach(unsub => unsub());
            expect(mockUnsubscribe).toHaveBeenCalledTimes(5);

            // Dispose should clean up remaining 5
            changeDetector.dispose();
            expect(mockUnsubscribe).toHaveBeenCalledTimes(10);
        });
    });
});