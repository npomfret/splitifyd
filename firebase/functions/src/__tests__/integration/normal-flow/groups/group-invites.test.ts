// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { UserBuilder, CreateGroupRequestBuilder } from '@splitifyd/test-support';

describe('Invite Tracking', () => {
    let driver: ApiDriver;
    let users: User[] = [];
    let testGroup: any;

    beforeAll(async () => {
        driver = new ApiDriver();
        users = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);
    });

    beforeEach(async () => {
        const groupData = new CreateGroupRequestBuilder().withName(`Invite Test Group ${uuidv4()}`).withDescription('Testing invite tracking').build();
        testGroup = await driver.createGroup(groupData, users[0].token);
    });

    test('should track who invited new members via share links', async () => {
        // User 0 creates a share link
        const shareLink = await driver.generateShareLink(testGroup.id, users[0].token);
        expect(shareLink).toHaveProperty('linkId');
        expect(shareLink).toHaveProperty('shareablePath');

        // User 1 joins using the share link
        const joinResponse = await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
        expect(joinResponse.success).toBe(true);

        // Get the updated group to verify invite tracking
        const updatedGroup = await driver.getGroup(testGroup.id, users[0].token);

        // Verify that user 1 has invitedBy field set to user 0
        expect(updatedGroup.members).toHaveProperty(users[1].uid);
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('invitedBy', users[0].uid);
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('role', 'member');
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('joinedAt');
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('theme');
    });

    test('should track different inviters for different members', async () => {
        // User 0 creates a share link and invites user 1
        const shareLink1 = await driver.generateShareLink(testGroup.id, users[0].token);
        await driver.joinGroupViaShareLink(shareLink1.linkId, users[1].token);

        // User 1 creates a different share link and invites user 2
        const shareLink2 = await driver.generateShareLink(testGroup.id, users[1].token);
        await driver.joinGroupViaShareLink(shareLink2.linkId, users[2].token);

        // Get the updated group
        const updatedGroup = await driver.getGroup(testGroup.id, users[0].token);

        // Verify different invite attributions
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('invitedBy', users[0].uid);
        expect(updatedGroup.members[users[2].uid]).toHaveProperty('invitedBy', users[1].uid);
    });

    test('should track invite attribution when joining groups', async () => {
        // Generate a share link
        const shareLink = await driver.generateShareLink(testGroup.id, users[0].token);

        // Test joining via the link
        const joinResponse = await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
        expect(joinResponse.success).toBe(true);

        // Verify the user was added with proper invite attribution
        const updatedGroup = await driver.getGroup(testGroup.id, users[0].token);
        expect(updatedGroup.members).toHaveProperty(users[1].uid);
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('role', 'member');
        expect(updatedGroup.members[users[1].uid]).toHaveProperty('invitedBy', users[0].uid);
    });

    test('should support multiple concurrent share links from different users', async () => {
        // User 1 joins first
        const shareLink1 = await driver.generateShareLink(testGroup.id, users[0].token);
        await driver.joinGroupViaShareLink(shareLink1.linkId, users[1].token);

        // Both user 0 and user 1 create share links
        const shareLink0 = await driver.generateShareLink(testGroup.id, users[0].token);
        const shareLink1_new = await driver.generateShareLink(testGroup.id, users[1].token);

        // Verify links are different
        expect(shareLink0.linkId).not.toBe(shareLink1_new.linkId);

        // User 2 joins using user 1's link
        await driver.joinGroupViaShareLink(shareLink1_new.linkId, users[2].token);

        // Verify invite attribution
        const updatedGroup = await driver.getGroup(testGroup.id, users[0].token);
        expect(updatedGroup.members[users[2].uid]).toHaveProperty('invitedBy', users[1].uid);
    });
});