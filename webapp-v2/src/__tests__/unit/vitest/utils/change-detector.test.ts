import { vi, beforeEach, describe, it, expect } from 'vitest';
import { ChangeDetector } from '@/utils/change-detector';
import { FirestoreCollections } from '@splitifyd/shared';

// Create mock functions that will be used in the tests
// const mockCollection = vi.fn();
// const mockQuery = vi.fn();
// const mockWhere = vi.fn();
// const mockOnSnapshot = vi.fn();
// const mockGetDb = vi.fn();

// Mock Firebase with factory functions to avoid hoisting issues
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
}));

vi.mock('@/app/firebase', () => ({
    getDb: vi.fn(),
}));

// Mock browser logger
vi.mock('@/utils/browser-logger', () => ({
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
}));

// Import after mocking to get the mocked versions
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/app/firebase';

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

        vi.mocked(getDb).mockReturnValue({} as any);
        vi.mocked(collection).mockReturnValue(mockCollectionRef);
        vi.mocked(query).mockReturnValue(mockQueryRef);
        vi.mocked(where).mockReturnValue({} as any);

        // Default mock implementation that can be overridden in individual tests
        vi.mocked(onSnapshot).mockImplementation((_, _callback, _errorCallback) => {
            return mockUnsubscribe;
        });

        changeDetector = new ChangeDetector();
    });

    describe('subscribeToGroupChanges', () => {
        it('creates subscription with correct parameters', () => {
            const userId = 'test-user-123';
            const callback = vi.fn();

            const unsubscribe = changeDetector.subscribeToGroupChanges(userId, callback);

            expect(collection).toHaveBeenCalledWith({}, FirestoreCollections.GROUP_CHANGES);
            expect(query).toHaveBeenCalledWith(mockCollectionRef, {});
            expect(where).toHaveBeenCalledWith('users', 'array-contains', userId);
            expect(onSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });

        it('triggers callback when changes are detected', () => {
            const userId = 'test-user-123';
            const callback = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            vi.mocked(onSnapshot).mockImplementation((_, _successCallback, _errorCallback) => {
                capturedCallback = _successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback);

            // Mock snapshot with added changes
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [{ type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }],
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
            vi.mocked(onSnapshot).mockImplementation((_, _successCallback, _errorCallback) => {
                capturedCallback = _successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback);

            // Mock snapshot with modified changes (not added)
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [{ type: 'modified', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }],
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
            vi.mocked(onSnapshot).mockImplementation((_, _successCallback, _errorCallback) => {
                capturedErrorHandler = _errorCallback;
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

            expect(collection).toHaveBeenCalledWith({}, FirestoreCollections.TRANSACTION_CHANGES);
            expect(where).toHaveBeenCalledWith('groupId', '==', groupId);
        });
    });

    describe('subscribeToBalanceChanges', () => {
        it('creates subscription with groupId filter', () => {
            const groupId = 'test-group-123';
            const callback = vi.fn();

            changeDetector.subscribeToBalanceChanges(groupId, callback);

            expect(collection).toHaveBeenCalledWith({}, FirestoreCollections.BALANCE_CHANGES);
            expect(where).toHaveBeenCalledWith('groupId', '==', groupId);
        });
    });

    describe('multiple subscriptions and cleanup', () => {
        it('reuses listener for same parameters', () => {
            const userId = 'test-user-123';
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            vi.mocked(onSnapshot).mockImplementation((_, _successCallback, _errorCallback) => {
                capturedCallback = _successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback1);
            changeDetector.subscribeToGroupChanges(userId, callback2);

            // Should only create one listener
            expect(onSnapshot).toHaveBeenCalledTimes(1);

            // Trigger snapshot to test both callbacks are called
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [{ type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }],
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
            const callback1 = vi.fn(() => {
                throw new Error('Callback error');
            });
            const callback2 = vi.fn();

            // Mock onSnapshot to capture the success callback
            let capturedCallback: ((snapshot: any) => void) | undefined;
            vi.mocked(onSnapshot).mockImplementation((_, _successCallback, _errorCallback) => {
                capturedCallback = _successCallback as any;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges(userId, callback1);
            changeDetector.subscribeToGroupChanges(userId, callback2);

            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change-1', data: () => ({ timestamp: Date.now() }) }],
                docChanges: () => [{ type: 'added', doc: { id: 'change-1', data: () => ({ timestamp: Date.now() }) } }],
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
            expect(onSnapshot).toHaveBeenCalledTimes(2);
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

            expect(onSnapshot).toHaveBeenCalledTimes(3);

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
    });

    describe('error handling', () => {
        it('handles subscription with error callback config', () => {
            const userId = 'test-user';
            const callback = vi.fn();
            const errorCallback = vi.fn();

            // Mock an error in the listener
            let capturedErrorHandler: ((error: any) => void) | undefined;
            vi.mocked(onSnapshot).mockImplementation((_, _successCallback, _errorCallback) => {
                capturedErrorHandler = _errorCallback;
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

        it('successfully subscribes to all change types', () => {
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
            expect(onSnapshot).toHaveBeenCalledTimes(3);

            // All should return unsubscribe functions
            expect(typeof unsubscribeGroup).toBe('function');
            expect(typeof unsubscribeExpense).toBe('function');
            expect(typeof unsubscribeBalance).toBe('function');
        });
    });
});
