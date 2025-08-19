import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangeDetector } from '@/utils/change-detector';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { FirestoreCollections } from '@shared/shared-types';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
}));

vi.mock('@/app/firebase', () => ({
    getDb: vi.fn(() => 'mock-db'),
}));

vi.mock('@/utils/browser-logger', () => ({
    logInfo: vi.fn(),
    logWarning: vi.fn(),
}));

describe('ChangeDetector', () => {
    let changeDetector: ChangeDetector;
    let mockUnsubscribe: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        changeDetector = new ChangeDetector();
        mockUnsubscribe = vi.fn();
        
        // Setup default mock behavior
        vi.mocked(collection).mockReturnValue('mock-collection' as any);
        vi.mocked(query).mockReturnValue('mock-query' as any);
        vi.mocked(where).mockReturnValue('mock-where' as any);
        vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe);
    });

    afterEach(() => {
        changeDetector.dispose();
    });

    describe('subscribeToGroupChanges', () => {
        it('should create a listener for group changes', () => {
            const callback = vi.fn();
            const unsubscribe = changeDetector.subscribeToGroupChanges('user1', callback);

            expect(collection).toHaveBeenCalledWith('mock-db', FirestoreCollections.GROUP_CHANGES);
            expect(where).toHaveBeenCalledWith('users', 'array-contains', 'user1');
            expect(onSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });

        it('should trigger callback when new changes are detected', () => {
            const callback = vi.fn();
            let snapshotCallback: any;

            vi.mocked(onSnapshot).mockImplementation((query, cb) => {
                snapshotCallback = cb;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges('user1', callback);

            // Simulate a snapshot with added changes
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [
                    { 
                        id: 'change1', 
                        data: () => ({ 
                            groupId: 'group1',
                            timestamp: Date.now(),
                            type: 'updated'
                        })
                    }
                ],
                docChanges: () => [
                    { 
                        type: 'added',
                        doc: {
                            data: () => ({ 
                                groupId: 'group1',
                                timestamp: Date.now()
                            })
                        }
                    }
                ]
            };

            snapshotCallback(mockSnapshot);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not trigger callback for non-added changes', () => {
            const callback = vi.fn();
            let snapshotCallback: any;

            vi.mocked(onSnapshot).mockImplementation((query, cb) => {
                snapshotCallback = cb;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges('user1', callback);

            // Simulate a snapshot with modified changes (not added)
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [],
                docChanges: () => [
                    { type: 'modified', doc: { data: () => ({}) } },
                    { type: 'removed', doc: { data: () => ({}) } }
                ]
            };

            snapshotCallback(mockSnapshot);

            expect(callback).not.toHaveBeenCalled();
        });

        it('should reuse existing listener for same user', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            changeDetector.subscribeToGroupChanges('user1', callback1);
            changeDetector.subscribeToGroupChanges('user1', callback2);

            // onSnapshot should only be called once for the same key
            expect(onSnapshot).toHaveBeenCalledTimes(1);
        });

        it('should handle listener errors gracefully', () => {
            const callback = vi.fn();
            let errorCallback: any;

            vi.mocked(onSnapshot).mockImplementation((query, cb, errCb) => {
                errorCallback = errCb;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges('user1', callback);

            // Simulate an error
            const error = new Error('Firestore error');
            errorCallback(error);

            // Should not throw, just log warning
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('subscribeToExpenseChanges', () => {
        it('should create a listener for expense changes', () => {
            const callback = vi.fn();
            const unsubscribe = changeDetector.subscribeToExpenseChanges('group1', callback);

            expect(collection).toHaveBeenCalledWith('mock-db', FirestoreCollections.TRANSACTION_CHANGES);
            expect(where).toHaveBeenCalledWith('groupId', '==', 'group1');
            expect(onSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });

        it('should trigger callback for transaction changes', () => {
            const callback = vi.fn();
            let snapshotCallback: any;

            vi.mocked(onSnapshot).mockImplementation((query, cb) => {
                snapshotCallback = cb;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToExpenseChanges('group1', callback);

            const mockSnapshot = {
                empty: false,
                size: 2,
                docs: [
                    { id: 'change1', data: () => ({ type: 'expense', timestamp: Date.now() }) },
                    { id: 'change2', data: () => ({ type: 'settlement', timestamp: Date.now() }) }
                ],
                docChanges: () => [
                    { 
                        type: 'added',
                        doc: { data: () => ({ type: 'expense' }) }
                    },
                    { 
                        type: 'added',
                        doc: { data: () => ({ type: 'settlement' }) }
                    }
                ]
            };

            snapshotCallback(mockSnapshot);

            expect(callback).toHaveBeenCalledTimes(1); // Called once for the batch
        });
    });

    describe('subscribeToBalanceChanges', () => {
        it('should create a listener for balance changes', () => {
            const callback = vi.fn();
            const unsubscribe = changeDetector.subscribeToBalanceChanges('group1', callback);

            expect(collection).toHaveBeenCalledWith('mock-db', FirestoreCollections.BALANCE_CHANGES);
            expect(where).toHaveBeenCalledWith('groupId', '==', 'group1');
            expect(onSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });
    });

    describe('unsubscribe', () => {
        it('should unsubscribe and stop listener when last callback is removed', () => {
            const callback = vi.fn();
            const unsubscribe = changeDetector.subscribeToGroupChanges('user1', callback);

            // Unsubscribe
            unsubscribe();

            // Firestore unsubscribe should be called
            expect(mockUnsubscribe).toHaveBeenCalled();
        });

        it('should not stop listener if other callbacks exist', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const unsubscribe1 = changeDetector.subscribeToGroupChanges('user1', callback1);
            const unsubscribe2 = changeDetector.subscribeToGroupChanges('user1', callback2);

            // Unsubscribe first callback
            unsubscribe1();

            // Firestore unsubscribe should NOT be called yet
            expect(mockUnsubscribe).not.toHaveBeenCalled();

            // Unsubscribe second callback
            unsubscribe2();

            // Now it should be called
            expect(mockUnsubscribe).toHaveBeenCalled();
        });
    });

    describe('multiple subscriptions', () => {
        it('should handle multiple different subscriptions', () => {
            const groupCallback = vi.fn();
            const expenseCallback = vi.fn();
            const balanceCallback = vi.fn();

            changeDetector.subscribeToGroupChanges('user1', groupCallback);
            changeDetector.subscribeToExpenseChanges('group1', expenseCallback);
            changeDetector.subscribeToBalanceChanges('group1', balanceCallback);

            // Should create 3 different listeners
            expect(onSnapshot).toHaveBeenCalledTimes(3);
        });

        it('should trigger correct callbacks for each subscription type', () => {
            const groupCallback = vi.fn();
            const expenseCallback = vi.fn();
            let groupSnapshotCb: any;
            let expenseSnapshotCb: any;
            let callCount = 0;

            vi.mocked(onSnapshot).mockImplementation((query, cb) => {
                if (callCount === 0) {
                    groupSnapshotCb = cb;
                } else {
                    expenseSnapshotCb = cb;
                }
                callCount++;
                return vi.fn();
            });

            changeDetector.subscribeToGroupChanges('user1', groupCallback);
            changeDetector.subscribeToExpenseChanges('group1', expenseCallback);

            // Trigger group change
            const groupSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change1', data: () => ({}) }],
                docChanges: () => [{ type: 'added', doc: { data: () => ({}) } }]
            };
            groupSnapshotCb(groupSnapshot);

            expect(groupCallback).toHaveBeenCalledTimes(1);
            expect(expenseCallback).not.toHaveBeenCalled();

            // Trigger expense change
            const expenseSnapshot = {
                empty: false,
                size: 1,
                docs: [{ id: 'change2', data: () => ({}) }],
                docChanges: () => [{ type: 'added', doc: { data: () => ({}) } }]
            };
            expenseSnapshotCb(expenseSnapshot);

            expect(groupCallback).toHaveBeenCalledTimes(1); // Still 1
            expect(expenseCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('dispose', () => {
        it('should clean up all listeners', () => {
            const mockUnsubscribe1 = vi.fn();
            const mockUnsubscribe2 = vi.fn();
            const mockUnsubscribe3 = vi.fn();
            let callCount = 0;

            vi.mocked(onSnapshot).mockImplementation(() => {
                callCount++;
                if (callCount === 1) return mockUnsubscribe1;
                if (callCount === 2) return mockUnsubscribe2;
                return mockUnsubscribe3;
            });

            // Create multiple subscriptions
            changeDetector.subscribeToGroupChanges('user1', vi.fn());
            changeDetector.subscribeToExpenseChanges('group1', vi.fn());
            changeDetector.subscribeToBalanceChanges('group1', vi.fn());

            // Dispose all
            changeDetector.dispose();

            expect(mockUnsubscribe1).toHaveBeenCalled();
            expect(mockUnsubscribe2).toHaveBeenCalled();
            expect(mockUnsubscribe3).toHaveBeenCalled();
        });

        it('should clear all callbacks', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            let snapshotCallback: any;

            vi.mocked(onSnapshot).mockImplementation((query, cb) => {
                snapshotCallback = cb;
                return vi.fn();
            });

            changeDetector.subscribeToGroupChanges('user1', callback1);
            changeDetector.subscribeToGroupChanges('user1', callback2);

            // Dispose
            changeDetector.dispose();

            // Try to trigger callbacks after dispose
            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [],
                docChanges: () => [{ type: 'added', doc: { data: () => ({}) } }]
            };

            // This should not cause any callbacks to fire
            if (snapshotCallback) {
                expect(() => snapshotCallback(mockSnapshot)).not.toThrow();
            }
        });
    });

    describe('error handling', () => {
        it('should handle callback errors without affecting other callbacks', () => {
            const errorCallback = vi.fn(() => {
                throw new Error('Callback error');
            });
            const successCallback = vi.fn();
            let snapshotCallback: any;

            vi.mocked(onSnapshot).mockImplementation((query, cb) => {
                snapshotCallback = cb;
                return mockUnsubscribe;
            });

            changeDetector.subscribeToGroupChanges('user1', errorCallback);
            changeDetector.subscribeToGroupChanges('user1', successCallback);

            const mockSnapshot = {
                empty: false,
                size: 1,
                docs: [],
                docChanges: () => [{ type: 'added', doc: { data: () => ({}) } }]
            };

            // Should not throw
            expect(() => snapshotCallback(mockSnapshot)).not.toThrow();

            // Both callbacks should be attempted
            expect(errorCallback).toHaveBeenCalled();
            expect(successCallback).toHaveBeenCalled();
        });
    });
});