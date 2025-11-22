/**
 * Archive Groups Feature Unit Tests
 *
 * Tests for:
 * - listGroups status filtering
 * - GroupMemberService archive/unarchive methods
 */

import { MemberStatuses, toGroupId, toUserId } from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from './AppDriver';

describe('Archive Groups - Status Filtering', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    test('should filter by ACTIVE status by default', async () => {
        // Arrange
        const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
        const userId = user.user.uid;

        // Create three groups (all will be active by default)
        const group1 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId1 = toGroupId(group1.id);

        const group2 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId2 = toGroupId(group2.id);

        const group3 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId3 = toGroupId(group3.id);

        // Archive group2 and leave group3 as pending (by not accepting invitation - but since user creates, it's auto-active)
        // So we archive group2
        await appDriver.archiveGroupForUser(groupId2, userId);

        // Act - Default: should only return ACTIVE groups
        const result = await appDriver.listGroups({}, userId);

        // Assert
        expect(result.groups).toHaveLength(2);
        const groupIds = result.groups.map((g) => g.id);
        expect(groupIds).toContain(groupId1);
        expect(groupIds).toContain(groupId3);
        expect(groupIds).not.toContain(groupId2);
    });

    test('should filter by ARCHIVED status when specified', async () => {
        // Arrange
        const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
        const userId = user.user.uid;

        // Create two groups
        const group1 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId1 = toGroupId(group1.id);

        const group2 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId2 = toGroupId(group2.id);

        // Archive group2
        await appDriver.archiveGroupForUser(groupId2, userId);

        // Act - Filter by ARCHIVED
        const result = await appDriver.listGroups(
            {
                statusFilter: MemberStatuses.ARCHIVED,
            },
            userId
        );

        // Assert
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].id).toBe(groupId2);
    });

    test('should filter by array of statuses', async () => {
        // Arrange
        const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
        const userId = user.user.uid;

        // Create three groups
        const group1 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId1 = toGroupId(group1.id);

        const group2 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId2 = toGroupId(group2.id);

        const group3 = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const groupId3 = toGroupId(group3.id);

        // Archive group2
        await appDriver.archiveGroupForUser(groupId2, userId);

        // Act - Filter by ACTIVE status (group1 and group3 should be returned)
        const result = await appDriver.listGroups(
            {
                statusFilter: [MemberStatuses.ACTIVE],
            },
            userId
        );

        // Assert
        expect(result.groups).toHaveLength(2);
        const groupIds = result.groups.map((g) => g.id);
        expect(groupIds).toContain(groupId1);
        expect(groupIds).toContain(groupId3);
        expect(groupIds).not.toContain(groupId2);
    });
});

describe('Archive Groups - Archive/Unarchive Operations', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('archiveGroupForUser', () => {
        test('should archive an active group membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act - Archive the membership
            const result = await appDriver.archiveGroupForUser(groupId, userId);

            // Assert
            expect(result.message).toBe('Group archived successfully');

            // Verify via listGroups that the group is now archived
            const archivedGroups = await appDriver.listGroups({ statusFilter: MemberStatuses.ARCHIVED }, userId);
            expect(archivedGroups.groups).toHaveLength(1);
            expect(archivedGroups.groups[0].id).toBe(groupId);
        });

        test('should reject archiving non-existent membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;
            const groupId = toGroupId('nonexistent');

            // Act & Assert
            await expect(appDriver.archiveGroupForUser(groupId, userId)).rejects.toThrow('Group membership');
        });

        test('should reject archiving already archived membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Archive the group first
            await appDriver.archiveGroupForUser(groupId, userId);

            // Act & Assert - Try to archive again
            await expect(appDriver.archiveGroupForUser(groupId, userId)).rejects.toThrow();
        });
    });

    describe('unarchiveGroupForUser', () => {
        test('should unarchive an archived group membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Archive the group first
            await appDriver.archiveGroupForUser(groupId, userId);

            // Act - Unarchive the membership
            const result = await appDriver.unarchiveGroupForUser(groupId, userId);

            // Assert
            expect(result.message).toBe('Group unarchived successfully');

            // Verify via listGroups that the group is now active
            const activeGroups = await appDriver.listGroups({}, userId);
            expect(activeGroups.groups).toHaveLength(1);
            expect(activeGroups.groups[0].id).toBe(groupId);
        });

        test('should reject unarchiving non-existent membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;
            const groupId = toGroupId('nonexistent');

            // Act & Assert
            await expect(appDriver.unarchiveGroupForUser(groupId, userId)).rejects.toThrow('Group membership');
        });

        test('should reject unarchiving non-archived membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act & Assert - Try to unarchive an active membership
            await expect(appDriver.unarchiveGroupForUser(groupId, userId)).rejects.toThrow();
        });
    });

    describe('archive/unarchive round-trip', () => {
        test('should support archiving and unarchiving the same membership', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act & Assert - Archive
            await appDriver.archiveGroupForUser(groupId, userId);
            let archivedGroups = await appDriver.listGroups({ statusFilter: MemberStatuses.ARCHIVED }, userId);
            expect(archivedGroups.groups).toHaveLength(1);
            expect(archivedGroups.groups[0].id).toBe(groupId);

            // Act & Assert - Unarchive
            await appDriver.unarchiveGroupForUser(groupId, userId);
            let activeGroups = await appDriver.listGroups({}, userId);
            expect(activeGroups.groups).toHaveLength(1);
            expect(activeGroups.groups[0].id).toBe(groupId);

            // Act & Assert - Archive again
            await appDriver.archiveGroupForUser(groupId, userId);
            archivedGroups = await appDriver.listGroups({ statusFilter: MemberStatuses.ARCHIVED }, userId);
            expect(archivedGroups.groups).toHaveLength(1);
            expect(archivedGroups.groups[0].id).toBe(groupId);
        });
    });
});
