import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { SettlementChangeDocumentBuilder } from '../../../utils/change-builders/SettlementChangeDocumentBuilder';
import { ChangeMetadata } from '../../../utils/change-detection';

describe('SettlementChangeDocumentBuilder', () => {
    let builder: SettlementChangeDocumentBuilder;
    let mockTimestamp: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        builder = new SettlementChangeDocumentBuilder();
        mockTimestamp = vi.spyOn(Timestamp, 'now').mockReturnValue({
            seconds: 1234567890,
            nanoseconds: 0,
        } as Timestamp);
    });

    afterEach(() => {
        mockTimestamp.mockRestore();
    });

    describe('getEntityType', () => {
        it('should return "settlement"', () => {
            expect(builder.getEntityType()).toBe('settlement');
        });
    });

    describe('createChangeDocument', () => {
        it('should create a basic settlement change document with groupId', () => {
            const metadata: ChangeMetadata = {
                priority: 'high',
                affectedUsers: ['user1', 'user2'],
                changedFields: ['amount'],
            };

            const additionalData = {
                groupId: 'group123',
            };

            const result = builder.createChangeDocument('settlement456', 'updated', metadata, additionalData);

            expect(result).toEqual({
                settlementId: 'settlement456',
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
                builder.createChangeDocument('settlement789', 'created', metadata);
            }).toThrow('settlement change document must include groupId');
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
                builder.createChangeDocument('settlement101', 'updated', metadata, additionalData);
            }).toThrow('settlement change document must include groupId');
        });

        it('should include additional data beyond groupId', () => {
            const metadata: ChangeMetadata = {
                priority: 'low',
                affectedUsers: ['user1'],
            };

            const additionalData = {
                groupId: 'group456',
                changeUserId: 'user789',
                previousAmount: 50.00,
                paymentMethod: 'bank_transfer',
            };

            const result = builder.createChangeDocument('settlement202', 'updated', metadata, additionalData);

            expect(result).toEqual({
                settlementId: 'settlement202',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'low',
                    affectedUsers: ['user1'],
                },
                groupId: 'group456',
                changeUserId: 'user789',
                previousAmount: 50.00,
                paymentMethod: 'bank_transfer',
            });
        });

        it('should handle all change types', () => {
            const metadata: ChangeMetadata = {
                priority: 'high',
                affectedUsers: ['user1'],
            };

            const additionalData = { groupId: 'group123' };

            const createdResult = builder.createChangeDocument('settlement1', 'created', metadata, additionalData);
            const updatedResult = builder.createChangeDocument('settlement2', 'updated', metadata, additionalData);
            const deletedResult = builder.createChangeDocument('settlement3', 'deleted', metadata, additionalData);

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

            const result = builder.createChangeDocument('settlement303', 'updated', metadata, additionalData);

            expect(result).toEqual({
                settlementId: 'settlement303',
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
        it('should create a minimal settlement change document with groupId', () => {
            const affectedUsers = ['user1', 'user2'];
            const additionalData = {
                groupId: 'group123',
            };

            const result = builder.createMinimalChangeDocument('settlement456', 'updated', affectedUsers, additionalData);

            expect(result).toEqual({
                id: 'settlement456',
                type: 'settlement',
                action: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1', 'user2'],
                groupId: 'group123',
            });
        });

        it('should throw error when groupId is missing', () => {
            const affectedUsers = ['user1'];

            expect(() => {
                builder.createMinimalChangeDocument('settlement789', 'created', affectedUsers);
            }).toThrow('settlement change document must include groupId');
        });

        it('should throw error when groupId is undefined in additionalData', () => {
            const affectedUsers = ['user1'];
            const additionalData = {
                groupId: undefined,
                otherField: 'value',
            };

            expect(() => {
                builder.createMinimalChangeDocument('settlement101', 'updated', affectedUsers, additionalData);
            }).toThrow('settlement change document must include groupId');
        });

        it('should include additional data beyond groupId', () => {
            const affectedUsers = ['user1'];
            const additionalData = {
                groupId: 'group456',
                priority: 'high',
                paymentReference: 'REF-12345',
            };

            const result = builder.createMinimalChangeDocument('settlement202', 'created', affectedUsers, additionalData);

            expect(result).toEqual({
                id: 'settlement202',
                type: 'settlement',
                action: 'created',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1'],
                groupId: 'group456',
                priority: 'high',
                paymentReference: 'REF-12345',
            });
        });

        it('should handle empty additional data with explicit groupId', () => {
            const additionalData = { groupId: 'group789' };

            const result = builder.createMinimalChangeDocument('settlement303', 'deleted', ['user1'], additionalData);

            expect(result).toEqual({
                id: 'settlement303',
                type: 'settlement',
                action: 'deleted',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1'],
                groupId: 'group789',
            });
        });

        it('should require groupId to be specified for settlements', () => {
            expect(() => {
                builder.createMinimalChangeDocument('settlement123', 'updated', ['user1'], {});
            }).toThrow('settlement change document must include groupId');
        });
    });
});