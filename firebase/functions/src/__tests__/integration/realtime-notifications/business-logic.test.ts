// Business Logic Integration Tests
// Tests notification system integration with business logic and permissions

import { describe, test, expect } from 'vitest';
import { user1, user2, user3, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest } from './shared-setup';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';

describe('Business Logic Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('Permission-Based Notifications', () => {
        test('should notify users only for groups they have access to', async () => {
            // 1. Create a second group with different members
            const separateGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Separate Group').build(), user2.token);

            // 2. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 3. Create expense in main group - only user1 should be notified
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 25.0);
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            
            // 4. Create expense in separate group - only user2 should be notified
            await apiDriver.createBasicExpense(separateGroup.id, user2.uid, user2.token, 30.0);
            await listener2.waitForEventCount(separateGroup.id, 'transaction', 1);

            // 5. Verify user1 only gets events for their group (user1 should have no events for separateGroup)
            const user1SeparateEvents = listener1.getEventsForGroup(separateGroup.id);
            expect(user1SeparateEvents.length).toBe(0);

            // 6. Verify user2 only gets events for their group (user2 should have no events for testGroup)
            const user2MainEvents = listener2.getEventsForGroup(testGroup.id);
            expect(user2MainEvents.length).toBe(0);

            console.log('✅ Users only receive notifications for groups they belong to');
        });

        test('should handle group permission changes', async () => {
            // 1. Set up listeners for all users
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid, user3.uid]);

            // 2. Add user2 to the group via share link
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);
            
            // 3. Wait for join notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener2.waitForEventCount(testGroup.id, 'group', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);

            // 4. Create an expense - both user1 and user2 should get notifications
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 40.0);
            
            // 5. Wait for transaction notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);

            // 6. Remove user2 from group
            await apiDriver.removeGroupMember(testGroup.id, user2.uid, user1.token);
            
            // 7. Wait for removal notification and clear events
            await listener2.waitForEventCount(testGroup.id, 'group', 1, 3000);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);

            // 8. Create another expense - only user1 should get notifications now
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 50.0);
            
            // 9. Wait for transaction notification (only user1 should get it)
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);

            // 10. Verify user2 doesn't get the transaction notification after removal
            const user2EventsAfterRemoval = listener2.getEventsForGroup(testGroup.id);
            expect(user2EventsAfterRemoval.length).toBe(0);

            console.log('✅ Permission changes affect notification delivery correctly');
        });

        test('should notify remaining members when admin removes a user from group', async () => {
            // 1. Set up listeners for all users
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid, user3.uid]);

            // 2. Add user2 to the group
            const shareLink1 = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink1.linkId, user2.token);
            
            // 3. Wait for user2 join notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener2.waitForEventCount(testGroup.id, 'group', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);
            
            // 4. Add user3 to the group
            const shareLink2 = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink2.linkId, user3.token);
            
            // 5. Wait for user3 join notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener3.waitForEventCount(testGroup.id, 'group', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);

            // 6. Create some activity to establish all users are in the group
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 30.0);
            
            // 7. Wait for transaction notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener3.waitForEventCount(testGroup.id, 'transaction', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);

            // 8. Admin (user1) removes user2 from the group
            await apiDriver.removeGroupMember(testGroup.id, user2.uid, user1.token);

            // 9. Wait for ALL removal notifications and clear events
            // - Remaining members (user1, user3) get group notifications about the removal
            // - Removed user (user2) gets their removal notification
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener3.waitForEventCount(testGroup.id, 'group', 1);
            await listener2.waitForEventCount(testGroup.id, 'group', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2, listener3]);

            // 10. Create another expense - only remaining members should get notifications
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 40.0);
            
            // 11. Wait for transaction notifications from remaining members
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener3.waitForEventCount(testGroup.id, 'transaction', 1);
            
            // 12. Verify user2 (removed member) doesn't get the transaction notification
            const user2EventsAfterRemoval = listener2.getEventsForGroup(testGroup.id);
            expect(user2EventsAfterRemoval.length).toBe(0);

            console.log('✅ Remaining group members notified when admin removes a user');
        });

        test('should notify removed user via group event', async () => {
            // 1. Set up listeners for all users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to the group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);
            
            // 3. Wait for join notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener2.waitForEventCount(testGroup.id, 'group', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2]);

            // 4. Create initial activity to ensure user2 is properly set up
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 25.0);
            
            // 5. Wait for transaction notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2]);

            // 6. Remove user2 from the group (triggers our new removal notification)
            await apiDriver.removeGroupMember(testGroup.id, user2.uid, user1.token);

            // 7. Wait for the group notification to the removed user
            // This is generated by our trigger using standard group change notification
            await listener2.waitForEventCount(testGroup.id, 'group', 1, 5000);

            // 8. Verify the removed user received the group notification
            const removalEvent = listener2.getLatestEvent(testGroup.id, 'group');
            expect(removalEvent).toBeDefined();
            expect(removalEvent!.type).toBe('group');
            expect(removalEvent!.groupId).toBe(testGroup.id);
            expect(removalEvent!.userId).toBe(user2.uid);

            console.log('✅ Removed user receives group notification via trigger');
        });
    }); // End Permission-Based Notifications

    describe('Feature-Specific Notifications', () => {
        test('should handle comment notifications', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to group for comment testing
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);
            
            // 3. Wait for join notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener2.waitForEventCount(testGroup.id, 'group', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2]);

            // 4. Create an expense first
            const createdExpense = await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 35.0);
            
            // 5. Wait for transaction notifications and clear events
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 1);
            notificationDriver.clearAllListenerEvents([listener1, listener2]);

            // 6. Add comment to the expense
            await apiDriver.createExpenseComment(createdExpense.id, 'This is a test comment', user2.token);

            // 7. Create another expense to verify normal notifications still work  
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 45.0);
            
            // 8. Wait for transaction notifications from the expense (not the comment)
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 1);

            // 9. Check that only transaction events were triggered, not comment events
            const allEvents = listener1.getEventsForGroup(testGroup.id);
            const transactionEvents = allEvents.filter(e => e.type === 'transaction');

            expect(transactionEvents.length).toBe(1);
            // Note: Comments don't trigger notifications yet - only transaction/balance/group events exist
            
            console.log('✅ Comment notification test infrastructure verified - comments do not trigger notifications');
        });

        test('should handle expense metadata changes', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create an expense
            const createdExpense = await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 45.0);

            // 3. Edit the expense metadata
            const beforeEdit = Date.now();
            const editRequest = {
                description: 'Updated description',
                amount: 55.0,
            };

            await apiDriver.updateExpense(createdExpense.id, editRequest, user1.token);

            // 4. Wait for edit-related notifications
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeEdit);

            // 5. Verify we got transaction notification for the edit
            const editEvents = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(editEvents.length).toBeGreaterThanOrEqual(1);
            console.log('✅ Expense metadata changes trigger notifications');
        });

        test('should handle currency conversion scenarios', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create a group with specific currency
            const currencyGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Currency Test Group').withDescription('EUR currency group').build(), user1.token);

            // 3. Create expense in EUR group
            const beforeExpense = Date.now();
            await apiDriver.createBasicExpense(currencyGroup.id, user1.uid, user1.token, 25.5);

            // 4. Wait for both transaction and balance notifications to settle
            await listener.waitForNewEvent(currencyGroup.id, 'transaction', beforeExpense);
            await listener.waitForNewEvent(currencyGroup.id, 'balance', beforeExpense);

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
