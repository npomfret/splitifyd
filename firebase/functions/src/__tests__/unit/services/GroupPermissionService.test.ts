import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupPermissionService } from '../../../services/GroupPermissionService';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';

describe('GroupPermissionService', () => {
    let groupPermissionService: GroupPermissionService;
    let stubFirestoreReader: StubFirestoreReader;
    let stubFirestoreWriter: StubFirestoreWriter;

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        stubFirestoreWriter = new StubFirestoreWriter();
        groupPermissionService = new GroupPermissionService(stubFirestoreReader, stubFirestoreWriter);
    });

    describe('getUserPermissions', () => {
        it('should return user permissions when user is group member', async () => {
            const userId = 'test-user';
            const groupId = 'test-group';

            // Set up group data with stub - much cleaner than mock setup
            const testGroup = new FirestoreGroupBuilder()
                .withId(groupId)
                .withSecurityPreset('open') // Test checks this value
                .build();

            stubFirestoreReader.setDocument('groups', groupId, testGroup);

            // Set up member data
            stubFirestoreReader.setDocument('group-members', `${groupId}_${userId}`, {
                userId,
                groupId,
                memberRole: 'member',
            });

            const result = await groupPermissionService.getUserPermissions(userId, groupId);

            expect(result.userId).toBe(userId);
            expect(result.role).toBe('member');
            expect(result.groupSecurityPreset).toBe('open');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const userId = 'test-user';
            const groupId = 'nonexistent-group';

            // No need to set up anything - stub returns null by default for non-existent documents

            await expect(groupPermissionService.getUserPermissions(userId, groupId)).rejects.toThrow('Group not found');
        });

        it('should throw NOT_MEMBER error when user is not a group member', async () => {
            const userId = 'test-user';
            const groupId = 'test-group';

            // Set up group but no member - much simpler than complex mock setup
            const testGroup = new FirestoreGroupBuilder().withId(groupId).build();
            stubFirestoreReader.setDocument('groups', groupId, testGroup);

            // No member data set up, so getAllGroupMembers will return empty array

            await expect(groupPermissionService.getUserPermissions(userId, groupId)).rejects.toThrow('You are not a member of this group');
        });
    });
});
