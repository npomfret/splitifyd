import { ActivityFeedEventTypes, calculateEqualSplits, MemberRoles, MemberStatuses, toAmount, toGroupName, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, GroupUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('groups', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let user3: UserId;
    let adminUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users, admin } = await appDriver.createTestUsers({
            count: 3,
            includeAdmin: true,
        });
        [user1, user2, user3] = users;
        adminUser = admin!;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    it('should generate different share links on consecutive calls', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
        const groupId = group.id;

        // Generate first share link
        const { shareablePath: path1, shareToken: shareToken1, expiresAt: expiresAt1 } = await appDriver.generateShareableLink(groupId, undefined, user1);
        expect(path1).toBe(`/join?shareToken=${shareToken1}`);
        expect(shareToken1).toHaveLength(16);
        expect(expiresAt1).toBeTruthy();

        // Generate second share link (simulating "Generate New" button)
        const { shareablePath: path2, shareToken: shareToken2, expiresAt: expiresAt2 } = await appDriver.generateShareableLink(groupId, undefined, user1);
        expect(path2).toBe(`/join?shareToken=${shareToken2}`);
        expect(shareToken2).toHaveLength(16);
        expect(expiresAt2).toBeTruthy();

        // Verify links are different
        expect(shareToken2).not.toBe(shareToken1);
        expect(path2).not.toBe(path1);

        // Verify both links are valid and functional by joining with them
        await appDriver.joinGroupByLink(shareToken1, undefined, user2);
        await appDriver.joinGroupByLink(shareToken2, undefined, user3);

        // Verify both users successfully joined by checking group listing
        const { groups: groupsUser2 } = await appDriver.listGroups({}, user2);
        const { groups: groupsUser3 } = await appDriver.listGroups({}, user3);

        expect(groupsUser2.find((g) => g.id === groupId)).toBeTruthy();
        expect(groupsUser3.find((g) => g.id === groupId)).toBeTruthy();
    });

    it('should allow sharing a group and list membership balances for all users', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;

        const { shareablePath, shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        expect(shareablePath).toBe(`/join?shareToken=${shareToken}`);
        expect(shareToken).toHaveLength(16);

        await appDriver.joinGroupByLink(shareToken, undefined, user2);
        await appDriver.joinGroupByLink(shareToken, undefined, user3);

        const participants = [user1, user2, user3];
        const usdSplits = calculateEqualSplits(toAmount(90), USD, participants);
        await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Beach house deposit')
                .withAmount(90, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(usdSplits)
                .build(),
            user1,
        );

        const listResponseUser1 = await appDriver.listGroups({}, user1);
        expect(listResponseUser1.count).toBe(1);
        expect(listResponseUser1.hasMore).toBe(false);
        expect(listResponseUser1.pagination.limit).toBeGreaterThan(0);

        const summaryForUser1 = listResponseUser1.groups.find((item) => item.id === groupId);
        expect(summaryForUser1).toBeDefined();
        expect(summaryForUser1!.balance?.balancesByCurrency?.[USD]?.netBalance).toBe('60.00');
        expect(summaryForUser1!.balance?.balancesByCurrency?.[USD]?.totalOwed).toBe('60.00');
        expect(summaryForUser1!.balance?.balancesByCurrency?.[USD]?.totalOwing).toBe('0.00');

        const listResponseUser2 = await appDriver.listGroups({}, user2);
        expect(listResponseUser2.count).toBe(1);
        expect(listResponseUser2.hasMore).toBe(false);

        const summaryForUser2 = listResponseUser2.groups.find((item) => item.id === groupId);
        expect(summaryForUser2).toBeDefined();
        expect(summaryForUser2!.balance?.balancesByCurrency?.[USD]?.netBalance).toBe('-30.00');
        expect(summaryForUser2!.balance?.balancesByCurrency?.[USD]?.totalOwed).toBe('0.00');
        expect(summaryForUser2!.balance?.balancesByCurrency?.[USD]?.totalOwing).toBe('30.00');

        const listResponseUser3 = await appDriver.listGroups({}, user3);
        expect(listResponseUser3.count).toBe(1);
        expect(listResponseUser3.hasMore).toBe(false);

        const summaryForUser3 = listResponseUser3.groups.find((item) => item.id === groupId);
        expect(summaryForUser3).toBeDefined();
        expect(summaryForUser3!.balance?.balancesByCurrency?.[USD]?.netBalance).toBe('-30.00');
        expect(summaryForUser3!.balance?.balancesByCurrency?.[USD]?.totalOwed).toBe('0.00');
        expect(summaryForUser3!.balance?.balancesByCurrency?.[USD]?.totalOwing).toBe('30.00');
    });

    it('should allow members to leave and rejoin via share link', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        let preview = await appDriver.previewGroupByLink(shareToken, user2);
        expect(preview.isAlreadyMember).toBe(true);
        expect(preview.memberCount).toBe(2);

        await appDriver.leaveGroup(groupId, user2);

        preview = await appDriver.previewGroupByLink(shareToken, user2);
        expect(preview.isAlreadyMember).toBe(false);
        expect(preview.memberCount).toBe(1);

        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const user2Groups = await appDriver.listGroups({}, user2);
        expect(user2Groups.count).toBe(1);
        expect(user2Groups.groups[0].id).toBe(groupId);
    });

    it('should respect custom share link expiration timestamps', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Custom Expiry Group').build(), user1);
        const groupId = group.id;

        const customExpiration = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        const shareLink = await appDriver.generateShareableLink(groupId, customExpiration, user1);

        expect(shareLink.expiresAt).toBe(customExpiration);

        const preview = await appDriver.previewGroupByLink(shareLink.shareToken, user2);
        expect(preview.groupId).toBe(groupId);
        expect(preview.isAlreadyMember).toBe(false);

        const joinResult = await appDriver.joinGroupByLink(shareLink.shareToken, undefined, user2);
        expect(joinResult.memberStatus).toBe('active');

        const members = (await appDriver.getGroupFullDetails(groupId, {}, user1)).members.members;
        expect(members.some(({ uid }) => uid === user2)).toBe(true);
    });

    it('should reject preview and join operations once a share link has expired', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Expiring Group').build(), user1);
        const groupId = group.id;

        const nearFutureExpiration = new Date(Date.now() + 1000).toISOString();
        const { shareToken } = await appDriver.generateShareableLink(groupId, nearFutureExpiration, user1);

        await new Promise((resolve) => setTimeout(resolve, 1200));

        await expect(appDriver.previewGroupByLink(shareToken, user2)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
        await expect(appDriver.joinGroupByLink(shareToken, undefined, user2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should let members update their own group display name', async () => {
        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Design Team')
                .build(),
            user1,
        );

        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        await appDriver.updateGroupMemberDisplayName(groupId, 'UI Specialist', user2);

        const detailsForOwner = await appDriver.getGroupFullDetails(groupId, {}, user1);
        const updatedMember = detailsForOwner.members.members.find((member) => member.uid === user2);
        expect(updatedMember?.groupDisplayName).toBe('UI Specialist');

        const detailsForMember = await appDriver.getGroupFullDetails(groupId, {}, user2);
        expect(detailsForMember.group.name).toBe('Design Team');
        const selfViewMember = detailsForMember.members.members.find((member) => member.uid === user2);
        expect(selfViewMember?.groupDisplayName).toBe('UI Specialist');
    });

    it('should handle group previews, updates, member management, and deletion', async () => {
        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Adventure Squad')
                .build(),
            user1,
        );

        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);

        const previewBeforeJoin = await appDriver.previewGroupByLink(shareToken, user2);
        expect(previewBeforeJoin.groupId).toBe(groupId);
        expect(previewBeforeJoin.groupName).toBe('Adventure Squad');
        expect(previewBeforeJoin.memberCount).toBe(1);
        expect(previewBeforeJoin.isAlreadyMember).toBe(false);

        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const previewAfterJoin = await appDriver.previewGroupByLink(shareToken, user2);
        expect(previewAfterJoin.isAlreadyMember).toBe(true);
        expect(previewAfterJoin.memberCount).toBe(2);

        await appDriver.updateGroup(groupId, new GroupUpdateBuilder().withName(toGroupName('Adventure Squad+')).withDescription('Updated itinerary for the squad').build(), user1);
        await appDriver.updateGroupMemberDisplayName(groupId, 'Squad Leader', user1);

        await appDriver.joinGroupByLink(shareToken, undefined, user3);
        await appDriver.removeGroupMember(groupId, user3, user1);

        await appDriver.leaveGroup(groupId, user2);

        const updatedGroupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
        expect(updatedGroupDetails.group.name).toBe('Adventure Squad+');
        expect(updatedGroupDetails.group.description).toBe('Updated itinerary for the squad');
        expect(updatedGroupDetails.members.members).toHaveLength(1);
        expect(updatedGroupDetails.members.members[0].uid).toBe(user1);
        expect(updatedGroupDetails.members.members[0].groupDisplayName).toBe('Squad Leader');

        const user1Groups = await appDriver.listGroups({}, user1);
        const updatedSummary = user1Groups.groups.find((item) => item.id === groupId);
        expect(updatedSummary?.name).toBe('Adventure Squad+');

        const user2Groups = await appDriver.listGroups({}, user2);
        expect(user2Groups.count).toBe(0);

        await appDriver.deleteGroup(groupId, user1);

        const user1GroupsAfterDelete = await appDriver.listGroups({}, user1);
        expect(user1GroupsAfterDelete.count).toBe(0);
    });

    describe('archive group functionality', () => {
        it('should archive and unarchive a group membership', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Verify user2 can see the group initially
            let groups = await appDriver.listGroups({}, user2);
            expect(groups.groups).toHaveLength(1);
            expect(groups.groups[0].id).toBe(groupId);

            // Archive the group
            await appDriver.archiveGroupForUser(groupId, user2);

            // Verify group no longer appears in default list
            groups = await appDriver.listGroups({}, user2);
            expect(groups.groups).toHaveLength(0);

            // Archived filter should return the group
            const archivedGroups = await appDriver.listGroups({ statusFilter: 'archived' }, user2);
            expect(archivedGroups.groups).toHaveLength(1);
            expect(archivedGroups.groups[0].id).toBe(groupId);

            // Unarchive the group
            await appDriver.unarchiveGroupForUser(groupId, user2);

            // Verify group appears again
            groups = await appDriver.listGroups({}, user2);
            expect(groups.groups).toHaveLength(1);
            expect(groups.groups[0].id).toBe(groupId);

            const archivedGroupsAfterUnarchive = await appDriver.listGroups({ statusFilter: 'archived' }, user2);
            expect(archivedGroupsAfterUnarchive.groups).toHaveLength(0);
        });

        it('should reject archiving a non-existent membership', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            // user2 is not a member
            await expect(appDriver.archiveGroupForUser(groupId, user2))
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject archiving a non-active membership', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Archive first time
            await appDriver.archiveGroupForUser(groupId, user2);

            // Try to archive again - should fail
            await expect(appDriver.archiveGroupForUser(groupId, user2))
                .rejects
                .toMatchObject({ code: 'INVALID_REQUEST' });
        });

        it('should reject unarchiving a non-archived membership', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Try to unarchive an active membership
            await expect(appDriver.unarchiveGroupForUser(groupId, user2))
                .rejects
                .toMatchObject({ code: 'INVALID_REQUEST' });
        });

        it('should allow multiple archive/unarchive cycles', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Archive
            await appDriver.archiveGroupForUser(groupId, user2);
            let groups = await appDriver.listGroups({}, user2);
            expect(groups.groups).toHaveLength(0);

            // Unarchive
            await appDriver.unarchiveGroupForUser(groupId, user2);
            groups = await appDriver.listGroups({}, user2);
            expect(groups.groups).toHaveLength(1);

            // Archive again
            await appDriver.archiveGroupForUser(groupId, user2);
            groups = await appDriver.listGroups({}, user2);
            expect(groups.groups).toHaveLength(0);
        });

        it('should keep archived group accessible to other members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // user2 archives the group
            await appDriver.archiveGroupForUser(groupId, user2);

            // user1 and user3 should still see the group
            const user1Groups = await appDriver.listGroups({}, user1);
            expect(user1Groups.groups).toHaveLength(1);

            const user3Groups = await appDriver.listGroups({}, user3);
            expect(user3Groups.groups).toHaveLength(1);

            // user2 should not see it
            const user2Groups = await appDriver.listGroups({}, user2);
            expect(user2Groups.groups).toHaveLength(0);
        });
    });

    describe('group security endpoints', () => {
        it('should allow non-admin members to load pending members when approvals are automatic', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            const joinResult = await appDriver.joinGroupByLink(shareToken, undefined, user2);
            expect(joinResult.memberStatus).toBe(MemberStatuses.ACTIVE);

            const pendingMembersForMember = await appDriver.getPendingMembers(group.id, user2);
            expect(pendingMembersForMember).toEqual([]);
        });

        it('should still block non-admin members when admin approval is required', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            await appDriver.updateGroupPermissions(
                group.id,
                {
                    memberApproval: 'admin-required',
                },
                user1,
            );

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await expect(appDriver.getPendingMembers(group.id, user2)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should allow non-admin members to reject pending members when approvals are automatic', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Start with admin-required so we get a pending member
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'admin-required' }, user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);

            // User2 joins and gets approved
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.approveMember(group.id, user2, user1);

            // User3 joins - should be pending
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // Switch to automatic mode
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'automatic' }, user1);

            // User2 (non-admin) should be able to reject user3
            await appDriver.rejectMember(group.id, user3, user2);

            // Verify user3 was removed
            const pendingMembers = await appDriver.getPendingMembers(group.id, user1);
            expect(pendingMembers.find(m => m.uid === user3)).toBeUndefined();
        });

        it('should block non-admin members from rejecting when admin approval is required', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            await appDriver.updateGroupPermissions(
                group.id,
                {
                    memberApproval: 'admin-required',
                },
                user1,
            );

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);

            // User2 joins and becomes active (admin approves)
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.approveMember(group.id, user2, user1);

            // User3 joins - should be pending
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // User2 (non-admin) should NOT be able to reject user3
            await expect(appDriver.rejectMember(group.id, user3, user2)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should manage permissions and pending members through security handlers', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            await appDriver.updateGroupPermissions(group.id, {
                memberApproval: 'admin-required',
            }, user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const pendingMembers = await appDriver.getPendingMembers(group.id, user1);
            const pendingIds = pendingMembers.map((member) => member.uid);

            expect(pendingIds.sort()).toEqual([user2, user3].sort());
            expect(pendingMembers.every((member) => member.memberStatus === MemberStatuses.PENDING)).toBe(true);

            await appDriver.approveMember(group.id, user2, user1);
            await appDriver.updateMemberRole(group.id, user2, MemberRoles.ADMIN, user1);

            await appDriver.rejectMember(group.id, user3, user1);

            const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, user1);
            const approvedMember = groupDetails.members.members.find((member) => member.uid === user2);
            const rejectedMember = groupDetails.members.members.find((member) => member.uid === user3);

            expect(approvedMember?.memberStatus).toBe(MemberStatuses.ACTIVE);
            expect(approvedMember?.memberRole).toBe(MemberRoles.ADMIN);
            expect(rejectedMember).toBeUndefined();

            const pendingAfterActions = await appDriver.getPendingMembers(group.id, user1);
            expect(pendingAfterActions).toHaveLength(0);
        });
    });

    describe('listGroups edge cases', () => {
        it('should ignore invalid statusFilter values and return results', async () => {
            // Invalid status filter values are silently ignored (defensive programming)
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Invalid filter value should be ignored, defaults to no filter
            const result = await appDriver.listGroups({ statusFilter: 'invalid' as any }, user1);

            // Should still return the group since invalid filter is ignored
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].id).toBe(group.id);
        });

        it('should support multiple statusFilter values', async () => {
            const group1 = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Active Group').build(),
                user1,
            );
            const group2 = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Group to Archive').build(),
                user1,
            );

            await appDriver.archiveGroupForUser(group2.id, user1);

            // Request both active and archived
            const result = await appDriver.listGroups({ statusFilter: ['active', 'archived'] }, user1);

            expect(result.groups).toHaveLength(2);
            expect(result.groups.map((g) => g.id)).toContain(group1.id);
            expect(result.groups.map((g) => g.id)).toContain(group2.id);
        });

        it('should default to active filter when no statusFilter provided', async () => {
            const activeGroup = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Active Group').build(),
                user1,
            );
            const archivedGroup = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Archived Group').build(),
                user1,
            );

            await appDriver.archiveGroupForUser(archivedGroup.id, user1);

            const result = await appDriver.listGroups({}, user1);

            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].id).toBe(activeGroup.id);
        });

        it('should order groups by most recent activity (expense creates activity)', async () => {
            // Create two groups
            const group1 = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Group One').build(),
                user1,
            );
            const group2 = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Group Two').build(),
                user1,
            );

            // Add an expense to group1
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group1.id)
                    .withPaidBy(user1)
                    .withParticipants([user1])
                    .build(),
                user1,
            );

            // After the expense, group1 should be first (most recent activity)
            let result = await appDriver.listGroups({}, user1);
            expect(result.groups[0].id).toBe(group1.id);

            // Small delay to ensure different timestamp
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Now add an expense to group2
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group2.id)
                    .withPaidBy(user1)
                    .withParticipants([user1])
                    .build(),
                user1,
            );

            // Now group2 should be first (most recent activity)
            result = await appDriver.listGroups({}, user1);
            expect(result.groups[0].id).toBe(group2.id);
        });
    });

    describe('updateMemberRole edge cases', () => {
        it('should reject role update for non-existent member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            await expect(
                appDriver.updateMemberRole(group.id, user2, MemberRoles.ADMIN, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject role update by non-owner', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // user2 tries to promote user3 to admin
            await expect(
                appDriver.updateMemberRole(group.id, user3, MemberRoles.ADMIN, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should allow owner to promote and demote members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Promote to admin
            await appDriver.updateMemberRole(group.id, user2, MemberRoles.ADMIN, user1);

            let details = await appDriver.getGroupFullDetails(group.id, {}, user1);
            const promotedMember = details.members.members.find((m) => m.uid === user2);
            expect(promotedMember?.memberRole).toBe(MemberRoles.ADMIN);

            // Demote back to member
            await appDriver.updateMemberRole(group.id, user2, MemberRoles.MEMBER, user1);

            details = await appDriver.getGroupFullDetails(group.id, {}, user1);
            const demotedMember = details.members.members.find((m) => m.uid === user2);
            expect(demotedMember?.memberRole).toBe(MemberRoles.MEMBER);
        });

        it('should reject invalid role value', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await expect(
                appDriver.updateMemberRole(group.id, user2, 'superadmin' as any, user1),
            )
                .rejects
                .toMatchObject({
                    code: 'VALIDATION_ERROR',
                    data: {
                        detail: 'INVALID_ROLE',
                    },
                });
        });
    });

    describe('pending member approval edge cases', () => {
        it('should reject approving a non-existent member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Enable admin approval requirement
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'admin-required' }, user1);

            await expect(
                appDriver.approveMember(group.id, user2, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject rejecting a non-existent member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Enable admin approval requirement
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'admin-required' }, user1);

            await expect(
                appDriver.rejectMember(group.id, user2, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should no-op when approving an already active member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // user2 is already active (auto-approved), trying to approve again should be a no-op
            // This should not throw - it succeeds silently
            await appDriver.approveMember(group.id, user2, user1);

            // Verify member is still active
            const details = await appDriver.getGroupFullDetails(group.id, {}, user1);
            const member = details.members.members.find((m) => m.uid === user2);
            expect(member?.memberStatus).toBe(MemberStatuses.ACTIVE);
        });

        it('should reject approving by a non-owner when approval required', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Enable admin approval requirement
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'admin-required' }, user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);

            // First join and approve user2 so they can be an active member
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.approveMember(group.id, user2, user1);

            // Now user3 tries to join (will be pending)
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // user2 (not owner) tries to approve user3
            await expect(
                appDriver.approveMember(group.id, user3, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });
    });

    describe('group activity feed events', () => {
        it('should generate activity event when group is updated', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Original Name').build(),
                user1,
            );
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.updateGroup(
                groupId,
                new GroupUpdateBuilder()
                    .withName(toGroupName('Updated Name'))
                    .withDescription('New description')
                    .build(),
                user1,
            );

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const groupUpdatedEvent = response.items.find(
                (item) => item.eventType === ActivityFeedEventTypes.GROUP_UPDATED,
            );

            expect(groupUpdatedEvent).toBeDefined();
            expect(groupUpdatedEvent?.actorId).toBe(user1);
            expect(groupUpdatedEvent?.action).toBe('update');
        });

        it('should generate activity event when member is approved', async () => {
            // Create a group and set it to require admin approval
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Managed Group').build(),
                user1,
            );
            const groupId = group.id;

            await appDriver.updateGroupPermissions(
                groupId,
                { memberApproval: 'admin-required' },
                user1,
            );

            // Generate share link and have user2 try to join (will be pending)
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Approve the pending member
            await appDriver.approveMember(groupId, user2, user1);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const memberJoinedEvent = response.items.find(
                (item) =>
                    item.eventType === ActivityFeedEventTypes.MEMBER_JOINED
                    && item.details?.targetUserId === user2,
            );

            expect(memberJoinedEvent).toBeDefined();
            expect(memberJoinedEvent?.actorId).toBe(user2);
            expect(memberJoinedEvent?.action).toBe('join');
        });

        it('should generate activity event when member is removed', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Owner removes member
            await appDriver.removeGroupMember(groupId, user2, user1);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const memberLeftEvent = response.items.find(
                (item) =>
                    item.eventType === ActivityFeedEventTypes.MEMBER_LEFT
                    && item.details?.targetUserId === user2,
            );

            expect(memberLeftEvent).toBeDefined();
            expect(memberLeftEvent?.actorId).toBe(user1);
            expect(memberLeftEvent?.action).toBe('leave');
        });

        it('should generate activity event when group permissions are updated', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.updateGroupPermissions(
                groupId,
                { memberApproval: 'admin-required' },
                user1,
            );

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const permissionsUpdatedEvent = response.items.find(
                (item) => item.eventType === ActivityFeedEventTypes.PERMISSIONS_UPDATED,
            );

            expect(permissionsUpdatedEvent).toBeDefined();
            expect(permissionsUpdatedEvent?.actorId).toBe(user1);
            expect(permissionsUpdatedEvent?.action).toBe('update');
        });

        it('should generate activity event when member role is changed', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Promote user2 to admin
            await appDriver.updateMemberRole(groupId, user2, MemberRoles.ADMIN, user1);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const roleChangedEvent = response.items.find(
                (item) =>
                    item.eventType === ActivityFeedEventTypes.MEMBER_ROLE_CHANGED
                    && item.details?.targetUserId === user2,
            );

            expect(roleChangedEvent).toBeDefined();
            expect(roleChangedEvent?.actorId).toBe(user1);
            expect(roleChangedEvent?.action).toBe('update');
            expect(roleChangedEvent?.details?.newRole).toBe(MemberRoles.ADMIN);
        });
    });

    describe('group locking', () => {
        it('should allow admin to lock a group', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock the group
            await appDriver.updateGroup(groupId, { locked: true }, user1);

            // Verify group is locked
            const details = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(details.group.locked).toBe(true);
        });

        it('should allow admin to unlock a group', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock then unlock
            await appDriver.updateGroup(groupId, { locked: true }, user1);
            await appDriver.updateGroup(groupId, { locked: false }, user1);

            // Verify group is unlocked
            const details = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(details.group.locked).toBe(false);
        });

        it('should reject locking by non-admin member', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Non-admin tries to lock the group
            await expect(
                appDriver.updateGroup(groupId, { locked: true }, user2),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject name updates on locked group', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock the group
            await appDriver.updateGroup(groupId, { locked: true }, user1);

            // Try to update name - should be rejected
            await expect(
                appDriver.updateGroup(groupId, new GroupUpdateBuilder().withName(toGroupName('New Name')).build(), user1),
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                data: { detail: 'GROUP_LOCKED' },
            });
        });

        it('should reject expense creation on locked group', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock the group
            await appDriver.updateGroup(groupId, { locked: true }, user1);

            // Try to create expense - should be rejected
            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withPaidBy(user1)
                        .withParticipants([user1])
                        .build(),
                    user1,
                ),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should generate group-locked activity event when group is locked', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock the group
            await appDriver.updateGroup(groupId, { locked: true }, user1);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const lockedEvent = response.items.find(
                (item) => item.eventType === ActivityFeedEventTypes.GROUP_LOCKED,
            );

            expect(lockedEvent).toBeDefined();
            expect(lockedEvent?.actorId).toBe(user1);
            expect(lockedEvent?.action).toBe('update');
        });

        it('should generate group-unlocked activity event when group is unlocked', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock then unlock
            await appDriver.updateGroup(groupId, { locked: true }, user1);
            await appDriver.updateGroup(groupId, { locked: false }, user1);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const unlockedEvent = response.items.find(
                (item) => item.eventType === ActivityFeedEventTypes.GROUP_UNLOCKED,
            );

            expect(unlockedEvent).toBeDefined();
            expect(unlockedEvent?.actorId).toBe(user1);
            expect(unlockedEvent?.action).toBe('update');
        });

        it('should allow admin to unlock locked group (the only permitted change)', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withName('Test Group').build(),
                user1,
            );
            const groupId = group.id;

            // Lock the group
            await appDriver.updateGroup(groupId, { locked: true }, user1);

            // Unlocking should still work
            await appDriver.updateGroup(groupId, { locked: false }, user1);

            // Verify group is unlocked
            const details = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(details.group.locked).toBe(false);
        });
    });
});
