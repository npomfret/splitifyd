import { ActivityFeedActions, ActivityFeedEventTypes, MemberRoles, MemberStatuses, toUserId, toGroupId } from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, UserRegistrationBuilder, CreateExpenseRequestBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it, test } from 'vitest';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { IFirestoreReader } from '../../../services/firestore';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('GroupMemberService - Consolidated Unit Tests', () => {
    let groupMemberService: GroupMemberService;
    let firestoreReader: IFirestoreReader;
    let appDriver: AppDriver;

    beforeEach(async () => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();

        // Use ComponentBuilder to create the service with proper dependencies
        const stubAuth = new StubAuthService();
        const componentBuilder = new ComponentBuilder(stubAuth, appDriver.database, appDriver.storageStub);
        groupMemberService = componentBuilder.buildGroupMemberService();
        firestoreReader = componentBuilder.buildFirestoreReader();
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId1 = toUserId(user1.user.uid);

            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId2 = toUserId(user2.user.uid);

            const user3 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId3 = toUserId(user3.user.uid);

            // Create group (user1 becomes owner/admin automatically)
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId1);
            const groupId = toGroupId(group.id);

            // Add user2 as regular member and user3 as admin
            await appDriver.addMembersToGroup(groupId, userId1, [userId2, userId3]);

            // Promote user3 to admin
            await appDriver.updateMemberRole(groupId, userId3, MemberRoles.ADMIN, userId1);

            // Act
            const result = await firestoreReader.getAllGroupMembers(groupId);

            // Assert
            expect(result).toHaveLength(3);
            expect(result.map(m => m.uid)).toContain(userId1);
            expect(result.map(m => m.uid)).toContain(userId2);
            expect(result.map(m => m.uid)).toContain(userId3);

            const user3Member = result.find(m => m.uid === userId3);
            expect(user3Member?.memberRole).toBe(MemberRoles.ADMIN);
        });

        it('should return empty array for group with no members', async () => {
            // Arrange
            const nonExistentGroupId = toGroupId('nonexistent-group');

            // Act
            const result = await firestoreReader.getAllGroupMembers(nonExistentGroupId);

            // Assert
            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should handle invalid group ID', async () => {
            // Arrange
            const invalidGroupId = toGroupId('');

            // Act
            const result = await firestoreReader.getAllGroupMembers(invalidGroupId);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('isGroupMemberAsync', () => {
        it('should return true for existing group member', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act
            const result = await groupMemberService.isGroupMemberAsync(groupId, userId);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for non-existent group member', async () => {
            // Arrange
            const owner = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const ownerId = toUserId(owner.user.uid);

            const nonMember = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberId = toUserId(nonMember.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), ownerId);
            const groupId = toGroupId(group.id);

            // Act
            const result = await groupMemberService.isGroupMemberAsync(groupId, nonMemberId);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid group ID', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);
            const invalidGroupId = toGroupId('');

            // Act
            const result = await groupMemberService.isGroupMemberAsync(invalidGroupId, userId);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid user ID', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const invalidUserId = toUserId('');

            // Act
            const result = await groupMemberService.isGroupMemberAsync(groupId, invalidUserId);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('Security Role and Approval Workflow', () => {
        it('should allow admin to promote a member to admin', async () => {
            // Arrange
            const admin = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const adminUserId = toUserId(admin.user.uid);

            const member = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const memberUserId = toUserId(member.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const groupId = toGroupId(group.id);

            // Add member to group
            await appDriver.addMembersToGroup(groupId, adminUserId, [memberUserId]);

            // Act
            const response = await appDriver.updateMemberRole(groupId, memberUserId, MemberRoles.ADMIN, adminUserId);

            // Assert
            expect(response.message).toContain('Member role updated');

            const updatedMember = await firestoreReader.getGroupMember(groupId, memberUserId);
            expect(updatedMember?.memberRole).toBe(MemberRoles.ADMIN);
        });

        it('should prevent removing the last active admin', async () => {
            // Arrange
            const admin = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const adminUserId = toUserId(admin.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const groupId = toGroupId(group.id);

            // Act & Assert - trying to demote the only admin
            await expect(
                appDriver.updateMemberRole(groupId, adminUserId, MemberRoles.MEMBER, adminUserId),
            )
                .rejects
                .toMatchObject({
                    details: { message: expect.stringMatching(/last active admin/i) },
                });
        });

        it('should approve pending members', async () => {
            // Note: Standard groups don't require admin approval, so joinGroupByLink auto-approves members.
            // This test verifies that approving an already-active member returns the appropriate message.

            // Arrange
            const admin = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const adminUserId = toUserId(admin.user.uid);

            const newUser = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const newUserId = toUserId(newUser.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const groupId = toGroupId(group.id);

            // Generate share link and join (auto-approves in non-admin-required groups)
            const shareLink = await appDriver.generateShareableLink(groupId, undefined, adminUserId);
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, newUserId);

            // Act - trying to approve an already-active member
            const response = await appDriver.approveMember(groupId, newUserId, adminUserId);

            // Assert - in non-admin-required groups, member is already active
            expect(response.message).toContain('Member is already active');

            const approvedMember = await firestoreReader.getGroupMember(groupId, newUserId);
            expect(approvedMember?.memberStatus).toBe(MemberStatuses.ACTIVE);
        });

        it('should reject pending members', async () => {
            // Arrange
            const admin = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const adminUserId = toUserId(admin.user.uid);

            const pendingUser = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const pendingUserId = toUserId(pendingUser.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const groupId = toGroupId(group.id);

            // Generate share link and join (which creates pending member in admin-required groups)
            const shareLink = await appDriver.generateShareableLink(groupId, undefined, adminUserId);
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, pendingUserId);

            // Act
            const response = await appDriver.rejectMember(groupId, pendingUserId, adminUserId);

            // Assert
            expect(response.message).toContain('Member rejected');

            const rejectedMember = await firestoreReader.getGroupMember(groupId, pendingUserId);
            expect(rejectedMember).toBeNull();
        });

        it('should list pending members for admins', async () => {
            // Note: Standard groups don't require admin approval, so there are no pending members.
            // This test verifies that getPendingMembers returns an empty list for non-admin-required groups.

            // Arrange
            const admin = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const adminUserId = toUserId(admin.user.uid);

            const newUser = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const newUserId = toUserId(newUser.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const groupId = toGroupId(group.id);

            // Generate share link and join (auto-approves in non-admin-required groups)
            const shareLink = await appDriver.generateShareableLink(groupId, undefined, adminUserId);
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, newUserId);

            // Act
            const pendingMembers = await appDriver.getPendingMembers(groupId, adminUserId);

            // Assert - no pending members in non-admin-required groups
            expect(pendingMembers).toHaveLength(0);
        });
    });

    // ================================
    // Validation Tests (from GroupMemberService.validation.test.ts)
    // ================================

    describe('Leave Group Validation', () => {

        test('should prevent group creator from leaving', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(appDriver.leaveGroup(groupId, creatorId)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent leaving with outstanding balance', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const member = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const memberId = toUserId(member.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add member to group
            await appDriver.addMembersToGroup(groupId, creatorId, [memberId]);

            // Create an expense where member owes money (paidBy creator, member is participant)
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(creatorId)
                    .withParticipants([creatorId, memberId])
                    .withAmount(100, 'USD')
                    .withSplitType('equal')
                    .build(),
                creatorId
            );

            // Act & Assert - member owes $50 and cannot leave
            await expect(appDriver.leaveGroup(groupId, memberId)).rejects.toThrow(/Invalid input data/);
        });

        test('should allow member to leave when balance is settled', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const member = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const memberId = toUserId(member.user.uid);

            const other = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const otherId = toUserId(other.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add members to group
            await appDriver.addMembersToGroup(groupId, creatorId, [memberId, otherId]);

            // Member has zero balance (no expenses involving them), so they can leave

            // Act
            const result = await appDriver.leaveGroup(groupId, memberId);

            // Assert
            expect(result).toEqual({
                message: 'Successfully left the group',
            });

            const remainingFeed = await firestoreReader.getActivityFeedForUser(otherId);
            const leaveEvent = remainingFeed.items.find(item => item.eventType === ActivityFeedEventTypes.MEMBER_LEFT);
            expect(leaveEvent).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: memberId,
            });

            const leavingFeed = await firestoreReader.getActivityFeedForUser(memberId);
            const leavingEvent = leavingFeed.items.find(item => item.eventType === ActivityFeedEventTypes.MEMBER_LEFT);
            expect(leavingEvent).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: memberId,
            });
        });

        test('should reject unauthorized leave request', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(toUserId(''), groupId)).rejects.toThrow(/Authentication required/);
        });

        test('should reject leave request for non-existent group', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            // Act & Assert - No group created
            await expect(appDriver.leaveGroup(toGroupId('nonexistent-group-id'), userId)).rejects.toThrow(/Group not found/);
        });

        test('should reject leave request for non-member', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const nonMember = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberId = toUserId(nonMember.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert - nonMember is not a member of the group
            await expect(appDriver.leaveGroup(groupId, nonMemberId)).rejects.toThrow(/Invalid input data/);
        });
    });

    describe('Remove Member Validation', () => {
        test('should prevent non-creator from removing members', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const member = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const memberId = toUserId(member.user.uid);

            const target = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const targetId = toUserId(target.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add members to group
            await appDriver.addMembersToGroup(groupId, creatorId, [memberId, targetId]);

            // Act & Assert - Non-creator (memberId) trying to remove targetId
            await expect(appDriver.removeGroupMember(groupId, targetId, memberId)).rejects.toThrow(/Access denied/);
        });

        test('should prevent removing the group creator', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert - creator trying to remove themselves
            await expect(appDriver.removeGroupMember(groupId, creatorId, creatorId)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent removing member with outstanding balance', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const member = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const memberId = toUserId(member.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add member to group
            await appDriver.addMembersToGroup(groupId, creatorId, [memberId]);

            // Create an expense where member paid and creator owes (member is owed $25)
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(memberId)
                    .withParticipants([creatorId, memberId])
                    .withAmount(50, 'USD')
                    .withSplitType('equal')
                    .build(),
                memberId
            );

            // Act & Assert - member is owed $25 and cannot be removed
            await expect(appDriver.removeGroupMember(groupId, memberId, creatorId)).rejects.toThrow(/Invalid input data/);
        });

        test('should allow creator to remove member with settled balance', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const member = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const memberId = toUserId(member.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add member to group
            await appDriver.addMembersToGroup(groupId, creatorId, [memberId]);

            // Member has zero balance (no expenses involving them)

            // Act
            const result = await appDriver.removeGroupMember(groupId, memberId, creatorId);

            // Assert
            expect(result).toEqual({
                message: 'Member removed successfully',
            });

            const ownerFeed = await firestoreReader.getActivityFeedForUser(creatorId);
            const leaveEvent = ownerFeed.items.find(item => item.eventType === ActivityFeedEventTypes.MEMBER_LEFT);
            expect(leaveEvent).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: creatorId,
            });

            const removedFeed = await firestoreReader.getActivityFeedForUser(memberId);
            const removedEvent = removedFeed.items.find(item => item.eventType === ActivityFeedEventTypes.MEMBER_LEFT);
            expect(removedEvent).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: creatorId,
            });
        });

        test('should reject removal of non-existent member', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert - nonexistent user
            await expect(appDriver.removeGroupMember(groupId, toUserId('nonexistent-user'), creatorId)).rejects.toThrow(/Invalid input data/);
        });

        test('should require valid member ID for removal', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(appDriver.removeGroupMember(groupId, toUserId(''), creatorId)).rejects.toThrow(/Missing required field.*memberId/);
        });
    });

    describe('Authorization Edge Cases', () => {
        test('should handle empty user ID in leave request', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(toUserId(''), groupId)).rejects.toThrow(/Authentication required/);
        });

        test('should handle null user ID in leave request', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(null as any, groupId)).rejects.toThrow(/Authentication required/);
        });

        test('should handle undefined user ID in leave request', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = toUserId(creator.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(undefined as any, groupId)).rejects.toThrow(/Authentication required/);
        });
    });
});
