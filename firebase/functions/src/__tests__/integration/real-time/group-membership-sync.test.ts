import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, AppDriver, borrowTestUsers} from '@splitifyd/test-support';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { afterAll, describe, it, expect } from 'vitest';
import { FirestoreCollections } from '@splitifyd/shared';
import {firestoreDb} from "../../../firebase";
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Group Membership Real-Time Sync Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, firestoreDb);
    const activeListeners: Array<() => void> = [];

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    const _testUsers = (count: number) => users.slice(0, count);

    afterAll(() => {
        // Clean up all listeners
        activeListeners.forEach((unsubscribe) => unsubscribe());
        activeListeners.length = 0;
    });

    /**
     * This test replicates the issue where User 1 doesn't receive real-time updates
     * when User 2 joins the group via share link
     */
    it('should notify existing members when a new member joins via share link', async () => {
        const users = _testUsers(2);
        const user1 = users[0];
        const user2 = users[1];

        // User 1 creates a group
        const groupData = new CreateGroupRequestBuilder().withName(`RT Test Group ${uuidv4()}`).withDescription('Testing real-time membership sync').build();

        const group = await apiDriver.createGroup(groupData, user1.token);
        const groupId = group.id;

        // Set up a listener for User 1 to monitor group changes
        const membershipChanges: any[] = [];
        let resolvePromise: (value: unknown) => void;
        const membershipChangePromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        const groupRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const unsubscribe = groupRef.onSnapshot((snapshot) => {
            if (snapshot.exists) {
                const data = snapshot.data();
                const members = data?.members || {};
                const memberCount = Object.keys(members).length;

                membershipChanges.push({
                    timestamp: new Date().toISOString(),
                    memberCount,
                    memberIds: Object.keys(members),
                    members,
                });

                // Resolve when we detect user2 has joined
                if (memberCount === 2 && members[user2.uid]) {
                    resolvePromise(true);
                }
            }
        });
        activeListeners.push(unsubscribe);

        // Wait for initial membership state to be detected by the listener
        // Use ApiDriver to ensure group has user1 as member
        await appDriver.waitForUserJoinGroup(groupId, user1.uid, user1.token, 3000);

        // Wait for listener to capture initial state
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (membershipChanges.length > 0) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 50);
        });

        expect(membershipChanges.length).toBeGreaterThan(0);
        expect(membershipChanges[0].memberCount).toBe(1);
        expect(membershipChanges[0].memberIds).toContain(user1.uid);

        // User 1 generates a share link
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        const linkId = shareResponse.linkId;

        // User 2 joins via the share link
        await apiDriver.joinGroupViaShareLink(linkId, user2.token);

        // Use ApiDriver to wait for user2 to join the group
        await appDriver.waitForUserJoinGroup(groupId, user2.uid, user1.token, 5000);

        // Wait for the real-time listener to detect the change
        const updateReceived = await membershipChangePromise;

        // Verify User 1's listener received the update
        expect(updateReceived).toBe(true);

        // Check the final state
        const finalChange = membershipChanges[membershipChanges.length - 1];
        expect(finalChange.memberCount).toBe(2);
        expect(finalChange.memberIds).toContain(user1.uid);
        expect(finalChange.memberIds).toContain(user2.uid);

        // Verify both users can see each other via API
        const fullDetailsFromUser1 = await apiDriver.getGroupFullDetails(groupId, user1.token);
        expect(fullDetailsFromUser1.members.members.length).toBe(2);
        expect(fullDetailsFromUser1.members.members.map((m: any) => m.uid)).toContain(user2.uid);

        const fullDetailsFromUser2 = await apiDriver.getGroupFullDetails(groupId, user2.token);
        expect(fullDetailsFromUser2.members.members.length).toBe(2);
        expect(fullDetailsFromUser2.members.members.map((m: any) => m.uid)).toContain(user1.uid);
    });

    /**
     * Test that the group-changes collection is properly updated
     */
    it('should create a change record when member joins', async () => {
        const users = _testUsers(2);
        const user1 = users[0];
        const user2 = users[1];

        // User 1 creates a group
        const groupData = new CreateGroupRequestBuilder().withName(`Change Test Group ${uuidv4()}`).withDescription('Testing change detection').build();

        const group = await apiDriver.createGroup(groupData, user1.token);
        const groupId = group.id;

        // Set up listener for group-changes collection
        const changeRecords: any[] = [];
        const changesRef = firestoreDb.collection('group-changes').where('id', '==', groupId).where('users', 'array-contains', user1.uid);

        const unsubscribeChanges = changesRef.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    changeRecords.push({
                        id: change.doc.id,
                        ...change.doc.data(),
                        type: change.type,
                    });
                }
            });
        });
        activeListeners.push(unsubscribeChanges);

        // Generate share link and have user2 join
        const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

        // Use ApiDriver to wait for change records to be created
        await appDriver.waitForGroupChangeRecords(groupId, user1.uid, 1, 3000);

        // Wait for listener to capture the changes
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (changeRecords.length > 0) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 50);
        });

        // We should have at least one change record for the membership update
        expect(changeRecords.length).toBeGreaterThan(0);
    });
});
