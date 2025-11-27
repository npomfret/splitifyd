import { calculateEqualSplits, MemberRoles, MemberStatuses, toAmount, toGroupName, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, GroupUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
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

        await expect(appDriver.previewGroupByLink(shareToken, user2)).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
        await expect(appDriver.joinGroupByLink(shareToken, undefined, user2)).rejects.toMatchObject({ code: 'INVALID_LINK' });
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
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject unarchiving a non-archived membership', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Try to unarchive an active membership
            await expect(appDriver.unarchiveGroupForUser(groupId, user2))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
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
});
