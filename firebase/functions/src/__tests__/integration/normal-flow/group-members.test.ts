import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, borrowTestUsers} from '@splitifyd/test-support';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import {beforeEach} from "vitest";
import {PooledTestUser, UserToken} from "@splitifyd/shared";

describe('Group Members Integration Tests', () => {
    const apiDriver = new ApiDriver();

    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(5);
    });

    const _testUsers = (count: number) => users.slice(0, count);

    // Helper function to create a group with multiple members
    const createGroupWithMembers = async (driver: ApiDriver, users: UserToken[]): Promise<string> => {
        const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withDescription('Test group for member operations').build();

        const group = await driver.createGroup(groupData, users[0].token);

        // Add additional members to the group via share link
        if (users.length > 1) {
            const shareResponse = await driver.generateShareLink(group.id, users[0].token);
            for (let i = 1; i < users.length; i++) {
                await driver.joinGroupViaShareLink(shareResponse.linkId, users[i].token);
            }
        }

        return group.id;
    };

    describe('group member information via getGroupFullDetails', () => {
        it('should return all group members', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);

            const response = await apiDriver.getGroupFullDetails(groupId, users[0].token);

            expect(response.members).toMatchObject({
                members: expect.arrayContaining([expect.objectContaining({ uid: users[0].uid }), expect.objectContaining({ uid: users[1].uid }), expect.objectContaining({ uid: users[2].uid })]),
            });
            expect(response.members.members.length).toBe(3);
        });

        it('should return members sorted alphabetically', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);

            const response = await apiDriver.getGroupFullDetails(groupId, users[0].token);

            const displayNames = response.members.members.map((m: any) => m.displayName);
            const sortedNames = [...displayNames].sort((a, b) => a.localeCompare(b));
            expect(displayNames).toEqual(sortedNames);
        });

        it('should throw error if user is not authenticated', async () => {
            const users = _testUsers(1);
            const groupId = await createGroupWithMembers(apiDriver, users);

            await expect(apiDriver.getGroupFullDetails(groupId, 'invalid-token')).rejects.toThrow();
        });

        it('should throw FORBIDDEN if user is not a member', async () => {
            const users = _testUsers(2); // Need 2 users - one for group, one as non-member
            const groupId = await createGroupWithMembers(apiDriver, [users[0]]);
            const nonMember = users[1]; // Use second user as non-member

            await expect(apiDriver.getGroupFullDetails(groupId, nonMember.token)).rejects.toThrow();
        });
    });

    describe('leaveGroup', () => {
        it('should allow a member to leave the group', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const memberToLeave = users[1]; // Not the creator

            const response = await apiDriver.leaveGroup(groupId, memberToLeave.token);

            expect(response).toEqual({
                success: true,
                message: 'Successfully left the group',
            });

            // Verify member was removed by checking group members via API
            const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, users[0].token);
            expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).not.toContain(memberToLeave.uid);
            expect(fullDetailsResponse.members.members.length).toBe(2);
        });

        it('should prevent the creator from leaving', async () => {
            const users = _testUsers(2);
            const groupId = await createGroupWithMembers(apiDriver, users);

            await expect(apiDriver.leaveGroup(groupId, users[0].token)).rejects.toThrow(/Group creator cannot leave/);
        });

        it('should prevent leaving with outstanding balance', async () => {
            const users = _testUsers(2);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const memberWithDebt = users[1];

            // Create an expense where member owes money
            await apiDriver.createExpense(
                {
                    groupId: groupId,
                    description: 'Test expense',
                    amount: 100,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    paidBy: users[0].uid, // Creator paid
                    participants: [users[0].uid, memberWithDebt.uid],
                    splitType: 'equal',
                    category: 'food',
                },
                users[0].token,
            );

            await expect(apiDriver.leaveGroup(groupId, memberWithDebt.token)).rejects.toThrow(/Cannot leave group with outstanding balance/);
        });

        it('should update timestamps when leaving', async () => {
            const users = _testUsers(2);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const memberToLeave = users[1];

            // Get group info before leaving
            const {group: groupBefore} = await apiDriver.getGroupFullDetails(groupId, users[0].token);

            await apiDriver.leaveGroup(groupId, memberToLeave.token);

            // Verify timestamps were updated by checking group info
            const {group: groupAfter} = await apiDriver.getGroupFullDetails(groupId, users[0].token);
            expect(new Date(groupAfter.updatedAt).getTime()).toBeGreaterThan(new Date(groupBefore.updatedAt).getTime());
        });
    });

    describe('removeGroupMember', () => {
        it('should allow creator to remove a member', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const creator = users[0];
            const memberToRemove = users[1];

            const response = await apiDriver.removeGroupMember(groupId, memberToRemove.uid, creator.token);

            expect(response).toEqual({
                success: true,
                message: 'Member removed successfully',
            });

            // Verify member was removed by checking group members via API
            const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, creator.token);
            expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).not.toContain(memberToRemove.uid);
            expect(fullDetailsResponse.members.members.length).toBe(2);
        });

        it('should prevent non-creator from removing members', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const nonCreator = users[1];
            const memberToRemove = users[2];

            await expect(apiDriver.removeGroupMember(groupId, memberToRemove.uid, nonCreator.token)).rejects.toThrow(/FORBIDDEN/);
        });

        it('should prevent removing the creator', async () => {
            const users = _testUsers(2);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const creator = users[0];

            await expect(apiDriver.removeGroupMember(groupId, creator.uid, creator.token)).rejects.toThrow(/Group creator cannot be removed/);
        });

        it('should prevent removing member with outstanding balance', async () => {
            const users = _testUsers(2);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const creator = users[0];
            const memberWithDebt = users[1];

            // Create expense where member owes money
            await apiDriver.createExpense(
                {
                    groupId: groupId,
                    description: 'Test expense',
                    amount: 100,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    paidBy: creator.uid,
                    participants: [creator.uid, memberWithDebt.uid],
                    splitType: 'equal',
                    category: 'food',
                },
                creator.token,
            );

            await expect(apiDriver.removeGroupMember(groupId, memberWithDebt.uid, creator.token)).rejects.toThrow(/Cannot remove member with outstanding balance/);
        });

        it('should handle removing non-existent member', async () => {
            const users = _testUsers(1);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const creator = users[0];
            const nonExistentMember = 'non-existent-uid';

            await expect(apiDriver.removeGroupMember(groupId, nonExistentMember, creator.token)).rejects.toThrow(/User is not a member of this group/);
        });
    });

    describe('Complex scenarios', () => {
        it('should handle multiple members leaving sequentially', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const member1 = users[1];
            const member2 = users[2];

            // First member leaves
            await apiDriver.leaveGroup(groupId, member1.token);

            // Second member leaves
            await apiDriver.leaveGroup(groupId, member2.token);

            // Verify only creator remains via API
            const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, users[0].token);
            expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).toEqual([users[0].uid]);
            expect(fullDetailsResponse.members.members.length).toBe(1);
        });

        it('should prevent access after leaving group', async () => {
            const users = _testUsers(2);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const memberToLeave = users[1];

            // Member leaves
            await apiDriver.leaveGroup(groupId, memberToLeave.token);

            // Try to access group details after leaving
            await expect(apiDriver.getGroupFullDetails(groupId, memberToLeave.token)).rejects.toThrow();
        });

        it('should handle mixed leave and remove operations', async () => {
            const users = _testUsers(3);
            const groupId = await createGroupWithMembers(apiDriver, users);
            const creator = users[0];
            const member1 = users[1];
            const member2 = users[2];

            // Creator removes member1
            await apiDriver.removeGroupMember(groupId, member1.uid, creator.token);

            // Member2 leaves voluntarily
            await apiDriver.leaveGroup(groupId, member2.token);

            // Verify only creator remains via API
            const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, creator.token);
            expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).toEqual([creator.uid]);
            expect(fullDetailsResponse.members.members.length).toBe(1);
        });
    });
});
