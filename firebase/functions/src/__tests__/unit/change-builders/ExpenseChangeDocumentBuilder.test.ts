import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { ExpenseChangeDocumentBuilder } from '../../../utils/change-builders/ExpenseChangeDocumentBuilder';
import { ChangeMetadata } from '../../../utils/change-detection';

describe('ExpenseChangeDocumentBuilder', () => {
    let builder: ExpenseChangeDocumentBuilder;
    let mockTimestamp: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        builder = new ExpenseChangeDocumentBuilder();
        mockTimestamp = vi.spyOn(Timestamp, 'now').mockReturnValue({
            seconds: 1234567890,
            nanoseconds: 0,
        } as Timestamp);
    });

    afterEach(() => {
        mockTimestamp.mockRestore();
    });

    describe('getEntityType', () => {
        it('should return "expense"', () => {
            expect(builder.getEntityType()).toBe('expense');
        });
    });

    describe('createChangeDocument', () => {
        it('should create a basic expense change document with groupId', () => {
            const metadata: ChangeMetadata = {
                priority: 'high',
                affectedUsers: ['user1', 'user2'],
                changedFields: ['amount'],
            };

            const additionalData = {
                groupId: 'group123',
            };

            const result = builder.createChangeDocument('expense456', 'updated', metadata, additionalData);

            expect(result).toEqual({
                expenseId: 'expense456',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'high',
                    affectedUsers: ['user1', 'user2'],
                    changedFields: ['amount'],
                },
                groupId: 'group123',
            });
        });

        it('should throw error when groupId is missing', () => {
            const metadata: ChangeMetadata = {
                priority: 'high',
                affectedUsers: ['user1'],
            };

            expect(() => {
                builder.createChangeDocument('expense789', 'created', metadata);
            }).toThrow('expense change document must include groupId');
        });

        it('should throw error when groupId is undefined in additionalData', () => {
            const metadata: ChangeMetadata = {
                priority: 'medium',
                affectedUsers: ['user1'],
            };

            const additionalData = {
                groupId: undefined,
                otherField: 'value',
            };

            expect(() => {
                builder.createChangeDocument('expense101', 'updated', metadata, additionalData);
            }).toThrow('expense change document must include groupId');
        });

        it('should include additional data beyond groupId', () => {
            const metadata: ChangeMetadata = {
                priority: 'low',
                affectedUsers: ['user1'],
            };

            const additionalData = {
                groupId: 'group456',
                changeUserId: 'user789',
                previousAmount: 25.50,
                customField: 'customValue',
            };

            const result = builder.createChangeDocument('expense202', 'updated', metadata, additionalData);

            expect(result).toEqual({
                expenseId: 'expense202',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'low',
                    affectedUsers: ['user1'],
                },
                groupId: 'group456',
                changeUserId: 'user789',
                previousAmount: 25.50,
                customField: 'customValue',
            });
        });

        it('should handle all change types', () => {
            const metadata: ChangeMetadata = {
                priority: 'high',
                affectedUsers: ['user1'],
            };

            const additionalData = { groupId: 'group123' };

            const createdResult = builder.createChangeDocument('expense1', 'created', metadata, additionalData);
            const updatedResult = builder.createChangeDocument('expense2', 'updated', metadata, additionalData);
            const deletedResult = builder.createChangeDocument('expense3', 'deleted', metadata, additionalData);

            expect(createdResult.changeType).toBe('created');
            expect(updatedResult.changeType).toBe('updated');
            expect(deletedResult.changeType).toBe('deleted');
        });

        it('should remove undefined fields recursively', () => {
            const metadata: ChangeMetadata = {
                priority: 'medium',
                affectedUsers: ['user1'],
            };

            const additionalData = {
                groupId: 'group123',
                definedField: 'value',
                undefinedField: undefined,
                nestedObject: {
                    defined: 'value',
                    undefined: undefined,
                },
            };

            const result = builder.createChangeDocument('expense303', 'updated', metadata, additionalData);

            expect(result).toEqual({
                expenseId: 'expense303',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'medium',
                    affectedUsers: ['user1'],
                },
                groupId: 'group123',
                definedField: 'value',
                nestedObject: {
                    defined: 'value',
                },
            });
        });
    });

    describe('createMinimalChangeDocument', () => {
        it('should create a minimal expense change document with groupId', () => {
            const affectedUsers = ['user1', 'user2'];
            const additionalData = {
                groupId: 'group123',
            };

            const result = builder.createMinimalChangeDocument('expense456', 'updated', affectedUsers, additionalData);

            expect(result).toEqual({
                id: 'expense456',
                type: 'expense',
                action: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1', 'user2'],
                groupId: 'group123',
            });
        });

        it('should throw error when groupId is missing', () => {
            const affectedUsers = ['user1'];

            expect(() => {
                builder.createMinimalChangeDocument('expense789', 'created', affectedUsers);
            }).toThrow('expense change document must include groupId');
        });

        it('should throw error when groupId is undefined in additionalData', () => {
            const affectedUsers = ['user1'];
            const additionalData = {
                groupId: undefined,
                otherField: 'value',
            };

            expect(() => {
                builder.createMinimalChangeDocument('expense101', 'updated', affectedUsers, additionalData);
            }).toThrow('expense change document must include groupId');
        });

        it('should include additional data beyond groupId', () => {
            const affectedUsers = ['user1'];
            const additionalData = {
                groupId: 'group456',
                priority: 'high',
                customField: 'customValue',
            };

            const result = builder.createMinimalChangeDocument('expense202', 'created', affectedUsers, additionalData);

            expect(result).toEqual({
                id: 'expense202',
                type: 'expense',
                action: 'created',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1'],
                groupId: 'group456',
                priority: 'high',
                customField: 'customValue',
            });
        });

        it('should handle empty additional data with explicit groupId', () => {
            const additionalData = { groupId: 'group789' };

            const result = builder.createMinimalChangeDocument('expense303', 'deleted', ['user1'], additionalData);

            expect(result).toEqual({
                id: 'expense303',
                type: 'expense',
                action: 'deleted',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1'],
                groupId: 'group789',
            });
        });

        it('should require groupId to be specified for expenses', () => {
            expect(() => {
                builder.createMinimalChangeDocument('expense123', 'updated', ['user1'], {});
            }).toThrow('expense change document must include groupId');
        });
    });
});