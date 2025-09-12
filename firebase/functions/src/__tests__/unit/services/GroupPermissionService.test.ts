import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupPermissionService } from '../../../services/GroupPermissionService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import type { IFirestoreWriter } from '../../../services/firestore';

describe('GroupPermissionService', () => {
    let groupPermissionService: GroupPermissionService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: IFirestoreWriter;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = {
            runTransaction: vi.fn(),
            updateInTransaction: vi.fn(),
        } as any;
        groupPermissionService = new GroupPermissionService(mockFirestoreReader, mockFirestoreWriter);
    });

    describe('getUserPermissions', () => {
        it('should return user permissions when user is group member', async () => {
            const userId = 'test-user';
            const groupId = 'test-group';

            // Mock group exists
            const testGroup = new FirestoreGroupBuilder()
                .withId(groupId)
                .withSecurityPreset('open') // Test checks this value
                .build();

            mockFirestoreReader.mockGroupExists(groupId, testGroup);

            // Mock member exists in subcollection
            const testMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId,
                groupId,
                memberRole: 'member',
            });
            mockFirestoreReader.mockMemberInSubcollection(groupId, testMember);
            mockFirestoreReader.mockGroupMembersSubcollection(groupId, [testMember]);

            const result = await groupPermissionService.getUserPermissions(userId, groupId);

            expect(result.userId).toBe(userId);
            expect(result.role).toBe('member');
            expect(result.groupSecurityPreset).toBe('open');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getAllGroupMembers).toHaveBeenCalledWith(groupId);
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const userId = 'test-user';
            const groupId = 'nonexistent-group';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(groupPermissionService.getUserPermissions(userId, groupId)).rejects.toThrow('Group not found');

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
        });

        it('should throw NOT_MEMBER error when user is not a group member', async () => {
            const userId = 'test-user';
            const groupId = 'test-group';

            // Mock group exists
            const testGroup = new FirestoreGroupBuilder().withId(groupId).build();

            mockFirestoreReader.mockGroupExists(groupId, testGroup);

            // Mock empty member list (user is not a member)
            mockFirestoreReader.mockGroupMembersSubcollection(groupId, []);

            await expect(groupPermissionService.getUserPermissions(userId, groupId)).rejects.toThrow('You are not a member of this group');

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getAllGroupMembers).toHaveBeenCalledWith(groupId);
        });
    });
});
