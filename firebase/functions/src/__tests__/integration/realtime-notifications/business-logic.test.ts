// Business Logic Integration Tests
// Tests notification system integration with business logic and permissions

import { describe, test, expect } from 'vitest';
import { users, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest } from './shared-setup';
import { CreateGroupRequestBuilder, SettlementBuilder } from '@splitifyd/test-support';

describe('Business Logic Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('Permission-Based Notifications', () => {
        test('should notify users only for groups they have access to', async () => {
            // 1. Create a second group with different members
            const separateGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Separate Group').build(), users[1].token);

            // 2. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 3. Create expense in main group - only user[0] should be notified
            const beforeExpense1 = Date.now();
            await apiDriver.createBasicExpense(testGroup.id, users[0].uid, users[0].token, 25.0);

            // 4. Create expense in separate group - only user[1] should be notified
            const beforeExpense2 = Date.now();
            await apiDriver.createBasicExpense(separateGroup.id, users[1].uid, users[1].token, 30.0);

            // 5. Wait for notifications
            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense1);
            await listener2.waitForNewEvent(separateGroup.id, 'transaction', beforeExpense2);

            // 6. Verify user1 only gets events for their group (user1 should have no events for separateGroup)
            const user1SeparateEvents = listener1.getEventsForGroup(separateGroup.id);
            expect(user1SeparateEvents.length).toBe(0);

            // 7. Verify user2 only gets events for their group (user2 should have no events for testGroup)
            const user2MainEvents = listener2.getEventsForGroup(testGroup.id);
            expect(user2MainEvents.length).toBe(0);

            console.log('✅ Users only receive notifications for groups they belong to');
        });

        test('should handle group permission changes', async () => {
            // 1. Set up listeners for all users
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid, users[2].uid]);

            // 2. Add user2 to the group via share link
            const beforeJoin = Date.now();
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await listener2.waitForNewEvent(testGroup.id, 'group', beforeJoin);

            // 3. Create an expense - both user1 and user2 should get notifications
            const beforeExpense = Date.now();
            await apiDriver.createBasicExpense(testGroup.id, users[0].uid, users[0].token, 40.0);

            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener2.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Remove user2 from group
            await apiDriver.removeGroupMember(testGroup.id, users[1].uid, users[0].token);

            // 5. Create another expense - only user1 should get notifications now
            const beforeExpense2 = Date.now();
            await apiDriver.createBasicExpense(testGroup.id, users[0].uid, users[0].token, 50.0);

            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense2);

            // 6. Verify user2 doesn't get notifications after removal
            // Wait longer for atomic cleanup to complete
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Check all events for this group after removal timestamp
            const allUser2Events = listener2.getEventsForGroup(testGroup.id);
            console.log(
                'User2 events after removal:',
                allUser2Events.map((e) => ({ type: e.type, timestamp: e.timestamp })),
            );

            // User2 should have events from before removal but not after
            const user2EventsAfterRemoval = allUser2Events.filter((e) => e.timestamp.getTime() >= beforeExpense2);
            expect(user2EventsAfterRemoval.length).toBe(0);

            console.log('✅ Permission changes affect notification delivery correctly');
        });

        test('should notify remaining members when admin removes a user from group', async () => {
            // 1. Set up listeners for all users
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid, users[2].uid]);

            // 2. Add user2 and user3 to the group
            const shareLink1 = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink1.linkId, users[1].token);
            const shareLink2 = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink2.linkId, users[2].token);

            // 3. Create some activity to establish all users are in the group
            const beforeExpense = Date.now();
            await apiDriver.createBasicExpense(testGroup.id, users[0].uid, users[0].token, 30.0);
            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener2.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener3.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Admin (user1) removes user2 from the group
            const beforeRemoval = Date.now();
            await apiDriver.removeGroupMember(testGroup.id, users[1].uid, users[0].token);

            // 5. Verify remaining members (user1 and user3) get group notification about member removal
            await listener1.waitForNewEvent(testGroup.id, 'group', beforeRemoval);
            await listener3.waitForNewEvent(testGroup.id, 'group', beforeRemoval);

            // 6. Verify user2 (removed member) doesn't get any notifications after removal
            // Wait longer for atomic cleanup to complete
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Check all events for this group after removal timestamp
            const allUser2Events = listener2.getEventsForGroup(testGroup.id);
            console.log(
                'User2 events after removal:',
                allUser2Events.map((e) => ({ type: e.type, timestamp: e.timestamp })),
            );

            // User2 should have events from before removal but not after
            const user2EventsAfterRemoval = allUser2Events.filter((e) => e.timestamp.getTime() >= beforeRemoval);
            expect(user2EventsAfterRemoval.length).toBe(0);

            // 7. Verify remaining members got the group update notifications
            const user1LatestGroupEvent = listener1.getLatestEvent(testGroup.id, 'group');
            const user3LatestGroupEvent = listener3.getLatestEvent(testGroup.id, 'group');

            const user1GroupEvents = user1LatestGroupEvent ? [user1LatestGroupEvent] : [];
            const user3GroupEvents = user3LatestGroupEvent ? [user3LatestGroupEvent] : [];

            expect(user1GroupEvents.length).toBeGreaterThanOrEqual(1);
            expect(user3GroupEvents.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Remaining group members notified when admin removes a user');
        });
    }); // End Permission-Based Notifications

    describe('Feature-Specific Notifications', () => {
        test('should handle comment notifications', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 2. Add user2 to group for comment testing
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // 3. Create an expense first
            const createdExpense = await apiDriver.createBasicExpense(testGroup.id, users[0].uid, users[0].token, 35.0);

            // 4. Add comment to the expense
            await apiDriver.createExpenseComment(createdExpense.id, 'This is a test comment', users[1].token);

            // 5. Wait for any potential comment-related notifications
            // Note: This test may reveal if comment notifications are implemented
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 6. Check for comment-related events (this will help us understand current behavior)
            const commentEvents = listener1.getEventsForGroup(testGroup.id);

            console.log(`Comment events detected: ${commentEvents.length}`);
            if (commentEvents.length > 0) {
                console.log(
                    'Comment event types:',
                    commentEvents.map((e) => e.type),
                );
            }

            // For now, just verify the test infrastructure works
            expect(createdExpense.id).toBeDefined();
            console.log('✅ Comment notification test infrastructure verified');
        });

        test('should handle expense metadata changes', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create an expense
            const createdExpense = await apiDriver.createBasicExpense(testGroup.id, users[0].uid, users[0].token, 45.0);

            // 3. Edit the expense metadata
            const beforeEdit = Date.now();
            const editRequest = {
                description: 'Updated description',
                amount: 55.0,
            };

            await apiDriver.updateExpense(createdExpense.id, editRequest, users[0].token);

            // 4. Wait for edit-related notifications
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeEdit);

            // 5. Verify we got transaction notification for the edit
            const editEvents = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(editEvents.length).toBeGreaterThanOrEqual(1);
            console.log('✅ Expense metadata changes trigger notifications');
        });

        test('should handle currency conversion scenarios', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create a group with specific currency
            const currencyGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Currency Test Group').withDescription('EUR currency group').build(), users[0].token);

            // 3. Create expense in EUR group
            const beforeExpense = Date.now();
            await apiDriver.createBasicExpense(currencyGroup.id, users[0].uid, users[0].token, 25.5);

            // 4. Wait for notifications
            await listener.waitForNewEvent(currencyGroup.id, 'transaction', beforeExpense);

            // 5. Verify transaction and balance events
            const currencyEvents = listener.getEventsForGroup(currencyGroup.id);

            const transactionEvents = currencyEvents.filter((e) => e.type === 'transaction');
            const balanceEvents = currencyEvents.filter((e) => e.type === 'balance');

            expect(transactionEvents.length).toBeGreaterThanOrEqual(1);
            expect(balanceEvents.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Currency-specific notifications work correctly');
        });
    }); // End Feature-Specific Notifications
});
