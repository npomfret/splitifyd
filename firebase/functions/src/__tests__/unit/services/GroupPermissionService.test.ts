import { describe, it, expect, beforeEach } from 'vitest';
import { GroupPermissionService } from '../../../services/GroupPermissionService';
import { MockFirestoreReader } from '../../../services/firestore/MockFirestoreReader';
import type { GroupDocument } from '../../../schemas';

describe('GroupPermissionService', () => {
    let groupPermissionService: GroupPermissionService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        groupPermissionService = new GroupPermissionService(mockFirestoreReader);
    });

    describe('getUserPermissions', () => {
        it('should return user permissions when user is group member', async () => {
            const userId = 'test-user';
            const groupId = 'test-group';
            
            // Mock group exists
            const testGroup: GroupDocument = {
                id: groupId,
                name: 'Test Group',
                createdBy: 'creator-user',
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'owner-and-admin',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'admin-only'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockFirestoreReader.mockGroupExists(groupId, testGroup);

            // Mock member exists in subcollection
            const testMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId,
                groupId,
                role: 'member'
            });
            mockFirestoreReader.mockMemberInSubcollection(groupId, testMember);
            mockFirestoreReader.mockGroupMembersSubcollection(groupId, [testMember]);

            const result = await groupPermissionService.getUserPermissions(userId, groupId);

            expect(result.userId).toBe(userId);
            expect(result.role).toBe('member');
            expect(result.groupSecurityPreset).toBe('open');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getMembersFromSubcollection).toHaveBeenCalledWith(groupId);
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const userId = 'test-user';
            const groupId = 'nonexistent-group';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                groupPermissionService.getUserPermissions(userId, groupId)
            ).rejects.toThrow('Group not found');

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
        });

        it('should throw NOT_MEMBER error when user is not a group member', async () => {
            const userId = 'test-user';
            const groupId = 'test-group';

            // Mock group exists
            const testGroup: GroupDocument = {
                id: groupId,
                name: 'Test Group',
                createdBy: 'creator-user',
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'owner-and-admin',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'admin-only'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockFirestoreReader.mockGroupExists(groupId, testGroup);

            // Mock empty member list (user is not a member)
            mockFirestoreReader.mockGroupMembersSubcollection(groupId, []);

            await expect(
                groupPermissionService.getUserPermissions(userId, groupId)
            ).rejects.toThrow('You are not a member of this group');

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getMembersFromSubcollection).toHaveBeenCalledWith(groupId);
        });
    });
});