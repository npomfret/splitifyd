/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver } from '../../support/ApiDriver';
import { CreateGroupRequestBuilder } from '../../support/builders';
import { beforeAll } from '@jest/globals';
import { FirebaseIntegrationTestUserPool } from '../../support/FirebaseIntegrationTestUserPool';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreCollections } from '../../../shared/shared-types';

jest.setTimeout(10000); // Reduced from 15s to meet guideline maximum

describe('Group Membership Real-Time Sync Tests', () => {
    const driver = new ApiDriver();
    let userPool: FirebaseIntegrationTestUserPool;
    const db = getFirestore();
    const activeListeners: Array<() => void> = [];

    const _testUsers = (count: number) => userPool.getUsers(count);

    beforeAll(async () => {
        userPool = new FirebaseIntegrationTestUserPool(driver, 3);
        await userPool.initialize();
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
        const groupData = new CreateGroupRequestBuilder()
            .withName(`RT Test Group ${uuidv4()}`)
            .withDescription('Testing real-time membership sync')
            .build();

        const group = await driver.createGroup(groupData, user1.token);
        const groupId = group.id;

        // Set up a listener for User 1 to monitor group changes
        const membershipChanges: any[] = [];
        let resolvePromise: (value: unknown) => void;
        const membershipChangePromise = new Promise(resolve => {
            resolvePromise = resolve;
        });

        const groupRef = db.collection(FirestoreCollections.GROUPS).doc(groupId);
        const unsubscribe = groupRef.onSnapshot((snapshot) => {
            if (snapshot.exists) {
                const data = snapshot.data();
                const members = data?.data?.members || {};
                const memberCount = Object.keys(members).length;
                
                membershipChanges.push({
                    timestamp: new Date().toISOString(),
                    memberCount,
                    memberIds: Object.keys(members),
                    members
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
        await driver.waitForUserJoinGroup(groupId, user1.uid, user1.token, 3000);
        
        // Wait for listener to capture initial state
        await new Promise(resolve => {
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
        const shareResponse = await driver.generateShareLink(groupId, user1.token);
        const linkId = shareResponse.linkId;

        // User 2 joins via the share link
        await driver.joinGroupViaShareLink(linkId, user2.token);

        // Use ApiDriver to wait for user2 to join the group
        await driver.waitForUserJoinGroup(groupId, user2.uid, user1.token, 5000);
        
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
        const membersFromUser1 = await driver.getGroupMembers(groupId, user1.token);
        expect(membersFromUser1.members.length).toBe(2);
        expect(membersFromUser1.members.map((m: any) => m.uid)).toContain(user2.uid);

        const membersFromUser2 = await driver.getGroupMembers(groupId, user2.token);
        expect(membersFromUser2.members.length).toBe(2);
        expect(membersFromUser2.members.map((m: any) => m.uid)).toContain(user1.uid);
    });

    /**
     * Test that the group-changes collection is properly updated
     */
    it('should create a change record when member joins', async () => {
        const users = _testUsers(2);
        const user1 = users[0];
        const user2 = users[1];

        // User 1 creates a group
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Change Test Group ${uuidv4()}`)
            .withDescription('Testing change detection')
            .build();

        const group = await driver.createGroup(groupData, user1.token);
        const groupId = group.id;

        // Set up listener for group-changes collection
        const changeRecords: any[] = [];
        const changesRef = db.collection('group-changes')
            .where('id', '==', groupId)
            .where('users', 'array-contains', user1.uid);

        const unsubscribeChanges = changesRef.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    changeRecords.push({
                        id: change.doc.id,
                        ...change.doc.data(),
                        type: change.type
                    });
                }
            });
        });
        activeListeners.push(unsubscribeChanges);

        // Generate share link and have user2 join
        const shareResponse = await driver.generateShareLink(groupId, user1.token);
        await driver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

        // Use ApiDriver to wait for change records to be created
        await driver.waitForGroupChangeRecords(groupId, user1.uid, 1, 3000);

        // Wait for listener to capture the changes
        await new Promise(resolve => {
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