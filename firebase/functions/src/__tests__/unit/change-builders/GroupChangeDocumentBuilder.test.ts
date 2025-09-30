import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { GroupChangeDocumentBuilder } from '../../../utils/change-builders';
import { ChangeMetadata } from '../../../utils/change-detection';
import { ChangeMetadataBuilder } from '@splitifyd/test-support';

describe('GroupChangeDocumentBuilder', () => {
    let builder: GroupChangeDocumentBuilder;
    let mockTimestamp: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        builder = new GroupChangeDocumentBuilder();
        mockTimestamp = vi.spyOn(Timestamp, 'now').mockReturnValue({
            seconds: 1234567890,
            nanoseconds: 0,
        } as Timestamp);
    });

    afterEach(() => {
        mockTimestamp.mockRestore();
    });

    describe('getEntityType', () => {
        it('should return "group"', () => {
            expect(builder.getEntityType()).toBe('group');
        });
    });

    describe('createChangeDocument', () => {
        it('should create a basic group change document', () => {
            const metadata = new ChangeMetadataBuilder()
                .asHighPriority()
                .withAffectedUsers(['user1', 'user2'])
                .withChangedFields(['name'])
                .build();

            const result = builder.createChangeDocument('group123', 'updated', metadata);

            expect(result).toEqual({
                groupId: 'group123',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'high',
                    affectedUsers: ['user1', 'user2'],
                    changedFields: ['name'],
                },
            });
        });

        it('should include additional data when provided', () => {
            const metadata = new ChangeMetadataBuilder()
                .asMediumPriority()
                .withAffectedUsers(['user1'])
                .withoutChangedFields()
                .build();

            const additionalData = {
                changeUserId: 'user789',
                customField: 'customValue',
            };

            const result = builder.createChangeDocument('group456', 'created', metadata, additionalData);

            expect(result).toEqual({
                groupId: 'group456',
                changeType: 'created',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'medium',
                    affectedUsers: ['user1'],
                },
                changeUserId: 'user789',
                customField: 'customValue',
            });
        });

        it('should remove undefined fields recursively', () => {
            const metadata = new ChangeMetadataBuilder()
                .asLowPriority()
                .withAffectedUsers(['user1'])
                .withoutChangedFields()
                .build();

            const additionalData = {
                definedField: 'value',
                undefinedField: undefined,
                nestedObject: {
                    defined: 'value',
                    undefined: undefined,
                },
                arrayWithUndefined: ['value1', undefined, 'value3'],
            };

            const result = builder.createChangeDocument('group789', 'updated', metadata, additionalData);

            expect(result).toEqual({
                groupId: 'group789',
                changeType: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                metadata: {
                    priority: 'low',
                    affectedUsers: ['user1'],
                },
                definedField: 'value',
                nestedObject: {
                    defined: 'value',
                },
                arrayWithUndefined: ['value1', null, 'value3'],
            });
        });

        it('should handle all change types', () => {
            const metadata = new ChangeMetadataBuilder()
                .asHighPriority()
                .withAffectedUsers(['user1'])
                .withoutChangedFields()
                .build();

            const createdResult = builder.createChangeDocument('group1', 'created', metadata);
            const updatedResult = builder.createChangeDocument('group2', 'updated', metadata);
            const deletedResult = builder.createChangeDocument('group3', 'deleted', metadata);

            expect(createdResult.changeType).toBe('created');
            expect(updatedResult.changeType).toBe('updated');
            expect(deletedResult.changeType).toBe('deleted');
        });
    });

    describe('createMinimalChangeDocument', () => {
        it('should create a minimal group change document', () => {
            const affectedUsers = ['user1', 'user2', 'user3'];

            const result = builder.createMinimalChangeDocument('group123', 'updated', affectedUsers);

            expect(result).toEqual({
                id: 'group123',
                type: 'group',
                action: 'updated',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1', 'user2', 'user3'],
            });
        });

        it('should include additional data when provided', () => {
            const affectedUsers = ['user1'];
            const additionalData = {
                customField: 'customValue',
                priority: 'high',
            };

            const result = builder.createMinimalChangeDocument('group456', 'created', affectedUsers, additionalData);

            expect(result).toEqual({
                id: 'group456',
                type: 'group',
                action: 'created',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1'],
                customField: 'customValue',
                priority: 'high',
            });
        });

        it('should handle empty additional data', () => {
            const result = builder.createMinimalChangeDocument('group789', 'deleted', ['user1'], {});

            expect(result).toEqual({
                id: 'group789',
                type: 'group',
                action: 'deleted',
                timestamp: { seconds: 1234567890, nanoseconds: 0 },
                users: ['user1'],
            });
        });

        it('should not require groupId for groups', () => {
            const result = builder.createMinimalChangeDocument('group123', 'updated', ['user1']);

            expect(result).not.toHaveProperty('groupId');
            expect(result.id).toBe('group123');
            expect(result.type).toBe('group');
        });
    });
});
