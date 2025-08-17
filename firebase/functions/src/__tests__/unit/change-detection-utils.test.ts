import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import * as admin from 'firebase-admin/firestore';
import {
    ChangeDebouncer,
    getChangedFields,
    getGroupChangedFields,
    calculatePriority,
    createChangeDocument,
    shouldNotifyUser,
} from '../../utils/change-detection';/comm

describe('Change Detection Utilities', () => {
    describe('ChangeDebouncer', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            ChangeDebouncer.clearAll();
        });

        afterEach(() => {
            jest.useRealTimers();
            ChangeDebouncer.clearAll();
        });

        it('should debounce multiple calls with the same key', async () => {
            const callback = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
            
            ChangeDebouncer.debounce('test-key', callback, 500);
            ChangeDebouncer.debounce('test-key', callback, 500);
            ChangeDebouncer.debounce('test-key', callback, 500);
            
            expect(callback).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(500);
            await Promise.resolve(); // Let microtasks run
            
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle different keys independently', async () => {
            const callback1 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
            const callback2 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
            
            ChangeDebouncer.debounce('key1', callback1, 200);
            ChangeDebouncer.debounce('key2', callback2, 300);
            
            jest.advanceTimersByTime(200);
            await Promise.resolve();
            
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should handle callback errors gracefully', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const callback = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Test error'));
            
            ChangeDebouncer.debounce('error-key', callback, 100);
            
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            
            expect(callback).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in debounced callback for error-key:',
                expect.any(Error)
            );
            
            consoleErrorSpy.mockRestore();
        });

        it('should clear pending timeouts', () => {
            const callback = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
            
            ChangeDebouncer.debounce('clear-key', callback, 500);
            ChangeDebouncer.clearPending('clear-key');
            
            jest.advanceTimersByTime(500);
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should clear all pending timeouts', () => {
            const callback1 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
            const callback2 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
            
            ChangeDebouncer.debounce('key1', callback1, 500);
            ChangeDebouncer.debounce('key2', callback2, 500);
            ChangeDebouncer.clearAll();
            
            jest.advanceTimersByTime(500);
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    describe('getChangedFields', () => {
        it('should return ["*"] for new document', () => {
            const before = undefined;
            const after = {
                exists: true,
                data: () => ({ field1: 'value1', field2: 'value2' }),
            } as unknown as admin.DocumentSnapshot;
            
            const result = getChangedFields(before, after);
            expect(result).toEqual(['*']);
        });

        it('should return ["*"] for deleted document', () => {
            const before = {
                exists: true,
                data: () => ({ field1: 'value1' }),
            } as unknown as admin.DocumentSnapshot;
            const after = {
                exists: false,
                data: () => undefined,
            } as unknown as admin.DocumentSnapshot;
            
            const result = getChangedFields(before, after);
            expect(result).toEqual(['*']);
        });

        it('should detect changed fields', () => {
            const before = {
                exists: true,
                data: () => ({ 
                    field1: 'value1', 
                    field2: 'value2',
                    field3: { nested: 'old' }
                }),
            } as unknown as admin.DocumentSnapshot;
            const after = {
                exists: true,
                data: () => ({ 
                    field1: 'changed', 
                    field2: 'value2',
                    field3: { nested: 'new' }
                }),
            } as unknown as admin.DocumentSnapshot;
            
            const result = getChangedFields(before, after);
            expect(result).toContain('field1');
            expect(result).toContain('field3');
            expect(result).not.toContain('field2');
        });

        it('should detect deleted fields', () => {
            const before = {
                exists: true,
                data: () => ({ field1: 'value1', field2: 'value2' }),
            } as unknown as admin.DocumentSnapshot;
            const after = {
                exists: true,
                data: () => ({ field1: 'value1' }),
            } as unknown as admin.DocumentSnapshot;
            
            const result = getChangedFields(before, after);
            expect(result).toContain('field2');
            expect(result).not.toContain('field1');
        });

        it('should detect added fields', () => {
            const before = {
                exists: true,
                data: () => ({ field1: 'value1' }),
            } as unknown as admin.DocumentSnapshot;
            const after = {
                exists: true,
                data: () => ({ field1: 'value1', field2: 'value2' }),
            } as unknown as admin.DocumentSnapshot;
            
            const result = getChangedFields(before, after);
            expect(result).toContain('field2');
            expect(result).not.toContain('field1');
        });
    });

    describe('getGroupChangedFields', () => {
        it('should handle nested group structure', () => {
            const before = {
                exists: true,
                data: () => ({ 
                    data: {
                        name: 'Old Name',
                        description: 'Same'
                    }
                }),
            } as unknown as admin.DocumentSnapshot;
            const after = {
                exists: true,
                data: () => ({ 
                    data: {
                        name: 'New Name',
                        description: 'Same'
                    }
                }),
            } as unknown as admin.DocumentSnapshot;
            
            const result = getGroupChangedFields(before, after);
            expect(result).toContain('name');
            expect(result).not.toContain('description');
        });

        it('should return ["*"] for new group', () => {
            const before = undefined;
            const after = {
                exists: true,
                data: () => ({ data: { name: 'Group' } }),
            } as unknown as admin.DocumentSnapshot;
            
            const result = getGroupChangedFields(before, after);
            expect(result).toEqual(['*']);
        });
    });

    describe('calculatePriority', () => {
        describe('group priority', () => {
            it('should return high priority for created/deleted', () => {
                expect(calculatePriority('created', [], 'group')).toBe('high');
                expect(calculatePriority('deleted', [], 'group')).toBe('high');
            });

            it('should return high priority for critical field changes', () => {
                expect(calculatePriority('updated', ['memberIds'], 'group')).toBe('high');
                expect(calculatePriority('updated', ['name'], 'group')).toBe('high');
                expect(calculatePriority('updated', ['deletedAt'], 'group')).toBe('high');
            });

            it('should return medium priority for important field changes', () => {
                expect(calculatePriority('updated', ['description'], 'group')).toBe('medium');
            });

            it('should return low priority for other changes', () => {
                expect(calculatePriority('updated', ['lastViewed'], 'group')).toBe('low');
                expect(calculatePriority('updated', ['analytics'], 'group')).toBe('low');
            });

            it('should return high priority if any critical field changed', () => {
                expect(calculatePriority('updated', ['lastViewed', 'memberIds'], 'group')).toBe('high');
            });
        });

        describe('expense priority', () => {
            it('should return high priority for amount changes', () => {
                expect(calculatePriority('updated', ['amount'], 'expense')).toBe('high');
                expect(calculatePriority('updated', ['currency'], 'expense')).toBe('high');
                expect(calculatePriority('updated', ['paidBy'], 'expense')).toBe('high');
                expect(calculatePriority('updated', ['splits'], 'expense')).toBe('high');
            });

            it('should return medium priority for description changes', () => {
                expect(calculatePriority('updated', ['description'], 'expense')).toBe('medium');
                expect(calculatePriority('updated', ['category'], 'expense')).toBe('medium');
                expect(calculatePriority('updated', ['date'], 'expense')).toBe('medium');
            });
        });

        describe('settlement priority', () => {
            it('should return high priority for amount changes', () => {
                expect(calculatePriority('updated', ['amount'], 'settlement')).toBe('high');
                expect(calculatePriority('updated', ['payerId'], 'settlement')).toBe('high');
                expect(calculatePriority('updated', ['from'], 'settlement')).toBe('high');
            });

            it('should return medium priority for note changes', () => {
                expect(calculatePriority('updated', ['note'], 'settlement')).toBe('medium');
                expect(calculatePriority('updated', ['date'], 'settlement')).toBe('medium');
            });
        });
    });

    describe('shouldNotifyUser', () => {
        it('should always notify for high priority changes', () => {
            expect(shouldNotifyUser('user1', 'user2', ['field'], 'high')).toBe(true);
            expect(shouldNotifyUser('user1', 'user1', ['field'], 'high')).toBe(true);
        });

        it('should notify medium priority only if change by different user', () => {
            expect(shouldNotifyUser('user1', 'user2', ['field'], 'medium')).toBe(true);
            expect(shouldNotifyUser('user1', 'user1', ['field'], 'medium')).toBe(false);
        });

        it('should handle low priority with notifiable fields', () => {
            expect(shouldNotifyUser('user1', 'user2', ['name'], 'low')).toBe(true);
            expect(shouldNotifyUser('user1', 'user1', ['name'], 'low')).toBe(false);
        });

        it('should not notify for non-notifiable fields', () => {
            expect(shouldNotifyUser('user1', 'user2', ['lastViewed'], 'low')).toBe(false);
            expect(shouldNotifyUser('user1', 'user2', ['analytics', 'metadata'], 'low')).toBe(false);
        });

        it('should notify if at least one field is notifiable', () => {
            expect(shouldNotifyUser('user1', 'user2', ['lastViewed', 'name'], 'low')).toBe(true);
        });
    });

    describe('createChangeDocument', () => {
        let mockTimestamp: ReturnType<typeof jest.spyOn>;

        beforeEach(() => {
            mockTimestamp = jest.spyOn(admin.Timestamp, 'now').mockReturnValue({
                seconds: 1234567890,
                nanoseconds: 0,
            } as admin.Timestamp);
        });

        afterEach(() => {
            mockTimestamp.mockRestore();
        });

        it('should create a basic change document', () => {
            const result = createChangeDocument(
                'entity123',
                'group',
                'updated',
                {
                    priority: 'high',
                    affectedUsers: ['user1', 'user2'],
                    changedFields: ['name']
                }
            );
            
            expect(result).toEqual({
                groupId: 'entity123',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'high',
                    affectedUsers: ['user1', 'user2'],
                    changedFields: ['name']
                }
            });
        });

        it('should include additional data', () => {
            const result = createChangeDocument(
                'expense123',
                'expense',
                'created',
                {
                    priority: 'medium',
                    affectedUsers: ['user1'],
                },
                {
                    groupId: 'group456',
                    changeUserId: 'user789'
                }
            );
            
            expect(result).toEqual({
                expenseId: 'expense123',
                changeType: 'created',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'medium',
                    affectedUsers: ['user1'],
                },
                groupId: 'group456',
                changeUserId: 'user789'
            });
        });

        it('should throw error for expense without groupId', () => {
            expect(() => {
                createChangeDocument(
                    'expense123',
                    'expense',
                    'created',
                    {
                        priority: 'high',
                        affectedUsers: [],
                    }
                );
            }).toThrow('expense change document must include groupId');
        });

        it('should throw error for settlement without groupId', () => {
            expect(() => {
                createChangeDocument(
                    'settlement123',
                    'settlement',
                    'created',
                    {
                        priority: 'high',
                        affectedUsers: [],
                    }
                );
            }).toThrow('settlement change document must include groupId');
        });
    });
});