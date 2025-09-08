// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, CreateGroupRequestBuilder} from '@splitifyd/test-support';
import {PooledTestUser} from "@splitifyd/shared";

describe('Invite Tracking', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
    });
    
    beforeEach(async () => {
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Invite Test Group ${uuidv4()}`)
            .withDescription('Testing invite tracking')
            .build();
        testGroup = await apiDriver.createGroup(groupData, users[0].token);
    });

    test('should track who invited new members via share links', async () => {
        // User 0 creates a share link
        const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        expect(shareLink).toHaveProperty('linkId');
        expect(shareLink).toHaveProperty('shareablePath');

        // User 1 joins using the share link
        const joinResponse = await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
        expect(joinResponse.success).toBe(true);

        // Get the updated group to verify invite tracking
        const {members} = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

        const found = members.members.find((m) => m.uid === users[1].uid)!;

        // Verify that user 1 has invitedBy field set to user 0
        expect(found).toHaveProperty('invitedBy', users[0].uid);
        expect(found).toHaveProperty('memberRole', 'member');
        expect(found).toHaveProperty('joinedAt');
        expect(found).toHaveProperty('themeColor');
    });

    test('should track different inviters for different members', async () => {
        // User 0 creates a share link and invites user 1
        const shareLink1 = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink1.linkId, users[1].token);

        // User 1 creates a different share link and invites user 2
        const shareLink2 = await apiDriver.generateShareLink(testGroup.id, users[1].token);
        await apiDriver.joinGroupViaShareLink(shareLink2.linkId, users[2].token);

        // Get the updated group
        const {members} = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

        const found1 = members.members.find((m) => m.uid === users[1].uid)!;
        expect(found1).toHaveProperty('invitedBy', users[0].uid);

        const found2 = members.members.find((m) => m.uid === users[2].uid)!;
        expect(found2).toHaveProperty('invitedBy', users[1].uid);
    });

    test('should track invite attribution when joining groups', async () => {
        // Generate a share link
        const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);

        // Test joining via the link
        const joinResponse = await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
        expect(joinResponse.success).toBe(true);

        // Verify the user was added with proper invite attribution
        const {members} = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
        const found = members.members.find((m) => m.uid === users[1].uid)!;
        expect(found).toHaveProperty('memberRole', 'member');
        expect(found).toHaveProperty('invitedBy', users[0].uid);
    });

    test('should support multiple concurrent share links from different users', async () => {
        // User 1 joins first
        const shareLink1 = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink1.linkId, users[1].token);

        // Both user 0 and user 1 create share links
        const shareLink0 = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        const shareLink1_new = await apiDriver.generateShareLink(testGroup.id, users[1].token);

        // Verify links are different
        expect(shareLink0.linkId).not.toBe(shareLink1_new.linkId);

        // User 2 joins using user 1's link
        await apiDriver.joinGroupViaShareLink(shareLink1_new.linkId, users[2].token);

        // Verify invite attribution
        const {members} = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
        const found = members.members.find((m) => m.uid === users[2].uid)!;
        expect(found).toHaveProperty('invitedBy', users[1].uid);
    });
});