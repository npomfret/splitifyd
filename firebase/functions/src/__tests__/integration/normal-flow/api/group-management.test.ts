// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, CreateGroupRequestBuilder, borrowTestUsers, borrowTestUser} from '@splitifyd/test-support';
import { groupSize } from '@splitifyd/shared';

describe('Group Management', () => {
    const apiDriver = new ApiDriver();

    describe('Group Creation', () => {
        test('should create a new group', async () => {
            const user = await borrowTestUser();
            const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).build();

            const createdGroup = await apiDriver.createGroup(groupData, user.token);

            expect(createdGroup.id).toBeDefined();

            // Verify the group was created
            const fetchedGroup = await apiDriver.getGroup(createdGroup.id, user.token);
            expect(fetchedGroup.name).toBe(groupData.name);
            expect(groupSize(fetchedGroup)).toBe(1); // Only creator initially
        });
    });

    describe('Group Sharing & Access Control', () => {
        test('should return 404 for non-existent group ID', async () => {
            const user = await borrowTestUser();
            // Try to access a group that doesn't exist
            const fakeGroupId = 'non-existent-group-id-12345';

            await expect(apiDriver.getGroup(fakeGroupId, user.token)).rejects.toThrow(/status 404.*NOT_FOUND/);
        });

        test('should return 404 for valid group when user is not a member (security: hide existence)', async () => {
            const users = await borrowTestUsers(2);
            // Create a group using the new API
            const groupData = new CreateGroupRequestBuilder().withName(`Members Only Group ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Use second user from pool as outsider
            const outsiderUser = users[1];

            // Try to access group as non-member
            // NOTE: Returns 404 instead of 403 for security - doesn't reveal group existence
            await expect(apiDriver.getGroup(testGroup.id, outsiderUser.token)).rejects.toThrow(/status 404.*NOT_FOUND/);
        });

        test('should allow group members to access group details', async () => {
            const users = await borrowTestUsers(2);
            // Create a group with both users as members
            const groupData = new CreateGroupRequestBuilder().withName(`Shared Group ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroupWithMembers(groupData.name, users, users[0].token);

            // Both members should be able to access the group
            const groupFromUser0 = await apiDriver.getGroup(testGroup.id, users[0].token);
            expect(groupFromUser0.id).toBe(testGroup.id);

            const groupFromUser1 = await apiDriver.getGroup(testGroup.id, users[1].token);
            expect(groupFromUser1.id).toBe(testGroup.id);
        });

        test('should generate shareable link for group', async () => {
            const users = await borrowTestUsers(2);
            // Create a test group
            const testGroup = await apiDriver.createGroupWithMembers(`Share Link Test Group ${uuidv4()}`, users, users[0].token);

            // Any member should be able to generate a share link
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, users[0].token);

            expect(shareResponse).toHaveProperty('shareablePath');
            expect(shareResponse).toHaveProperty('linkId');
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        });

        test('should allow any member to generate shareable link', async () => {
            const users = await borrowTestUsers(2);
            // Create a new group where user[0] is the creator and user[1] is a member
            const memberGroup = await apiDriver.createGroupWithMembers(`Member Share Test Group ${uuidv4()}`, users, users[0].token);

            // User[1] (member) should be able to generate a share link
            const shareResponse = await apiDriver.generateShareLink(memberGroup.id, users[1].token);

            expect(shareResponse).toHaveProperty('shareablePath');
            expect(shareResponse).toHaveProperty('linkId');
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        });

        test('should not allow non-members to generate shareable link', async () => {
            const users = await borrowTestUsers(2);
            // Create a group with only user[0]
            const groupData = new CreateGroupRequestBuilder().withName(`Non-Member Test Group ${uuidv4()}`).build();
            const restrictedGroup = await apiDriver.createGroup(groupData, users[0].token);

            // User[1] (non-member) should not be able to generate a share link
            await expect(apiDriver.generateShareLink(restrictedGroup.id, users[1].token)).rejects.toThrow(/status 403.*UNAUTHORIZED/);
        });

        test('should allow new users to join group via share link', async () => {
            const users = await borrowTestUsers(2);
            // First, create a new group and generate a share link
            const shareableGroupData = new CreateGroupRequestBuilder().build();

            const shareableGroup = await apiDriver.createGroup(shareableGroupData, users[0].token);

            // Generate share link
            const shareResponse = await apiDriver.generateShareLink(shareableGroup.id, users[0].token);

            // Use second user from pool who will join via the link
            const newUser = users[1];

            // Join the group using the share token
            const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);

            expect(joinResponse).toHaveProperty('groupId');
            expect(joinResponse.groupId).toBe(shareableGroup.id);
            expect(joinResponse).toHaveProperty('message');
            expect(joinResponse).toHaveProperty('groupName');

            // Verify the user was added to the group
            const updatedGroup = await apiDriver.getGroup(shareableGroup.id, newUser.token);
            expect(updatedGroup.members).toHaveProperty(newUser.uid);
        });

        test('should not allow duplicate joining via share link', async () => {
            const users = await borrowTestUsers(2);
            // Create a group with a share link
            const dupTestGroupData = new CreateGroupRequestBuilder().build();

            const dupTestGroup = await apiDriver.createGroup(dupTestGroupData, users[0].token);
            const shareResponse = await apiDriver.generateShareLink(dupTestGroup.id, users[0].token);

            // Add user[1] to the group via share link
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            // Try to join again with the same user
            await expect(apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token)).rejects.toThrow(/ALREADY_MEMBER/);
        });

        test('should reject invalid share tokens', async () => {
            const user = await borrowTestUser();
            const invalidUser = user;

            // Try to join with an invalid token
            await expect(apiDriver.joinGroupViaShareLink('INVALID_TOKEN_12345', invalidUser.token)).rejects.toThrow(/status 404.*INVALID_LINK/);
        });

        test('should allow multiple users to join group using the same share link', async () => {
            const users = await borrowTestUsers(4); // Need 1 creator + 3 to join
            // Create a new group with only one member
            const multiJoinGroupData = new CreateGroupRequestBuilder().build();

            const multiJoinGroup = await apiDriver.createGroup(multiJoinGroupData, users[0].token);

            // Generate a share link
            const shareResponse = await apiDriver.generateShareLink(multiJoinGroup.id, users[0].token);

            // Use 3 users from pool who will join via the same link
            const newUsers = users.slice(1, 4);

            // All users should be able to join using the same link
            for (const user of newUsers) {
                const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user.token);

                expect(joinResponse).toHaveProperty('groupId');
                expect(joinResponse.groupId).toBe(multiJoinGroup.id);
                expect(joinResponse).toHaveProperty('message');
            }

            // Verify all users were added to the group
            const updatedGroup = await apiDriver.getGroup(multiJoinGroup.id, users[0].token);

            // Should have original member + 3 new members = 4 total
            expect(groupSize(updatedGroup)).toBe(4);
            expect(updatedGroup.members).toHaveProperty(users[0].uid);
            newUsers.forEach((user) => {
                expect(updatedGroup.members).toHaveProperty(user.uid);
            });
        });
    });
});