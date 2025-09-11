// Test to verify that group deletion notifications work correctly
// This tests the actual notification system that the frontend uses

import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { borrowTestUsers } from '@splitifyd/test-support/test-pool-helpers';
import { ApiDriver, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { getFirestore } from '../../../../firebase';
import { PooledTestUser } from '@splitifyd/shared';

describe('Group Deletion Notifications', () => {
    const apiDriver = new ApiDriver();
    const firestore = getFirestore();

    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
    });

    test('should notify users via user-notifications when group is deleted', async () => {
        // Create a group with 2 members
        const groupData = new CreateGroupRequestBuilder().withName(`Notification Test ${uuidv4()}`).withDescription('Testing user notifications during group deletion').build();

        const group = await apiDriver.createGroup(groupData, users[0].token);

        // Add second user to the group
        const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

        // Verify 2 members before deletion
        const { members } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
        expect(members.members.length).toBe(2);

        // Get initial change versions for both users
        const user1NotificationsBefore = await firestore.doc(`user-notifications/${users[0].uid}`).get();
        const user2NotificationsBefore = await firestore.doc(`user-notifications/${users[1].uid}`).get();

        const initialUser1Version = user1NotificationsBefore.data()?.changeVersion || 0;
        const initialUser2Version = user2NotificationsBefore.data()?.changeVersion || 0;

        console.log('Initial change versions:', {
            user1: initialUser1Version,
            user2: initialUser2Version,
        });

        // Delete the group - this should trigger our notification system
        await apiDriver.deleteGroup(group.id, users[0].token);

        // Wait for triggers to execute
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get user notification documents after deletion
        const user1NotificationsAfter = await firestore.doc(`user-notifications/${users[0].uid}`).get();
        const user2NotificationsAfter = await firestore.doc(`user-notifications/${users[1].uid}`).get();

        // Both users should have notification documents
        expect(user1NotificationsAfter.exists).toBe(true);
        expect(user2NotificationsAfter.exists).toBe(true);

        const user1AfterData = user1NotificationsAfter.data();
        const user2AfterData = user2NotificationsAfter.data();

        const finalUser1Version = user1AfterData?.changeVersion || 0;
        const finalUser2Version = user2AfterData?.changeVersion || 0;

        console.log('Final change versions:', {
            user1: finalUser1Version,
            user2: finalUser2Version,
        });

        // Both users should have their change version incremented (indicating they were notified)
        expect(finalUser1Version).toBeGreaterThan(initialUser1Version);
        expect(finalUser2Version).toBeGreaterThan(initialUser2Version);

        // The deleted group should NOT be in their notification documents anymore
        // This indicates that removeUserFromGroup was called successfully
        expect(user1AfterData?.groups?.[group.id]).toBeUndefined();
        expect(user2AfterData?.groups?.[group.id]).toBeUndefined();

        console.log('✅ Both users were notified and removed from group notifications');
        console.log('This means the frontend will detect group removal and update dashboards');

        // Verify the group is actually deleted from the backend
        await expect(apiDriver.getGroupFullDetails(group.id, users[0].token)).rejects.toThrow(/404|not found/i);
    }, 15000);

    test('should handle single user group deletion', async () => {
        // Create a group with just the owner
        const groupData = new CreateGroupRequestBuilder().withName(`Single User Test ${uuidv4()}`).withDescription('Testing single user group deletion').build();

        const group = await apiDriver.createGroup(groupData, users[0].token);

        // Get initial change version
        const userNotificationsBefore = await firestore.doc(`user-notifications/${users[0].uid}`).get();
        const initialVersion = userNotificationsBefore.data()?.changeVersion || 0;

        // Delete the group
        await apiDriver.deleteGroup(group.id, users[0].token);

        // Wait for triggers to execute
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get user notification document after deletion
        const userNotificationsAfter = await firestore.doc(`user-notifications/${users[0].uid}`).get();

        expect(userNotificationsAfter.exists).toBe(true);

        const finalVersion = userNotificationsAfter.data()?.changeVersion || 0;

        // User should be notified about the group deletion
        expect(finalVersion).toBeGreaterThan(initialVersion);

        // Group should be removed from notifications
        expect(userNotificationsAfter.data()?.groups?.[group.id]).toBeUndefined();

        // Verify the group is actually deleted
        await expect(apiDriver.getGroupFullDetails(group.id, users[0].token)).rejects.toThrow(/404|not found/i);
    }, 15000);
});
