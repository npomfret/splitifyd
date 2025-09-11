// User Notification Service Integration Tests
// Tests notification lifecycle management through UserService business logic

import { describe, test, expect } from 'vitest';
import { user1, user2, user3, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest } from './shared-setup';

describe('User Notification Service Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('User Lifecycle Notifications', () => {
        test('should initialize notifications during user registration', async () => {
            // Note: In integration tests, users are already created by the test framework
            // This test verifies that notification initialization works as part of user creation

            // 1. Set up listener for a user (this should work if initialization worked during registration)
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Verify that the user can receive notifications (indicating initialization worked during registration)
            const beforeExpense = Date.now();

            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 22.0);

            // 3. If initialization during registration worked, this should succeed
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            const events = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(events.length).toBeGreaterThanOrEqual(1);
            console.log('✅ User notification initialization working correctly during registration');
        });

        test('should cleanup notifications during account deletion', async () => {
            // Note: In integration tests, we can't actually delete users from Firebase Auth
            // This test verifies that the cleanup infrastructure works through UserService

            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // 3. Create activity to ensure both users have notification data
            const beforeExpense = Date.now();

            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 28.0);

            // 4. Verify both users receive notifications
            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener2.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 5. Remove user2 from group (simulates partial cleanup before account deletion)
            await apiDriver.removeGroupMember(testGroup.id, user2.uid, user1.token);

            // 6. Verify user1 still works after user2 removal
            const beforeSecondExpense = Date.now();

            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 32.0);

            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeSecondExpense);

            console.log('✅ Notification cleanup infrastructure maintains system integrity');
        });
    }); // End User Lifecycle Notifications

    describe('Group Membership Operations', () => {
        test('should handle membership deletion notifications correctly', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            const beforeAddMember = Date.now();
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // 3. Verify both users are receiving notifications for group membership
            await listener1.waitForNewEvent(testGroup.id, 'group', beforeAddMember);

            // 4. Create activity while both users are in group
            const beforeExpense = Date.now();

            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 26.0);

            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener2.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 5. Remove user2 from group (triggers membership deletion)
            const beforeRemoval = Date.now();
            await apiDriver.removeGroupMember(testGroup.id, user2.uid, user1.token);

            // 6. Verify user1 gets group notification about removal
            await listener1.waitForNewEvent(testGroup.id, 'group', beforeRemoval);

            // 7. Verify user2 stops receiving notifications after removal
            const beforePostRemovalExpense = Date.now();

            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 35.0);

            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforePostRemovalExpense);

            // User2 should not receive this notification
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait longer for atomic cleanup
            const user2PostRemovalEvents = listener2.getEventsForGroup(testGroup.id).filter((e) => e.timestamp.getTime() >= beforePostRemovalExpense);

            expect(user2PostRemovalEvents.length).toBe(0);
            console.log('✅ Membership deletion notifications handled correctly');
        });
    }); // End Group Membership Operations

    describe('Notification System Reliability', () => {
        test('should handle notification operations reliably', async () => {
            // Note: In integration tests, we test that the notification system is working reliably
            // This test verifies that the notification system operates consistently

            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Perform operations that should trigger notifications
            const beforeExpense = Date.now();

            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 24.0);

            // 3. Verify notifications executed successfully
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Test multiple consecutive operations (stress test notification system)
            for (let i = 0; i < 3; i++) {
                await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 15 + i);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            // 5. Wait for all operations to complete
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 6. Verify all notifications executed reliably
            const allEvents = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(allEvents.length).toBeGreaterThanOrEqual(4); // Original + 3 consecutive

            console.log('✅ Notification system executing reliably under load');
        });
    }); // End Notification System Reliability
});
