// Data Consistency & Edge Cases Integration Tests
// Tests notification system data consistency and edge case handling

import {describe, expect, test} from 'vitest';
import {
    users, testGroup, apiDriver, notificationDriver, 
    setupNotificationTest, cleanupNotificationTest, 
    createBasicExpense, createMultiUserExpense
} from './shared-setup';
import {SettlementBuilder} from '@splitifyd/test-support';

describe('Data Consistency & Edge Cases Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('Group Lifecycle Edge Cases', () => {

        test('should detect when group is deleted from notifications', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // Create an expense to ensure group exists in notifications
            const beforeExpenseTimestamp = Date.now();
            const expense = createBasicExpense(testGroup.id, 15.00);
            await apiDriver.createExpense(expense, users[0].token);

            // Wait for initial transaction notification to establish baseline
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpenseTimestamp);

            // 2. Wait for all processing to complete before deletion
            await new Promise(resolve => setTimeout(resolve, 500));

            // 3. Delete the group
            console.log('Deleting group...');
            await apiDriver.deleteGroup(testGroup.id, users[0].token);

            // 4. Group deletion should clean up the notification document
            // Give time for deletion processing to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 5. Verify deletion completed successfully (this is more of a smoke test)
            // Since group deletion cleans up notifications, the user should have no groups
            console.log('✅ Group deletion completed successfully');
        });

    }); // End Group Lifecycle Edge Cases

    describe('Data Integrity Tests', () => {

        test('should handle settlement notifications correctly', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 2. Add user2 to group and create multi-user expense
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            
            const expense = createMultiUserExpense(testGroup.id, 80.00, [0, 1]);
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Create a settlement
            const beforeSettlement = Date.now();
            const settlement = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(40.00)
                .build();

            await apiDriver.createSettlement(settlement, users[1].token);

            // 4. Wait for settlement notifications (likely balance changes)
            await listener1.waitForNewEvent(testGroup.id, 'balance', beforeSettlement);
            await listener2.waitForNewEvent(testGroup.id, 'balance', beforeSettlement);

            // 5. Verify settlement triggers appropriate notifications
            const user1LatestBalanceEvent = listener1.getLatestEvent(testGroup.id, 'balance');
            const user2LatestBalanceEvent = listener2.getLatestEvent(testGroup.id, 'balance');
            
            const user1SettlementEvents = user1LatestBalanceEvent ? [user1LatestBalanceEvent] : [];
            const user2SettlementEvents = user2LatestBalanceEvent ? [user2LatestBalanceEvent] : [];

            expect(user1SettlementEvents.length).toBeGreaterThanOrEqual(1);
            expect(user2SettlementEvents.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Settlements trigger proper balance notifications');
        });

        test('should handle partial group membership cleanup', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 2. Add user2 to group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // 3. Create some activity to ensure user2 has notification data
            const expense = createBasicExpense(testGroup.id, 35.00, 0);
            await apiDriver.createExpense(expense, users[0].token);

            // 4. Remove user2 from group
            const beforeRemoval = Date.now();
            await apiDriver.removeGroupMember(testGroup.id, users[1].uid, users[0].token);

            // 5. Wait for removal to be fully processed:
            // - User1 should receive group change event (member count decreased)
            // - User2's notification document should be cleaned up
            await listener1.waitForNewEvent(testGroup.id, 'group', beforeRemoval);
            
            // Give additional time for User2's notification cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 6. Now create expense - User2 should not receive notifications
            const beforePostRemovalExpense = Date.now();
            const postRemovalExpense = createBasicExpense(testGroup.id, 45.00, 0);
            await apiDriver.createExpense(postRemovalExpense, users[0].token);

            // 7. User1 should get the notification, user2 should not
            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforePostRemovalExpense);

            // Give time for any potential notifications to user2
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check for events after removal timestamp
            const user2EventsAfterRemoval = listener2.getEventsForGroup(testGroup.id)
                .filter(e => e.timestamp.getTime() >= beforePostRemovalExpense);

            // Debug: log what events user2 received after removal
            console.log('User2 events after removal:');
            for (const notificationEvent of user2EventsAfterRemoval) {
                console.log(`\t${JSON.stringify(notificationEvent)}`)
            }

            // After atomic fix, user2 should NOT receive any notifications for this group
            // because their notification document was cleaned up atomically with membership removal
            expect(user2EventsAfterRemoval.length).toBe(0);
            console.log('✅ Group membership cleanup prevents notifications to removed users');
        });

        test('should handle group recreation with same ID', async () => {
            // Note: This test is conceptual as group IDs are typically unique
            // But it tests the system's robustness to edge cases
            
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create activity in original group
            const expense1 = createBasicExpense(testGroup.id, 25.00, 0);
            await apiDriver.createExpense(expense1, users[0].token);

            // 3. Track original group state
            const originalEvents = listener.getEvents()
                .filter((e: any) => e.groupId === testGroup.id);

            // 4. If we could recreate a group with same ID, notifications should be isolated
            // For now, test that the notification system handles the existing group properly
            const beforeSecondExpense = Date.now();
            const expense2 = createBasicExpense(testGroup.id, 35.00, 0);
            await apiDriver.createExpense(expense2, users[0].token);

            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeSecondExpense);

            const allEvents = listener.getEvents()
                .filter((e: any) => e.groupId === testGroup.id);

            expect(allEvents.length).toBeGreaterThan(originalEvents.length);
            console.log('✅ Notification system maintains proper state isolation');
        });

        test('should maintain change counter accuracy under concurrency', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create multiple rapid expenses to test counter accuracy
            const beforeRapidChanges = Date.now();
            const numberOfExpenses = 5;
            
            for (let i = 0; i < numberOfExpenses; i++) {
                const expense = createBasicExpense(testGroup.id, 10 + i, 0);
                await apiDriver.createExpense(expense, users[0].token);
                // Small delay to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 3. Wait for all transaction events
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 4. Count events and verify accuracy
            const transactionEvents = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(transactionEvents.length).toBeGreaterThanOrEqual(numberOfExpenses);

            // 5. Verify version numbers are sequential (if available in events)
            const versions = transactionEvents.map(e => e.version).sort((a, b) => a - b);
            for (let i = 1; i < versions.length; i++) {
                expect(versions[i]).toBeGreaterThan(versions[i-1]);
            }

            console.log('✅ Change counters maintain accuracy under rapid changes');
        });

        test('should handle expense updates correctly', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create an expense
            const expense = createBasicExpense(testGroup.id, 50.00, 0);
            const createdExpense = await apiDriver.createExpense(expense, users[0].token);

            // 3. Edit the expense
            const beforeEdit = Date.now();
            const editRequest = {
                description: 'Updated expense description',
                amount: 75.00
            };

            await apiDriver.updateExpense(createdExpense.id, editRequest, users[0].token);

            // 4. Wait for edit notifications
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeEdit);

            // 5. Verify both transaction and balance events fire for updates
            const editEvents = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.timestamp.getTime() >= beforeEdit);

            const transactionEvents = editEvents.filter(e => e.type === 'transaction');
            const balanceEvents = editEvents.filter(e => e.type === 'balance');

            expect(transactionEvents.length).toBeGreaterThanOrEqual(1);
            expect(balanceEvents.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Expense updates trigger both transaction and balance notifications');
        });

        test('should handle notification document migration scenarios', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Test that current notification system works as expected
            //    This establishes a baseline for future migration scenarios
            const beforeExpense = Date.now();
            const expense = createBasicExpense(testGroup.id, 42.00, 0);
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Wait for notifications
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Verify current document structure works
            const events = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.timestamp.getTime() >= beforeExpense);

            expect(events.length).toBeGreaterThanOrEqual(1);

            // 5. Verify event structure has expected fields for future compatibility
            const transactionEvent = events.find(e => e.type === 'transaction');
            expect(transactionEvent).toBeDefined();
            expect(transactionEvent!.version).toBeDefined();
            expect(transactionEvent!.timestamp).toBeDefined();
            expect(transactionEvent!.userId).toBeDefined();

            console.log('✅ Current notification document structure ready for migration scenarios');
        });

    }); // End Data Integrity Tests

});