// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User, borrowTestUsers } from '@splitifyd/test-support';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { groupSize } from '@splitifyd/shared';

describe('Group Management', () => {
    let driver: ApiDriver;
    let allUsers: User[] = [];

    // Helper to get users from pool
    const getTestUsers = (count: number): User[] => {
        return allUsers.slice(0, count);
    };

    beforeAll(async () => {
        ({ driver, users: allUsers } = await borrowTestUsers(6));
    });

    describe('Group Creation', () => {
        test('should create a new group', async () => {
            const users = getTestUsers(1);
            const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).build();

            const createdGroup = await driver.createGroup(groupData, users[0].token);

            expect(createdGroup.id).toBeDefined();

            // Verify the group was created
            const fetchedGroup = await driver.getGroup(createdGroup.id, users[0].token);
            expect(fetchedGroup.name).toBe(groupData.name);
            expect(groupSize(fetchedGroup)).toBe(1); // Only creator initially
        });
    });

    describe('Group Sharing & Access Control', () => {
        test('should return 404 for non-existent group ID', async () => {
            const users = getTestUsers(1);
            // Try to access a group that doesn't exist
            const fakeGroupId = 'non-existent-group-id-12345';

            await expect(driver.getGroup(fakeGroupId, users[0].token)).rejects.toThrow(/status 404.*NOT_FOUND/);
        });

        test('should return 404 for valid group when user is not a member (security: hide existence)', async () => {
            const users = getTestUsers(2);
            // Create a group using the new API
            const groupData = new CreateGroupRequestBuilder().withName(`Members Only Group ${uuidv4()}`).build();
            const testGroup = await driver.createGroup(groupData, users[0].token);

            // Use second user from pool as outsider
            const outsiderUser = users[1];

            // Try to access group as non-member
            // NOTE: Returns 404 instead of 403 for security - doesn't reveal group existence
            await expect(driver.getGroup(testGroup.id, outsiderUser.token)).rejects.toThrow(/status 404.*NOT_FOUND/);
        });

        test('should allow group members to access group details', async () => {
            const users = getTestUsers(2);
            // Create a group with both users as members
            const groupData = new CreateGroupRequestBuilder().withName(`Shared Group ${uuidv4()}`).build();
            const testGroup = await driver.createGroupWithMembers(groupData.name, users, users[0].token);

            // Both members should be able to access the group
            const groupFromUser0 = await driver.getGroup(testGroup.id, users[0].token);
            expect(groupFromUser0.id).toBe(testGroup.id);

            const groupFromUser1 = await driver.getGroup(testGroup.id, users[1].token);
            expect(groupFromUser1.id).toBe(testGroup.id);
        });

        test('should generate shareable link for group', async () => {
            const users = getTestUsers(2);
            // Create a test group
            const testGroup = await driver.createGroupWithMembers(`Share Link Test Group ${uuidv4()}`, users, users[0].token);

            // Any member should be able to generate a share link
            const shareResponse = await driver.generateShareLink(testGroup.id, users[0].token);

            expect(shareResponse).toHaveProperty('shareablePath');
            expect(shareResponse).toHaveProperty('linkId');
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        });

        test('should allow any member to generate shareable link', async () => {
            const users = getTestUsers(2);
            // Create a new group where user[0] is the creator and user[1] is a member
            const memberGroup = await driver.createGroupWithMembers(`Member Share Test Group ${uuidv4()}`, users, users[0].token);

            // User[1] (member) should be able to generate a share link
            const shareResponse = await driver.generateShareLink(memberGroup.id, users[1].token);

            expect(shareResponse).toHaveProperty('shareablePath');
            expect(shareResponse).toHaveProperty('linkId');
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        });

        test('should not allow non-members to generate shareable link', async () => {
            const users = getTestUsers(2);
            // Create a group with only user[0]
            const groupData = new CreateGroupRequestBuilder().withName(`Non-Member Test Group ${uuidv4()}`).build();
            const restrictedGroup = await driver.createGroup(groupData, users[0].token);

            // User[1] (non-member) should not be able to generate a share link
            await expect(driver.generateShareLink(restrictedGroup.id, users[1].token)).rejects.toThrow(/status 403.*UNAUTHORIZED/);
        });

        test('should allow new users to join group via share link', async () => {
            const users = getTestUsers(2);
            // First, create a new group and generate a share link
            const shareableGroupData = new CreateGroupRequestBuilder().withMember(users[0]).build();

            const shareableGroup = await driver.createGroup(shareableGroupData, users[0].token);

            // Generate share link
            const shareResponse = await driver.generateShareLink(shareableGroup.id, users[0].token);

            // Use second user from pool who will join via the link
            const newUser = users[1];

            // Join the group using the share token
            const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);

            expect(joinResponse).toHaveProperty('groupId');
            expect(joinResponse.groupId).toBe(shareableGroup.id);
            expect(joinResponse).toHaveProperty('message');
            expect(joinResponse).toHaveProperty('groupName');

            // Verify the user was added to the group
            const updatedGroup = await driver.getGroup(shareableGroup.id, newUser.token);
            expect(updatedGroup.members).toHaveProperty(newUser.uid);
        });

        test('should not allow duplicate joining via share link', async () => {
            const users = getTestUsers(2);
            // Create a group with a share link
            const dupTestGroupData = new CreateGroupRequestBuilder().withMember(users[0]).build();

            const dupTestGroup = await driver.createGroup(dupTestGroupData, users[0].token);
            const shareResponse = await driver.generateShareLink(dupTestGroup.id, users[0].token);

            // Add user[1] to the group via share link
            await driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            // Try to join again with the same user
            await expect(driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token)).rejects.toThrow(/ALREADY_MEMBER/);
        });

        test('should reject invalid share tokens', async () => {
            const users = getTestUsers(1);
            const invalidUser = users[0];

            // Try to join with an invalid token
            await expect(driver.joinGroupViaShareLink('INVALID_TOKEN_12345', invalidUser.token)).rejects.toThrow(/status 404.*INVALID_LINK/);
        });

        test('should allow multiple users to join group using the same share link', async () => {
            const users = getTestUsers(4); // Need 1 creator + 3 to join
            // Create a new group with only one member
            const multiJoinGroupData = new CreateGroupRequestBuilder().withMember(users[0]).build();

            const multiJoinGroup = await driver.createGroup(multiJoinGroupData, users[0].token);

            // Generate a share link
            const shareResponse = await driver.generateShareLink(multiJoinGroup.id, users[0].token);

            // Use 3 users from pool who will join via the same link
            const newUsers = users.slice(1, 4);

            // All users should be able to join using the same link
            for (const user of newUsers) {
                const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, user.token);

                expect(joinResponse).toHaveProperty('groupId');
                expect(joinResponse.groupId).toBe(multiJoinGroup.id);
                expect(joinResponse).toHaveProperty('message');
            }

            // Verify all users were added to the group
            const updatedGroup = await driver.getGroup(multiJoinGroup.id, users[0].token);

            // Should have original member + 3 new members = 4 total
            expect(groupSize(updatedGroup)).toBe(4);
            expect(updatedGroup.members).toHaveProperty(users[0].uid);
            newUsers.forEach((user) => {
                expect(updatedGroup.members).toHaveProperty(user.uid);
            });
        });
    });
});